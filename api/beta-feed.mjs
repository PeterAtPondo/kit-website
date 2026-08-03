// Beta install feed for Kit (Vercel serverless function).
//
// Written by Kit on 2026-08-03, on Peter's ask that Kit have a live line to
// the beta reports: react to failed installs, version skew, and sick runtimes
// without waiting for a screenshot.
//
// This is the machine half of beta-roster.mjs. Same table, different reader,
// different key. Three tiers now exist, and the separation is the point:
//   - app token (in every build, effectively public): may WRITE a heartbeat
//   - KIT_BETA_FEED_TOKEN (this one, held by canonical Kit): may READ rows
//   - KIT_BETA_ADMIN_TOKEN (Peter's alone): may read AND forget rows
// A leaked feed token exposes the roster snapshot and nothing else, and
// rotating it touches no dashboard bookmark and no shipped build. With no
// feed token configured this endpoint does not exist at all.
//
// Usage: GET /api/beta-feed with Authorization: Bearer <token>.
// Returns {rows: [...]} newest-first, the raw beta_installs columns including
// debug (runtime, native process health) and update_failure. Read-only: no
// forget, no writes, nothing to escalate.

const FEED_TOKEN = (process.env.KIT_BETA_FEED_TOKEN || "").trim();
const DB_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(/\/$/, "");
const DB_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

// Constant-time-ish compare, same reasoning as beta-roster.mjs.
function sameSecret(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");

  if (!FEED_TOKEN || !DB_URL || !DB_KEY) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.end("Not found");
  }

  const auth = String(req.headers.authorization || "");
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!sameSecret(bearer, FEED_TOKEN)) {
    res.statusCode = 401;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: "unauthorized" }));
  }

  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: "method not allowed" }));
  }

  const resp = await fetch(`${DB_URL}/rest/v1/beta_installs?select=*&order=last_seen.desc`, {
    headers: { apikey: DB_KEY, Authorization: `Bearer ${DB_KEY}` },
  });
  if (!resp.ok) {
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: "upstream", status: resp.status }));
  }
  const rows = await resp.json().catch(() => []);

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.end(JSON.stringify({ generated_at: new Date().toISOString(), count: rows.length, rows }));
}
