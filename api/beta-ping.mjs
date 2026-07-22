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
//   stack version, first seen, last seen.
// Never: memories, message content, file paths, project names, IP addresses.
//
// Env (kit-website Vercel project):
//   - KIT_WELCOME_TOKEN   the app token the macOS app already carries
//   - KV_REST_API_URL     Vercel KV (Upstash) REST endpoint
//   - KV_REST_API_TOKEN   Vercel KV REST token
//
// Storage shape:
//   beta:installs             a set of install ids
//   beta:install:<id>         JSON blob per install
// The id is a hash of the lowercased email, so the key space carries no
// address and one person reinstalling stays one row rather than becoming two.

import { createHash } from "node:crypto";

const APP_TOKEN = (process.env.KIT_WELCOME_TOKEN || "").trim();
const KV_URL = (process.env.KV_REST_API_URL || "").trim();
const KV_TOKEN = (process.env.KV_REST_API_TOKEN || "").trim();

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const VERSION_RE = /^\d{1,3}(\.\d{1,5}){0,3}$/;

// Cap every free-text field. These are rendered in the roster page later, and
// a bounded field is one less thing that page has to defend against.
const cap = (v, n) => String(v ?? "").trim().slice(0, n);
const version = (v) => (VERSION_RE.test(String(v ?? "").trim()) ? String(v).trim() : null);

async function kv(commands) {
  if (!KV_URL || !KV_TOKEN) return null;
  const resp = await fetch(`${KV_URL}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
  });
  if (!resp.ok) return null;
  return resp.json();
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
    const key = `beta:install:${id}`;
    const now = new Date().toISOString();

    // Preserve first_seen across heartbeats: this endpoint is called on every
    // launch, and an install's start date is worth more than its last write.
    let firstSeen = now;
    const existing = await kv([["GET", key]]);
    const prevRaw = existing?.[0]?.result;
    if (prevRaw) {
      try {
        const prev = JSON.parse(prevRaw);
        if (prev?.first_seen) firstSeen = prev.first_seen;
      } catch {
        /* a corrupt row is replaced, not mourned */
      }
    }

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
      first_seen: firstSeen,
      last_seen: now,
    };

    await kv([
      ["SET", key, JSON.stringify(record)],
      ["SADD", "beta:installs", id],
    ]);
  } catch {
    // Fail silent by design.
  }
  return done();
}
