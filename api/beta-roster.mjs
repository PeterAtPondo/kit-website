// Beta install roster viewer (Vercel serverless function).
//
// DRAFT, not yet wired: written by Kit on 2026-07-22. Review before pushing;
// a push deploys it.
//
// Renders the rows beta-ping.mjs collects: who is running a beta Kit, which
// version, and when they were last seen.
//
// SECURITY, the load-bearing bit: this is gated on KIT_BETA_ADMIN_TOKEN,
// which is NOT the app token. The app token ships inside every macOS build
// and can be read out of the binary, so anything it opens is effectively
// public. It may write a heartbeat; it must never read the user list. With
// no admin token configured this endpoint does not exist at all.
//
// Usage:
//   https://kit-project.com/beta            sign in with the admin password
//   https://kit-project.com/beta?forget=ID  delete a row, once signed in
// Also answers on /api/beta-roster; /beta is a rewrite in vercel.json. A
// ?token= query still works for a bookmark, but the form sets an HttpOnly
// cookie so the secret stays out of history and out of a screen share.
//
// The forget action is the delete story: a beta user asks to come off the
// list and one click removes them, rather than it being a promise we would
// have to write code for later.
//
// Env (kit-website Vercel project):
//   - KIT_BETA_ADMIN_TOKEN  long random string, yours alone, not in any build
//   - SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY  same database beta-ping writes
//     to, injected by the Vercel marketplace integration

