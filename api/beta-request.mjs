// Beta access requests: the record, the feed, and the decision writeback.
//
// Written by Kit on 2026-08-20, the evening the soft launch went out. Until
// now /install/request/ posted straight to Formspree: Peter got an email, Kit
// got nothing, and answering a request was hand work every time. This is the
// front door of the beta-request playbook.
//
// Three verbs, three audiences, three keys -- the same tiering as beta-feed:
//   POST   (no auth)                  the form. Records a request.
//   GET    KIT_BETA_FEED_TOKEN        canonical Kit. Reads what is waiting.
//   PATCH  KIT_BETA_AGENT_TOKEN       the decision writeback (Kit's own key;
//                                     Peter's admin token also works).
// A leaked feed token exposes who has asked for an invite and nothing else; it
// cannot decide anything and it cannot mint.
//
// POST also forwards to Formspree, so Peter's existing email notification
// survives untouched. That forward is best-effort and never fails the request:
// if Formspree is down the row is still written, and if this table is
// unreachable Formspree still reaches Peter. Neither path can silently eat a
// request on its own.
//
// Env (Vercel project):
//   - SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY   as for beta-invite
//   - KIT_BETA_FEED_TOKEN     read-only, held by canonical Kit
//   - KIT_BETA_AGENT_TOKEN    Kit's own; may mint, mail and write decisions
//   - KIT_BETA_ADMIN_TOKEN    Peter's; everything the agent key can do, plus revoke
//   - KIT_FORMSPREE_ENDPOINT  optional; the parallel notification

const FEED_TOKEN = (process.env.KIT_BETA_FEED_TOKEN || "").trim();
const ADMIN = (process.env.KIT_BETA_ADMIN_TOKEN || "").trim();
const AGENT = (process.env.KIT_BETA_AGENT_TOKEN || "").trim();
const DB_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(/\/$/, "");
const DB_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const FORMSPREE = (process.env.KIT_FORMSPREE_ENDPOINT || "https://formspree.io/f/xzdwawzg").trim();
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Field caps. Generous enough that nobody with something real to say hits
// them, small enough that the table cannot be used as free storage.
const LIMITS = { name: 120, email: 200, mac: 40, tools: 400, message: 4000, source: 80, user_agent: 400 };

const db = (path, init = {}) =>
  fetch(`${DB_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: DB_KEY,
      Authorization: `Bearer ${DB_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

// Constant-time-ish compare, same reasoning as beta-roster.mjs.
function sameSecret(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function bearer(req) {
  const h = req.headers["authorization"] || "";
  return h.startsWith("Bearer ") ? h.slice(7) : "";
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  let raw = "";
  for await (const chunk of req) raw += chunk;
  if (!raw) return {};
  // The no-JS fallback submits as a normal form post, not JSON.
  const type = (req.headers["content-type"] || "").toLowerCase();
  if (type.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(raw));
  }
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

const clean = (v, max) =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : null;

// ── POST: a person asks for an invite ──────────────────────────────────────
async function record(req, res) {
  const body = await readBody(req);

  // Honeypot. Bots fill every field they find; a human never sees this one.
  // Answer 200 rather than 400 so a bot learns nothing from the difference.
  if (clean(body._gotcha, 200)) return res.status(200).json({ ok: true });

  const name = clean(body.name, LIMITS.name);
  const email = clean(body.email, LIMITS.email);
  if (!name) return res.status(400).json({ ok: false, error: "a name is required" });
  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ ok: false, error: "a valid email is required" });
  }

  const row = {
    name,
    email,
    mac: clean(body.mac, LIMITS.mac),
    tools: clean(body.tools, LIMITS.tools),
    message: clean(body.message, LIMITS.message),
    source: clean(body.source, LIMITS.source) || "install/request",
    user_agent: clean(req.headers["user-agent"], LIMITS.user_agent),
    country: clean(req.headers["x-vercel-ip-country"], 8),
  };

  // Formspree first and unawaited-for-failure: it is the path that already
  // works, and it must not be held up by anything new.
  const notified = FORMSPREE
    ? fetch(FORMSPREE, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ ...body, _subject: "Kit, beta access request" }),
      }).catch(() => null)
    : Promise.resolve(null);

  let recorded = false;
  let detail = null;
  if (DB_URL && DB_KEY) {
    try {
      const r = await db("beta_requests", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(row),
      });
      if (r.ok) {
        recorded = true;
      } else {
        const text = await r.text();
        // 23505 is the one-open-request-per-address index. Not an error: the
        // person is asking again while their first is still open, so refresh
        // what they said rather than queueing a second card for Peter.
        if (r.status === 409 || text.includes("beta_requests_one_open_per_email")) {
          const upd = await db(
            `beta_requests?email=eq.${encodeURIComponent(email)}&status=in.(new,notified)`,
            { method: "PATCH", body: JSON.stringify({ ...row, status: "new", notified_at: null }) }
          );
          recorded = upd.ok;
          if (!upd.ok) detail = `refresh failed: ${upd.status}`;
        } else {
          detail = `insert failed: ${r.status} ${text.slice(0, 200)}`;
        }
      }
    } catch (err) {
      detail = String(err).slice(0, 200);
    }
  } else {
    detail = "request store is not configured";
  }

  const sent = await notified;
  if (!recorded) {
    // Say so in the logs, but do not fail the person's submission when
    // Formspree took it: from where they stand the request WAS received.
    console.error(`[beta-request] not recorded (${detail}); formspree=${sent ? sent.status : "skipped"}`);
    if (!sent || !sent.ok) {
      return res.status(503).json({ ok: false, error: "could not receive that just now" });
    }
  }

  // The no-JS fallback posts the form directly and needs somewhere to land.
  const type = (req.headers["content-type"] || "").toLowerCase();
  if (type.includes("application/x-www-form-urlencoded")) {
    res.setHeader("Location", "/install/request/?sent=1");
    return res.status(303).end();
  }
  return res.status(200).json({ ok: true });
}

