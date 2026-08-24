// Mint, list and revoke beta invite links. Operator-only: every call needs
// `Authorization: Bearer <KIT_BETA_ADMIN_TOKEN>`, the same secret that reads the
// beta roster (Peter's alone, never in a build).
//
//   POST   { email, label?, days?=3, max_uses?=5 }  -> { url, expires_at, ... }
//   GET    ?email=<filter>                             -> [ {…}, … ]  (no hashes)
//   DELETE { id } | { email }                          -> revokes
//
// The raw token is generated here, hashed with SHA-256 for storage, and returned
// exactly once inside the invite URL. middleware.js does the verifying.
//
// Env (Vercel project):
//   - KIT_BETA_ADMIN_TOKEN        the operator secret for this endpoint
//   - SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY   as for beta-ping
//   - KIT_SITE_ORIGIN             optional, default https://kit-project.com

const ADMIN = (process.env.KIT_BETA_ADMIN_TOKEN || "").trim();
// Kit's own key. It may mint and list; it may NOT revoke or purge. Handing the
// beta-request playbook the master key would mean a compromised stack could
// wipe every invite, which is a much larger blast radius than it needs to run.
const AGENT = (process.env.KIT_BETA_AGENT_TOKEN || "").trim();
const DB_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(/\/$/, "");
const DB_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const ORIGIN = (process.env.KIT_SITE_ORIGIN || "https://kit-project.com").trim().replace(/\/$/, "");
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

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

async function sha256Hex(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function authed(req, { allowAgent = false } = {}) {
  const h = req.headers["authorization"] || "";
  if (ADMIN && h === `Bearer ${ADMIN}`) return true;
  if (allowAgent && AGENT && h === `Bearer ${AGENT}`) return true;
  return false;
}

async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  // Mint and list are open to Kit's key; DELETE (revoke) is not.
  const mayAgent = req.method === "POST" || req.method === "GET";
  if (!authed(req, { allowAgent: mayAgent })) {
    return res.status(401).json({ error: "operator token required" });
  }
  if (!DB_URL || !DB_KEY) return res.status(503).json({ error: "invite store is not configured" });

  try {
    if (req.method === "POST") {
      const b = await readJson(req);
      const email = String(b.email || "").trim().toLowerCase();
      if (!EMAIL_RE.test(email)) return res.status(422).json({ error: "a valid email is required" });
      // Three days, not thirty (Peter, 2026-08-24). An invite is a door held
      // open, and a month of held-open door is a month of standing invitation
      // to an address that may have moved on. A caller can still ask for more.
      const days = Math.min(Math.max(parseInt(b.days ?? 3, 10) || 3, 1), 365);
      const maxUses = Math.min(Math.max(parseInt(b.max_uses ?? 5, 10) || 5, 1), 50);
      const token = randomToken();
      const row = {
        email,
        label: b.label ? String(b.label).slice(0, 120) : null,
        token_hash: await sha256Hex(token),
        expires_at: new Date(Date.now() + days * 86400e3).toISOString(),
        max_uses: maxUses,
        created_by: b.created_by ? String(b.created_by).slice(0, 60) : "operator",
      };
      const r = await db("beta_invites", { method: "POST", body: JSON.stringify(row), headers: { Prefer: "return=representation" } });
      if (!r.ok) return res.status(502).json({ error: "store refused the invite", detail: await r.text() });
      const [saved] = await r.json();
      return res.status(201).json({
        id: saved.id,
        email,
        label: row.label,
        expires_at: row.expires_at,
        max_uses: maxUses,
        url: `${ORIGIN}/install/?invite=${token}`,
      });
    }

    if (req.method === "GET") {
      const email = String(req.query?.email || "").trim().toLowerCase();
      const q = email ? `beta_invites?email=eq.${encodeURIComponent(email)}&order=created_at.desc` : "beta_invites?order=created_at.desc&limit=200";
      const r = await db(`${q}&select=id,email,label,created_at,expires_at,max_uses,uses,last_used_at,revoked,created_by`);
      if (!r.ok) return res.status(502).json({ error: "store unreadable" });
      return res.status(200).json(await r.json());
    }

    if (req.method === "DELETE") {
      const b = await readJson(req);
      let filter = null;
      if (b.id) filter = `id=eq.${parseInt(b.id, 10)}`;
      else if (b.email && EMAIL_RE.test(String(b.email))) filter = `email=eq.${encodeURIComponent(String(b.email).trim().toLowerCase())}`;
      if (!filter) return res.status(422).json({ error: "id or email required" });
      const r = await db(`beta_invites?${filter}`, { method: "PATCH", body: JSON.stringify({ revoked: true }), headers: { Prefer: "return=representation" } });
      if (!r.ok) return res.status(502).json({ error: "revoke failed" });
      const rows = await r.json();
      return res.status(200).json({ revoked: rows.length });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ error: "method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: "invite handler failed", detail: String(e && e.message || e) });
  }
}