const ADMIN_TOKEN = (process.env.KIT_BETA_ADMIN_TOKEN || "").trim();
const DB_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(/\/$/, "");
const DB_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

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

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function ago(iso) {
  if (!iso) return "never";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "unknown";
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function page(rows) {
  const body = rows.length
    ? rows
        .map((r) => {
          // The whole reason both versions are here: when they disagree the
          // app updated and the stack did not, and that install is running
          // older code than its version number claims.
          const skewed = r.app_version && r.stack_version && r.app_version !== r.stack_version;
          const stale = Date.parse(r.last_seen || 0) < Date.now() - 7 * 86400000;
          // Failure evidence the app pushed with its heartbeat: why the
          // update did not land, without asking the operator for logs.
          const failure = r.update_failure && typeof r.update_failure === "object" ? r.update_failure : null;
          const failureRow = failure
            ? `<tr class="skew"><td colspan="8" class="failure"><details>
      <summary>${esc(failure.kind || "update failure")} · ${esc(ago(failure.at))}${failure.detail ? ` · ${esc(failure.detail)}` : ""}</summary>
      <pre>${esc(failure.log_tail || "the report carried no log lines")}</pre>
    </details></td></tr>`
            : "";
          // The structural debug block, one compact line under the row: which
          // runtime, whether anything is crash-looping or the operator simply
          // stopped Kit, and the third version when it disagrees.
          const dbg = r.debug && typeof r.debug === "object" ? r.debug : null;
          const dbgBits = [];
          if (dbg) {
            dbgBits.push(esc(dbg.runtime || "docker"));
            if (dbg.installed_version && dbg.installed_version !== r.app_version)
              dbgBits.push(`installed ${esc(dbg.installed_version)}`);
            if (Array.isArray(dbg.native_processes)) {
              const dead = dbg.native_processes.filter((p) => !p.alive).map((p) => esc(p.name));
              const restarts = dbg.native_processes.reduce((n, p) => n + (p.restarts || 0), 0);
              if (dead.length) dbgBits.push(`down: ${dead.join(", ")}`);
              if (restarts) dbgBits.push(`${restarts} restart${restarts === 1 ? "" : "s"}`);
            }
            if (dbg.health && dbg.health.overall && dbg.health.overall !== "ok")
              dbgBits.push(`health ${esc(dbg.health.overall)}${dbg.health.attention ? ` (${dbg.health.attention})` : ""}`);
            if (dbg.operator_stopped) dbgBits.push("stopped by operator");
          }
          const dbgRow = dbgBits.length > 1 || (dbgBits.length === 1 && dbgBits[0] !== "docker")
            ? `<tr><td colspan="8" class="sub">${dbgBits.join(" · ")}</td></tr>`
            : "";
          return `<tr class="${skewed ? "skew" : ""}">
      <td><strong>${esc(r.operator_name || "unnamed")}</strong><div class="sub">${esc(r.email)}</div></td>
      <td>${esc(r.kit_name || "Kit")}</td>
      <td>${esc(r.app_version || "?")}</td>
      <td>${esc(r.stack_version || "?")}${skewed ? ' <span class="tag">update not applied</span>' : ""}</td>
      <td>${esc((r.surfaces || []).join(", ") || "none")}</td>
      <td class="${stale ? "stale" : ""}">${esc(ago(r.last_seen))}</td>
      <td class="sub">${esc((r.first_seen || "").slice(0, 10))}</td>
      <td><a class="forget" href="?forget=${encodeURIComponent(r.id)}">forget</a></td>
    </tr>${dbgRow}${failureRow}`;
        })
        .join("\n")
    : `<tr><td colspan="8" class="sub">No installs have reported yet.</td></tr>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="robots" content="noindex, nofollow">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Beta installs</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; padding: 32px; background: #0f172a; color: #e2e8f0;
         font: 14px/1.5 ui-sans-serif, -apple-system, system-ui, sans-serif; }
  h1 { font-size: 18px; font-weight: 600; margin: 0 0 4px; }
  .lede { color: #64748b; font-size: 12.5px; margin: 0 0 24px; max-width: 60ch; }
  table { border-collapse: collapse; width: 100%; max-width: 1100px; }
  th { text-align: left; font-size: 11px; font-weight: 500; color: #64748b;
       padding: 0 12px 8px 0; border-bottom: 1px solid rgba(148,163,184,0.18); }
  td { padding: 12px 12px 12px 0; border-bottom: 1px solid rgba(148,163,184,0.08);
       vertical-align: top; }
  .sub { color: #64748b; font-size: 12px; }
  .stale { color: #f0b84d; }
  tr.skew td { background: rgba(240,184,77,0.05); }
  .tag { display: inline-block; margin-left: 6px; padding: 1px 6px; border-radius: 999px;
         font-size: 10.5px; background: rgba(240,184,77,0.14); color: #f0b84d; }
  .forget { color: #64748b; font-size: 12px; text-decoration: none; }
  .forget:hover { color: #f87171; text-decoration: underline; }
  .failure { padding-top: 0; }
  .failure summary { cursor: pointer; color: #f0b84d; font-size: 12px; }
  .failure pre { margin: 8px 0 4px; padding: 10px 12px; border-radius: 10px;
                 background: rgba(0,0,0,0.35); color: #94a3b8; font-size: 11.5px;
                 line-height: 1.5; white-space: pre-wrap; word-break: break-word;
                 max-height: 320px; overflow: auto; }
</style></head>
<body>
  <h1>Beta installs</h1>
  <p class="lede">${rows.length} install${rows.length === 1 ? "" : "s"} reporting.
  A highlighted row means the app updated but the stack did not, so that Kit is
  running older code than its version says. Forget deletes a row outright, which
  is how someone comes off this list when they ask.</p>
  <table>
    <thead><tr><th>Operator</th><th>Kit</th><th>App</th><th>Stack</th>
    <th>Surfaces</th><th>Last seen</th><th>Since</th><th></th></tr></thead>
    <tbody>${body}</tbody>
  </table>
</body></html>`;
}

// Sign-in form, shown instead of the roster until the password checks out.
// Deliberately says nothing about what is behind it.
function signInPage(wrong) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="robots" content="noindex, nofollow">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sign in</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0f172a;
         color: #e2e8f0; font: 14px/1.5 ui-sans-serif, -apple-system, system-ui, sans-serif; }
  form { display: grid; gap: 12px; width: min(320px, 90vw); }
  h1 { font-size: 15px; font-weight: 600; margin: 0; }
  input { padding: 10px 12px; border-radius: 10px; font: inherit; color: inherit;
          background: rgba(255,255,255,0.03); border: 1px solid rgba(148,163,184,0.22); }
  button { padding: 10px 12px; border-radius: 10px; font: inherit; cursor: pointer; border: 0;
           background: rgba(52,211,153,0.16); color: #d9fff0; }
  .err { color: #f87171; font-size: 12.5px; margin: 0; }
</style></head>
<body><form method="POST">
  <h1>Sign in</h1>
  ${wrong ? '<p class="err">That password did not work.</p>' : ""}
  <input type="password" name="password" placeholder="Password" autofocus autocomplete="current-password">
  <button type="submit">Continue</button>
</form></body></html>`;
}

async function readForm(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
}

// Constant-time-ish compare, so a wrong password cannot be narrowed by timing.
function sameSecret(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default async function handler(req, res) {
  const url = new URL(req.url, "https://kit-project.com");

  // Three ways in, in order of preference: an existing session cookie, a form
  // POST that sets one, or ?token= for a bookmark. The cookie is HttpOnly and
  // Secure so the password does not sit in browser history or in a screen
  // share, which the query-string form could not avoid.
  const cookies = String(req.headers.cookie || "");
  const cookieOk = cookies.split(";").some((c) => {
    const [k, ...v] = c.trim().split("=");
    return k === "kit_beta" && sameSecret(decodeURIComponent(v.join("=")), ADMIN_TOKEN);
  });

  if (!ADMIN_TOKEN) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.end("Not found");
  }

  if (req.method === "POST") {
    const form = await readForm(req);
    if (sameSecret((form.get("password") || "").trim(), ADMIN_TOKEN)) {
      res.statusCode = 302;
      res.setHeader("Set-Cookie",
        `kit_beta=${encodeURIComponent(ADMIN_TOKEN)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`);
      // Back to whichever path they signed in on: this page answers on /beta
      // via a rewrite as well as its own /api path.
      res.setHeader("Location", url.pathname);
      return res.end();
    }
    res.statusCode = 401;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.end(signInPage(true));
  }

  const token = (url.searchParams.get("token") || "").trim();
  if (!cookieOk && !sameSecret(token, ADMIN_TOKEN)) {
    res.statusCode = 401;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.end(signInPage(false));
  }

  const forget = (url.searchParams.get("forget") || "").trim();
  if (/^[a-f0-9]{8,64}$/.test(forget)) {
    await db(`beta_installs?id=eq.${encodeURIComponent(forget)}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    });
    res.statusCode = 302;
    res.setHeader("Location", url.pathname);
    return res.end();
  }

  // Newest first, straight from the database rather than sorted here.
  const rows = (await db("beta_installs?select=*&order=last_seen.desc")) || [];

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  return res.end(page(rows));
}