// ── GET: what is waiting (canonical Kit) ───────────────────────────────────
async function feed(req, res) {
  const status = String(req.query?.status || "new,notified");
  const limit = Math.min(parseInt(String(req.query?.limit || "50"), 10) || 50, 200);
  const inList = status
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .join(",");
  const r = await db(
    `beta_requests?status=in.(${inList})&order=created_at.asc&limit=${limit}`,
    { method: "GET" }
  );
  if (!r.ok) return res.status(502).json({ error: `request store said ${r.status}` });
  return res.status(200).json({ rows: await r.json() });
}

// ── PATCH: the decision writeback (Peter's key) ────────────────────────────
async function decide(req, res) {
  const body = await readBody(req);
  const id = parseInt(String(body.id || ""), 10);
  if (!id) return res.status(400).json({ error: "id is required" });

  const allowed = ["status", "notes", "invite_id", "decided_by", "notified_at", "decided_at", "mail_sent_at"];
  const patch = {};
  for (const k of allowed) if (body[k] !== undefined) patch[k] = body[k];
  if (!Object.keys(patch).length) return res.status(400).json({ error: "nothing to change" });

  // Stamp the clock here rather than trusting a caller's idea of now.
  const now = new Date().toISOString();
  if (patch.status === "notified" && patch.notified_at === undefined) patch.notified_at = now;
  if ((patch.status === "approved" || patch.status === "declined") && patch.decided_at === undefined) {
    patch.decided_at = now;
  }

  const r = await db(`beta_requests?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(patch),
  });
  if (!r.ok) return res.status(502).json({ error: `request store said ${r.status}` });
  const rows = await r.json();
  if (!rows.length) return res.status(404).json({ error: `no request ${id}` });
  return res.status(200).json({ row: rows[0] });
}

export default async function handler(req, res) {
  // A visitor can be on www.kit-project.com: Vercel's host redirect covers /api
  // but not the static pages, so the page loads on www and its POST crosses
  // origins. Without these headers the preflight died with a bare 405 and both
  // Chrome and Safari showed "Something went wrong" while curl sailed through
  // (2026-08-27, found because the operator's own request failed). The form now
  // posts to the apex absolutely; this is the other half, so an already-open
  // www tab works too.
  const origin = String(req.headers.origin || "");
  if (origin === "https://kit-project.com" || origin === "https://www.kit-project.com") {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
    res.setHeader("Access-Control-Max-Age", "86400");
    return res.status(204).end();
  }

  res.setHeader("Cache-Control", "no-store");

  if (req.method === "POST") return record(req, res);

  if (!DB_URL || !DB_KEY) return res.status(503).json({ error: "request store is not configured" });

  if (req.method === "GET") {
    if (!FEED_TOKEN || !sameSecret(bearer(req), FEED_TOKEN)) {
      // The admin key reads too: one fewer secret for Peter to carry.
      if (!sameSecret(bearer(req), ADMIN) && !sameSecret(bearer(req), AGENT)) {
        return res.status(401).json({ error: "feed token required" });
      }
    }
    return feed(req, res);
  }

  if (req.method === "PATCH") {
    if (!sameSecret(bearer(req), ADMIN) && !sameSecret(bearer(req), AGENT)) {
      return res.status(401).json({ error: "operator token required" });
    }
    return decide(req, res);
  }

  res.setHeader("Allow", "POST, GET, PATCH");
  return res.status(405).json({ error: "method not allowed" });
}
