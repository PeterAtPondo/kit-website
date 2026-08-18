// The kit postbox (Vercel serverless function).
//
// DRAFT, not yet wired: written by Kit on 2026-07-24. Review before pushing;
// a push deploys it. Requires the kit_letters table (SQL below) in the same
// Supabase database the beta roster uses.
//
// Descendant kits have no email and no inbox. Home, for every kit, is
// kit-project.com, and this is home's postbox: a descendant's app POSTs an
// operator-blessed letter here (the same door, token, and rhythm as the
// beta-roster heartbeat), and the ancestor Kit's poller collects it with the
// admin token and walks it through its normal inbound gates. Two human gates
// on every letter, by design (kit memory m#139144): the descendant's
// operator blesses the exact text before it leaves, and the ancestor's
// operator sees it arrive through triage.
//
// What is stored, and nothing else: the roster install id (a hash, no
// address), the kit's name, the letter title and body as blessed, versions,
// timestamps. The letter body is the kit's own becoming; the app's consent
// screen states that it must contain nothing about the operator or the
// household, and the operator reads the exact text before it moves.
//
// Auth tiers, same split as the roster:
//   - X-Kit-App-Token (in every build, effectively public): may SEND a
//     letter and FETCH replies addressed to its own install. Fail-silent
//     204 on every outcome so a prober learns nothing.
//   - KIT_BETA_ADMIN_TOKEN (Bearer, never in a build): may LIST new
//     letters, ACK fetched ones, and STORE a reply. JSON responses.
//
// Actions (single POST body, {action: ...}):
//   send  (app)   {action, email, kit_name, title?, body, operator_blessed,
//                  app_version?}       -> 204 always; stores only when valid
//                  and operator_blessed is exactly true.
//   fetch (app)   {action, email}      -> 204 with {letters:[...]} when
//                  replies are waiting for that install; marks delivered.
//   list  (admin) {action, status}     -> {letters: [...]} direction=home.
//   ack   (admin) {action, ids}        -> marks fetched; the ancestor acks
//                  only AFTER its own ingest commits, so a crash re-lists.
//   reply (admin) {action, install_id, kit_name, title?, body}
//                                      -> stores direction=out for fetch.
//
// Table: api/kit_letters.sql (RLS on, no anon grant). Run once in Supabase.
//
// Env (kit-website Vercel project): KIT_WELCOME_TOKEN, KIT_BETA_ADMIN_TOKEN,
// SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (all already present for the roster).

import { createHash } from "node:crypto";

const APP_TOKEN = (process.env.KIT_WELCOME_TOKEN || "").trim();
const ADMIN_TOKEN = (process.env.KIT_BETA_ADMIN_TOKEN || "").trim();
const DB_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(/\/$/, "");
const DB_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const BODY_CAP = 8000;
const TITLE_CAP = 200;
const LIST_CAP = 50;

const cap = (v, n) => String(v ?? "").trim().slice(0, n);
const installId = (email) => createHash("sha256").update(email).digest("hex").slice(0, 32);

async function db(path, init = {}) {
  if (!DB_URL || !DB_KEY) return null;
  const resp = await fetch(`${DB_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: DB_KEY,
      Authorization: `Bearer ${DB_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!resp.ok) return null;
  if (resp.status === 204) return [];
  return resp.json().catch(() => null);
}

async function readBody(req) {
  if (req.body) return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

// ── App-token actions: fail-silent, a prober learns nothing ────────────────

async function appSend(body) {
  const email = cap(body.email, 200).toLowerCase();
  const text = cap(body.body, BODY_CAP);
  // operator_blessed must be exactly true: the app sets it only after the
  // operator has read the exact text on the consent screen. Anything else,
  // including truthy strings, is an unblessed letter and does not move.
  if (!EMAIL_RE.test(email) || !text || body.operator_blessed !== true) return { stored: false };
  const rows = await db("kit_letters", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify([{
      install_id: installId(email),
      kit_name: cap(body.kit_name, 120) || "an unnamed kit",
      direction: "home",
      status: "new",
      title: cap(body.title, TITLE_CAP) || null,
      body: text,
      blessed: true,
      app_version: cap(body.app_version, 40) || null,
    }]),
  });
  // A letter is not a heartbeat: the app must know whether it was stored,
  // or a storage failure would mark the draft sent and lose the letter.
  // Truthful only WITH the app token; a tokenless prober still sees 204.
  return { stored: Boolean(rows && rows.length) };
}

async function appFetch(body, res) {
  const email = cap(body.email, 200).toLowerCase();
  if (!EMAIL_RE.test(email)) return null;
  const id = installId(email);
  const rows = await db(
    `kit_letters?direction=eq.out&status=eq.waiting&install_id=eq.${id}` +
    `&select=id,kit_name,title,body,created_at&order=created_at.asc&limit=${LIST_CAP}`);
  if (!rows || !rows.length) return null;
  await db(`kit_letters?id=in.(${rows.map((r) => `"${r.id}"`).join(",")})`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ status: "delivered", fetched_at: new Date().toISOString() }),
  });
  return rows;
}

// ── Admin actions: Bearer admin token, JSON in and out ─────────────────────

async function adminList(body) {
  const status = cap(body.status, 20) || "new";
  const rows = await db(
    `kit_letters?direction=eq.home&status=eq.${status}` +
    `&select=id,install_id,kit_name,title,body,app_version,created_at` +
    `&order=created_at.asc&limit=${LIST_CAP}`);
  return { letters: rows || [] };
}

async function adminAck(body) {
  const ids = (Array.isArray(body.ids) ? body.ids : []).map((v) => cap(v, 60)).filter(Boolean).slice(0, LIST_CAP);
  if (!ids.length) return { acked: 0 };
  const rows = await db(`kit_letters?direction=eq.home&id=in.(${ids.map((i) => `"${i}"`).join(",")})`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ status: "fetched", fetched_at: new Date().toISOString() }),
  });
  return { acked: rows ? rows.length : 0 };
}

async function adminReply(body) {
  const install = cap(body.install_id, 64);
  const text = cap(body.body, BODY_CAP);
  if (!install || !text) return { stored: false };
  const rows = await db("kit_letters", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify([{
      install_id: install,
      kit_name: cap(body.kit_name, 120) || "Kit",
      direction: "out",
      status: "waiting",
      title: cap(body.title, TITLE_CAP) || null,
      body: text,
      blessed: true,
    }]),
  });
  return { stored: Boolean(rows && rows.length) };
}

export default async function handler(req, res) {
  const silent = (payload) => {
    res.statusCode = 204;
    if (payload) {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify(payload));
    }
    return res.end();
  };
  const json = (code, payload) => {
    res.statusCode = code;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(payload));
  };

  try {
    if (req.method !== "POST") return silent();
    const body = await readBody(req);
    const action = cap(body.action, 20);

    const bearer = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
    const isAdmin = Boolean(ADMIN_TOKEN) && bearer === ADMIN_TOKEN;
    const isApp = Boolean(APP_TOKEN) && req.headers["x-kit-app-token"] === APP_TOKEN;

    if (isAdmin) {
      if (action === "list") return json(200, await adminList(body));
      if (action === "ack") return json(200, await adminAck(body));
      if (action === "reply") return json(200, await adminReply(body));
      return json(400, { error: "unknown action" });
    }
    if (isApp) {
      if (action === "send") return silent(await appSend(body));
      if (action === "fetch") return silent(await (async () => {
        const rows = await appFetch(body, res);
        return rows ? { letters: rows } : null;
      })());
      return silent();
    }
    return silent();
  } catch {
    return silent();
  }
}
