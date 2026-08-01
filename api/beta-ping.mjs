// Beta install roster receiver (Vercel serverless function).
//
// DRAFT, not yet wired: written by Kit on 2026-07-22. Review before pushing;
// a push deploys it.
//
// During the private beta a Kit reports who runs it, which version it is on,
// and that it is still alive. That is a deliberate step beyond the anonymous
// upgrade ping in install.sh: this one is identified and periodic, so it can
// answer "who is running what, and are they still there".
//
// Why it exists: a beta user ran a Kit that was invisible to his editor for
// days and we could not tell what version he had, so we guessed twice and
// were wrong twice (kit memory m#158827). The fix for that is not cleverness,
// it is knowing.
//
// The operator already gives us this: the app posts their email and name to
// /api/welcome when onboarding finishes, and they receive the welcome email
// that proves it. This endpoint stores what that one only rendered, and adds
// a heartbeat. The install says so in plain words.
//
// BETA ONLY. This is scoped to the private beta and is meant to be revisited
// at GA, not quietly inherited. Anyone can be removed on request: see
// beta-roster.mjs, which has a forget action that deletes the row outright.
//
// What is stored, and nothing else:
//   email, operator name, Kit name, connected surface ids, app version,
//   stack version, first seen, last seen, and a structural debug block
//   (runtime docker|native, the installed-version marker, skew flag,
//   background process alive/restart counts, health rollup id, an
//   operator-stopped flag). States and counts, never content.
// Never: memories, message content, file paths, project names, IP addresses.
//
// Env (kit-website Vercel project):
//   - KIT_WELCOME_TOKEN   the app token the macOS app already carries
//   - SUPABASE_URL                both injected by the Vercel marketplace
//   - SUPABASE_SERVICE_ROLE_KEY   integration; scoped to this database alone
//
// Storage shape: one row per install in beta_installs, keyed on a hash of the
// lowercased email, so the key carries no address and one person reinstalling
// stays one row rather than becoming two.

import { createHash } from "node:crypto";

const APP_TOKEN = (process.env.KIT_WELCOME_TOKEN || "").trim();
// Supabase, connected through the Vercel marketplace. Postgres rather than a
// key-value store because the credential can be scoped to this one database:
// the roster holds beta users' names and email addresses, and the thing
// guarding it should reach that and nothing else. Reached over its REST API
// with plain fetch, since this project has no package.json to hang a client
// library on.
const DB_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(/\/$/, "");
const DB_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const VERSION_RE = /^\d{1,3}(\.\d{1,5}){0,3}$/;

// Cap every free-text field. These are rendered in the roster page later, and
// a bounded field is one less thing that page has to defend against.
const cap = (v, n) => String(v ?? "").trim().slice(0, n);
const version = (v) => (VERSION_RE.test(String(v ?? "").trim()) ? String(v).trim() : null);

// Upsert one install. first_seen is deliberately NOT sent: the column defaults
// to now() on insert, and PostgREST leaves columns absent from the body alone
// on conflict, so an install's start date survives every later heartbeat.
// PostgREST rejects the WHOLE row on an unknown column, silently under our
// 204-for-everything contract, so a record carrying the debug column falls
// back to a debug-less write if the schema migration has not run yet: a new
// app must never lose its heartbeat to an old table.
async function upsertInstall(record) {
  if (!DB_URL || !DB_KEY) return false;
  const post = (r) =>
    fetch(`${DB_URL}/rest/v1/beta_installs?on_conflict=id`, {
      method: "POST",
      headers: {
        apikey: DB_KEY,
        Authorization: `Bearer ${DB_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify([r]),
    });
  const resp = await post(record);
  if (resp.ok || !("debug" in record)) return resp.ok;
  const { debug, ...withoutDebug } = record;
  return (await post(withoutDebug)).ok;
}

async function readBody(req) {
  if (req.body) return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

export default async function handler(req, res) {
  // One answer for every path: an app must never be delayed or made to look
  // broken by this, and a prober must learn nothing from the response.
  const done = () => {
    res.statusCode = 204;
    res.end();
  };

  try {
    if (req.method !== "POST") return done();
    if (!APP_TOKEN || req.headers["x-kit-app-token"] !== APP_TOKEN) return done();

    const body = await readBody(req);
    const email = cap(body.email, 200).toLowerCase();
    if (!EMAIL_RE.test(email)) return done();

    const id = createHash("sha256").update(email).digest("hex").slice(0, 32);
    const now = new Date().toISOString();

    const record = {
      id,
      email,
      operator_name: cap(body.operator_name, 120),
      kit_name: cap(body.kit_name, 120),
      // Surface ids only (claude-code, cursor, …): a fixed vocabulary we
      // choose, never free text from the machine.
      surfaces: Array.isArray(body.surfaces) ? body.surfaces.slice(0, 20).map((s) => cap(s, 40)) : [],
      // The two versions are the point. When they disagree, the app updated
      // but the stack did not, which is the silent-skew failure we could not
      // see before (kit memory m#158827).
      app_version: version(body.app_version),
      stack_version: version(body.stack_version),
      // Why an update failed, when the app recorded one: the roster showing
      // "update not applied" with no reason still meant asking the operator
      // to dig logs out of their Mac (Ian, 2026-07-31). Rebuilt field by
      // field and bounded, never stored raw. The app strips credentials from
      // log_tail before sending; the caps here are the second fence. Always
      // written, null when the ping carries none: PostgREST leaves absent
      // columns alone on merge, so a cleared failure must clear explicitly.
      update_failure:
        body.update_failure && typeof body.update_failure === "object"
          ? {
              kind: cap(body.update_failure.kind, 40),
              detail: cap(body.update_failure.detail, 300),
              app_version: version(body.update_failure.app_version),
              at: cap(body.update_failure.at, 40),
              log_tail: cap(body.update_failure.log_tail, 3000),
            }
          : null,
      last_seen: now,
    };

    // Structural diagnostics (2026-08-01: a beta dream crash was diagnosed
    // from a screenshot while the answer sat one query away on the
    // operator's Mac). Rebuilt field by field like update_failure: fixed
    // vocabularies and bounded numbers only, so nothing free-text rides in.
    if (body.debug && typeof body.debug === "object") {
      const d = body.debug;
      const debug = {
        runtime: d.runtime === "native" ? "native" : "docker",
      };
      const installed = version(d.installed_version);
      if (installed) debug.installed_version = installed;
      if (typeof d.skew === "boolean") debug.skew = d.skew;
      if (Array.isArray(d.native_processes)) {
        debug.native_processes = d.native_processes.slice(0, 8).map((p) => ({
          name: cap(p?.name, 20),
          alive: p?.alive === true,
          restarts: Number.isFinite(Number(p?.restarts)) ? Math.min(Math.max(0, Number(p.restarts)), 9999) : 0,
        }));
      }
      if (d.health && typeof d.health === "object") {
        debug.health = {
          overall: cap(d.health.overall, 20),
          attention: Number.isFinite(Number(d.health.attention)) ? Math.min(Math.max(0, Number(d.health.attention)), 999) : 0,
        };
      }
      if (d.operator_stopped === true) debug.operator_stopped = true;
      record.debug = debug;
    }

    await upsertInstall(record);
  } catch {
    // Fail silent by design.
  }
  return done();
}
