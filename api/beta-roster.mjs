// Beta install roster viewer (Vercel serverless function).
//
// DRAFT, not yet wired: written by Kit on 2026-07-22. Review before pushing;
// a push deploys it.
//
// Renders the rows beta-ping.mjs collects: who is running a beta Kit, which
// version, when they were last seen, and, since 2026-08-22, what its own
// health checks and dream cycle say about it. The Lantern had been sending
// that last part for weeks while the receiver dropped it and this page had
// nowhere to put it; the roster now answers "who needs help, and why",
// not just "who is out there".
//
// SECURITY, the load-bearing bit: this is gated on KIT_BETA_ADMIN_TOKEN,
// which is NOT the app token. The app token ships inside every macOS build
// and can be read out of the binary, so anything it opens is effectively
// public. It may write a heartbeat; it must never read the user list. With
// no admin token configured this endpoint does not exist at all.
//
// Usage:
//   https://kit-project.com/beta             sign in with the admin password
//   https://kit-project.com/beta?forget=ID   delete an install row
//   https://kit-project.com/beta?revoke=ID   kill an invite link
//   https://kit-project.com/beta?archive=ID  hide a dead invite from the list
//   https://kit-project.com/beta?restore=ID  put an archived invite back
//   https://kit-project.com/beta?show=archived   the archived invites
//   the Invites section mints new personal install links, sweeps the dead
//   ones out of sight, and deletes single rows outright
// Also answers on /api/beta-roster; /beta is a rewrite in vercel.json. A
// ?token= query still works for a bookmark, but the form sets an HttpOnly
// cookie so the secret stays out of history and out of a screen share.
//
// Destructive actions (delete an invite, sweep the dead ones) are POST
// buttons rather than links on purpose: a link a browser may prefetch or a
// bookmark may replay is the wrong shape for something that cannot be undone.
// Revoke, archive and restore are all reversible, so they stay plain links.
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

// Columns the invite list needs, without token_hash: the page never wants the
// hash and a query that cannot ask for it cannot leak it.
const INVITE_COLS = "id,email,label,created_at,expires_at,max_uses,uses,last_used_at,revoked,created_by";

async function dbRaw(path, init = {}) {
  if (!DB_URL || !DB_KEY) return { ok: false, status: 0, data: null };
  const resp = await fetch(`${DB_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: DB_KEY,
      Authorization: `Bearer ${DB_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const data = resp.status === 204 ? [] : await resp.json().catch(() => null);
  return { ok: resp.ok, status: resp.status, data };
}

// Everything except loadInvites wants the old contract: rows, or null.
async function db(path, init = {}) {
  const r = await dbRaw(path, init);
  return r.ok ? r.data : null;
}

// The archive column arrives by hand, the same way beta_installs' debug column
// did: Peter pastes beta_invites.sql into the Supabase SQL editor. Until he
// has, asking for archived_at is a 400 and db() returns null, which would show
// an empty invite list and read as "everything is gone". So: try the
// archive-aware query, fall back to the old one, and tell the page which it
// got so it can hide actions that would not work yet.
async function loadInvites() {
  const first = await dbRaw(`beta_invites?select=${INVITE_COLS},archived_at&order=created_at.desc&limit=500`);
  if (first.ok) return { invites: first.data || [], archiveReady: true };
  const plain = await db(`beta_invites?select=${INVITE_COLS}&order=created_at.desc&limit=500`);
  // 400 is PostgREST refusing an unknown column, which is the not-yet-migrated
  // case and the only one worth telling the operator to go and fix. A 500 or a
  // timeout is the store being unwell, and telling him to paste SQL he already
  // pasted would send him the wrong way.
  return { invites: plain || [], archiveReady: first.status !== 400 };
}

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Buffer.from(bytes).toString("base64url");
}

// Everything the page renders goes through this, including the numbers. The
// use counter and the budget were the one pair that did not (they are integer
// columns, so it looked safe), and "the schema says it is a number" is a
// weaker promise than escaping it: the roster is the one page that renders
// strings a beta operator's machine chose, and it should not have an
// exception in it at all.
function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// A value bound for a JavaScript string inside an HTML attribute. JSON does
// the JS-literal escaping, esc() does the attribute escaping, and the browser
// undoes exactly the second one before JS sees it.
const jsAttr = (v) => esc(JSON.stringify(String(v ?? "")));

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

// An invite is dead when it cannot let anyone in again: revoked by hand, past
// its expiry, or out of uses. Dead is what "sweep" and "archive" act on, and
// what the tag on the row says.
function inviteState(i) {
  if (i.revoked) return "revoked";
  if (Date.parse(i.expires_at) < Date.now()) return "expired";
  if (i.uses >= i.max_uses) return "spent";
  return "";
}

// ── The metrics the Lantern sends, read the same way everywhere ───────────
// One reader per fact, so the triage strip at the top and the row below it
// can never disagree about who is in trouble.
const debugOf = (r) => (r.debug && typeof r.debug === "object" ? r.debug : null);
const healthOf = (r) => {
  const d = debugOf(r);
  return d && d.health && typeof d.health === "object" ? d.health : null;
};
const dreamOf = (r) => {
  const d = debugOf(r);
  return d && d.dream && typeof d.dream === "object" ? d.dream : null;
};
const failureOf = (r, key) => {
  const v = key === "update" ? r.update_failure : (debugOf(r) || {}).last_failure;
  return v && typeof v === "object" ? v : null;
};

const isStale = (r) => Date.parse(r.last_seen || 0) < Date.now() - 7 * 86400000;
const isSkewed = (r) => Boolean(r.app_version && r.stack_version && r.app_version !== r.stack_version);
function needsAttention(r) {
  const h = healthOf(r);
  if (!h) return false;
  return h.overall === "down" || h.overall === "degraded" || Number(h.attention) > 0;
}
// Dream trouble in two grades. A cycle that quietly never finishes shows up
// only as rising age, which is why the age matters as much as the failures.
function dreamTrouble(r) {
  const d = dreamOf(r);
  if (!d) return "";
  const age = Number(d.last_completed_age_days);
  const failures = Number(d.consecutive_failures) || 0;
  if (age >= 7 || failures >= 3) return "bad";
  if (age >= 2 || failures >= 1) return "warn";
  return "";
}

function page(rows, invites, opts = {}) {
  const { minted = null, showArchived = false, archiveReady = true } = opts;

  const body = rows.length
    ? rows
        .map((r) => {
          // The whole reason both versions are here: when they disagree the
          // app updated and the stack did not, and that install is running
          // older code than its version number claims.
          const skewed = isSkewed(r);
          const stale = isStale(r);
          const health = healthOf(r);
          const dream = dreamOf(r);
          const dreamTone = dreamTrouble(r);
          // The card's colour is the grade, not the cause: red means this Kit
          // says it is down, amber means it wants a look (its checks are
          // degraded, or it is running older code than it claims). The cause
          // is on the row itself, in the health pill and the skew tag.
          const sick = Boolean(health && health.overall === "down");
          const wants = !sick && (skewed || Boolean(health && (health.overall === "degraded" || Number(health.attention) > 0)));

          // Health, in its own column, because it is the thing worth scanning
          // a list of installs for. The count was all we ever had; the names
          // and the check's own words are what makes it actionable.
          let healthCell = '<span class="sub">?</span>';
          if (health) {
            const n = Number(health.attention) || 0;
            const tone = health.overall === "down" ? "bad"
              : (health.overall === "degraded" || n > 0) ? "warn"
              : health.overall === "ok" ? "good"
              : "calm";
            healthCell = `<span class="pill ${tone}">${esc(health.overall || "unknown")}${n ? ` ${n}` : ""}</span>`;
          }

          // Failure evidence the app pushed with its heartbeat: why the
          // update did not land, or what crashed at 03:00, without asking the
          // operator for logs. Same shape, same block, different label.
          const failureRow = (key, label) => {
            const f = failureOf(r, key);
            if (!f) return "";
            return `<tr><td colspan="9" class="failure"><details>
      <summary>${esc(label)}: ${esc(f.kind || "failure")} · ${esc(ago(f.at))}${f.detail ? ` · ${esc(f.detail)}` : ""}</summary>
      <pre>${esc(f.log_tail || "the report carried no log lines")}</pre>
    </details></td></tr>`;
          };

          // The structural debug block, one compact line under the row: which
          // runtime, whether anything is crash-looping or the operator simply
          // stopped Kit, the third version when it disagrees, and how the
          // nightly dream cycle is doing.
          const dbg = debugOf(r);
          const dbgBits = [];
          if (dbg) {
            dbgBits.push(esc(dbg.runtime || "docker"));
            if (dbg.installed_version && dbg.installed_version !== r.app_version)
              dbgBits.push(`installed ${esc(dbg.installed_version)}`);
            if (Array.isArray(dbg.native_processes)) {
              const dead = dbg.native_processes.filter((p) => !p.alive).map((p) => esc(p.name));
              const restarts = dbg.native_processes.reduce((n, p) => n + (p.restarts || 0), 0);
              if (dead.length) dbgBits.push(`<span class="bit bad">down: ${dead.join(", ")}</span>`);
              if (restarts) dbgBits.push(`<span class="bit warn">${restarts} restart${restarts === 1 ? "" : "s"}</span>`);
            }
            if (dream) {
              const parts = [];
              if (dream.last_completed_age_days !== undefined && dream.last_completed_age_days !== null)
                parts.push(`last dream ${esc(dream.last_completed_age_days)}d ago`);
              else parts.push("no dream has finished yet");
              if (Number(dream.consecutive_failures) > 0)
                parts.push(`${Number(dream.consecutive_failures)} failed in a row`);
              dbgBits.push(dreamTone
                ? `<span class="bit ${dreamTone}">${parts.join(", ")}</span>`
                : parts.join(", "));
            }
            if (dbg.operator_stopped) dbgBits.push('<span class="bit">stopped by operator</span>');
          }
          const dbgRow = dbgBits.length > 1 || (dbgBits.length === 1 && dbgBits[0] !== "docker")
            ? `<tr><td colspan="9" class="sub">${dbgBits.join(" · ")}</td></tr>`
            : "";

          // Which checks are unhappy, and what each one says about itself.
          // A count alone could not be acted on: three installs sat degraded
          // for weeks and nobody could name the fault without emailing their
          // owner (2026-08-21). Summary and remedy are Kit's own words about
          // its own machinery; nothing the operator wrote reaches this page.
          let checksRow = "";
          if (health && (Number(health.attention) > 0 || health.overall === "down" || health.overall === "degraded")) {
            const summaries = Array.isArray(health.attention_summaries) ? health.attention_summaries : [];
            const ids = Array.isArray(health.attention_ids) && health.attention_ids.length
              ? health.attention_ids
              : summaries.map((c) => c.id);
            const n = Number(health.attention) || ids.length;
            const checks = n === 1 ? "1 check wants a look" : `${n} checks want a look`;
            const heading = ids.length ? `${checks}: ${ids.map(esc).join(", ")}` : checks;
            const detail = summaries.length
              ? `<ul class="checklist">${summaries.map((c) => `<li>
        <strong>${esc(c.id)}</strong>${c.status ? ` <span class="pill ${c.status === "down" ? "bad" : "warn"}">${esc(c.status)}</span>` : ""}
        ${c.summary ? `<div>${esc(c.summary)}</div>` : ""}
        ${c.remedy ? `<div class="fix">${esc(c.remedy)}</div>` : ""}
      </li>`).join("")}</ul>`
              // No names means this operator is on a build or a terms version
              // that does not send them yet. Say which, rather than showing a
              // bare number and leaving it looking like a bug.
              : `<p class="sub">This install sends the count but not the names. That arrives once it is on 0.2.200 or later and its operator has accepted the 2026-08-21 terms.</p>`;
            checksRow = `<tr><td colspan="9" class="checks"><details>
      <summary>${heading}</summary>
      ${detail}
    </details></td></tr>`;
          }

          // One tbody per install, so the debug line and the failure block sit
          // inside the same container as the operator they describe. They used
          // to be loose sibling rows separated only by a hairline, and with a
          // few installs reporting it was guesswork which detail belonged to
          // whom (Peter, 2026-08-03). A table group keeps the columns aligned
          // while giving each install a real edge.
          return `<tbody class="install${sick ? " sick" : wants ? " skew" : ""}">
    <tr>
      <td><strong>${esc(r.operator_name || "unnamed")}</strong><div class="sub">${esc(r.email)}</div></td>
      <td>${esc(r.kit_name || "Kit")}</td>
      <td>${esc(r.app_version || "?")}</td>
      <td>${esc(r.stack_version || "?")}${skewed ? ' <span class="tag">update not applied</span>' : ""}</td>
      <td>${esc((r.surfaces || []).join(", ") || "none")}</td>
      <td>${healthCell}</td>
      <td class="${stale ? "stale" : ""}">${esc(ago(r.last_seen))}</td>
      <td class="sub">${esc((r.first_seen || "").slice(0, 10))}</td>
      <td><a class="forget" href="?forget=${encodeURIComponent(r.id)}">forget</a></td>
    </tr>${dbgRow}${checksRow}${failureRow("update", "update failed")}${failureRow("runtime", "crash")}
  </tbody>`;
        })
        .join('\n<tbody class="gap"><tr><td colspan="9"></td></tr></tbody>\n')
    : `<tbody class="install"><tr><td colspan="9" class="sub">No installs have reported yet.</td></tr></tbody>`;

  // Triage strip: the whole list in one line, so the answer to "does anyone
  // need me today" does not require reading every row. Only trouble shows up
  // here; a quiet fleet shows nothing but its own size.
  const counts = [
    [rows.filter(needsAttention).length, "needs attention", "need attention", "warn"],
    [rows.filter((r) => dreamTrouble(r)).length, "dream stalled", "dreams stalled", "warn"],
    [rows.filter(isSkewed).length, "update not applied", "updates not applied", "warn"],
    [rows.filter((r) => failureOf(r, "update") || failureOf(r, "runtime")).length, "crash reported", "crashes reported", "bad"],
    [rows.filter(isStale).length, "quiet for a week", "quiet for a week", "calm"],
    [rows.filter((r) => (debugOf(r) || {}).operator_stopped).length, "stopped by its operator", "stopped by their operators", "calm"],
  ].filter(([n]) => n > 0);
  const strip = `<div class="strip">
    <span class="pill calm">${rows.length} install${rows.length === 1 ? "" : "s"}</span>
    ${counts.map(([n, one, many, tone]) => `<span class="pill ${tone}">${n} ${esc(n === 1 ? one : many)}</span>`).join("")}
    ${counts.length ? "" : '<span class="pill good">all quiet</span>'}
  </div>`;

  // Live and archived are split here rather than in the query, so the toggle
  // can say how many are hidden without a second round trip.
  const archivedRows = archiveReady ? invites.filter((i) => i.archived_at) : [];
  const liveRows = archiveReady ? invites.filter((i) => !i.archived_at) : invites;
  const shown = showArchived ? archivedRows : liveRows;
  const deadIds = liveRows.filter((i) => inviteState(i)).map((i) => Number(i.id)).filter(Number.isFinite);

  const inviteBody = shown.length
    ? shown.map((i) => {
        const why = inviteState(i);
        const dead = Boolean(why);
        const archived = Boolean(i.archived_at);
        // Reversible on the left as links, permanent on the right as a POST.
        const actions = [];
        if (!dead && !archived) actions.push(`<a class="forget" href="?revoke=${esc(i.id)}">revoke</a>`);
        if (archiveReady && dead && !archived) actions.push(`<a class="forget" href="?archive=${esc(i.id)}">archive</a>`);
        if (archiveReady && archived) actions.push(`<a class="forget" href="?restore=${esc(i.id)}${showArchived ? "&amp;show=archived" : ""}">restore</a>`);
        actions.push(`<form method="POST" class="inline">
        ${showArchived ? '<input type="hidden" name="show" value="archived">' : ""}
        <input type="hidden" name="delete_invite" value="${esc(i.id)}">
        <button type="submit" class="linkish" onclick="return confirm(${jsAttr(`Delete the invite for ${i.email}? This cannot be undone.`)})">delete</button>
      </form>`);
        return `<tbody class="install${dead || archived ? " dead" : ""}"><tr>
      <td><strong>${esc(i.email)}</strong></td>
      <td class="sub">${esc(i.label || "")}</td>
      <td>${esc(i.uses)} / ${esc(i.max_uses)}</td>
      <td class="sub">${esc(String(i.expires_at).slice(0, 10))}${why ? ` <span class="tag">${why}</span>` : ""}</td>
      <td class="sub">${esc(ago(i.last_used_at))}</td>
      <td class="sub">${esc(String(i.created_at).slice(0, 10))}${i.created_by ? ` · ${esc(i.created_by)}` : ""}</td>
      <td class="actions">${actions.join("")}</td>
    </tr></tbody>`;
      }).join("")
    : `<tbody class="install"><tr><td colspan="7" class="sub">${showArchived ? "Nothing archived." : "No invites yet."}</td></tr></tbody>`;

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
  .lede { color: #64748b; font-size: 12.5px; margin: 0 0 16px; max-width: 60ch; }
  /* Separate borders so each cell keeps its own edge and radius (collapse
     drops both), but zero spacing: border-spacing cannot tell a gap BETWEEN
     installs from a gap between the rows OF one install, and spacing them
     alike is what made the debug and failure lines look detached from the
     operator they belong to. The gap is an explicit spacer group instead. */
  .scroller { max-width: 1200px; overflow-x: auto; }
  table { border-collapse: separate; border-spacing: 0; width: 100%; min-width: 860px; }
  tbody.gap td { height: 10px; padding: 0; background: transparent; border: 0; }
  th { text-align: left; font-size: 11px; font-weight: 500; color: #64748b;
       padding: 0 12px 8px 12px; }
  td { padding: 10px 12px; vertical-align: top; }
  /* The container: one card per install, holding its own debug, checks and
     failure rows. Left accent plus a filled panel, so where one install ends
     and the next begins is obvious at a glance. */
  tbody.install td { background: rgba(148,163,184,0.05);
                     border-top: 1px solid rgba(148,163,184,0.10);
                     border-bottom: 1px solid rgba(148,163,184,0.10); }
  tbody.install tr:not(:last-child) td { border-bottom-color: transparent; }
  tbody.install tr:not(:first-child) td { border-top-color: transparent; }
  tbody.install td:first-child { border-left: 2px solid rgba(148,163,184,0.22); }
  tbody.install td:last-child { border-right: 1px solid rgba(148,163,184,0.10); }
  tbody.install tr:first-child td:first-child { border-top-left-radius: 10px; }
  tbody.install tr:first-child td:last-child { border-top-right-radius: 10px; }
  tbody.install tr:last-child td:first-child { border-bottom-left-radius: 10px; }
  tbody.install tr:last-child td:last-child { border-bottom-right-radius: 10px; }
  .sub { color: #64748b; font-size: 12px; }
  .stale { color: #f0b84d; }
  /* The tint is on the whole card, not one row of it: the point is that THIS
     install needs something. Amber is "wants a look" (degraded checks, or
     running older code than it claims), red is "says it is down". */
  tbody.install.skew td { background: rgba(240,184,77,0.06); }
  tbody.install.skew td:first-child { border-left-color: rgba(240,184,77,0.55); }
  tbody.install.sick td { background: rgba(248,113,113,0.07); }
  tbody.install.sick td:first-child { border-left-color: rgba(248,113,113,0.6); }
  .tag { display: inline-block; margin-left: 6px; padding: 1px 6px; border-radius: 999px;
         font-size: 10.5px; background: rgba(240,184,77,0.14); color: #f0b84d; }
  /* One pill vocabulary for the triage strip, the health column and the check
     statuses, so the same colour means the same thing everywhere on the page. */
  .strip { display: flex; gap: 8px; flex-wrap: wrap; margin: 0 0 18px; max-width: 1200px; }
  .pill { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 11.5px;
          background: rgba(148,163,184,0.12); color: #94a3b8; white-space: nowrap; }
  .pill.good { background: rgba(52,211,153,0.13); color: #6ee7b7; }
  .pill.warn { background: rgba(240,184,77,0.14); color: #f0b84d; }
  .pill.bad  { background: rgba(248,113,113,0.14); color: #fca5a5; }
  .pill.calm { background: rgba(148,163,184,0.12); color: #94a3b8; }
  .bit.warn { color: #f0b84d; }
  .bit.bad  { color: #fca5a5; }
  .forget { color: #64748b; font-size: 12px; text-decoration: none; }
  .forget:hover { color: #f87171; text-decoration: underline; }
  .actions { white-space: nowrap; }
  .actions > * + * { margin-left: 10px; }
  form.inline { display: inline; }
  /* A button that reads as a link, so a POST can sit in a row of links
     without announcing itself as a different kind of control. */
  .linkish { padding: 0; border: 0; background: none; font: inherit; font-size: 12px;
             color: #64748b; cursor: pointer; }
  .linkish:hover { color: #f87171; text-decoration: underline; }
  .bar { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; margin: 0 0 12px; }
  .bar .sub { margin: 0; }
  .mint { display: flex; gap: 8px; flex-wrap: wrap; margin: 0 0 16px; max-width: 1200px; }
  .mint input { padding: 8px 10px; border-radius: 8px; font: inherit; color: inherit;
                background: rgba(255,255,255,0.03); border: 1px solid rgba(148,163,184,0.22); }
  .mint input[type=email] { flex: 1 1 240px; }
  .mint input[type=text] { flex: 1 1 200px; }
  .mint input[type=number] { width: 72px; }
  .mint button { padding: 8px 14px; border-radius: 8px; font: inherit; cursor: pointer; border: 0;
                 background: rgba(52,211,153,0.16); color: #d9fff0; }
  .minted { margin: 0 0 16px; padding: 12px 14px; border-radius: 10px; max-width: 1200px;
            background: rgba(52,211,153,0.08); border: 1px solid rgba(52,211,153,0.35); }
  .minted code { display: block; margin-top: 6px; user-select: all; word-break: break-all;
                 color: #d9fff0; font-size: 12.5px; }
  tbody.install.dead td { opacity: 0.55; }
  .failure, .checks { padding-top: 0; }
  .failure summary { cursor: pointer; color: #f0b84d; font-size: 12px; }
  .checks summary { cursor: pointer; color: #f0b84d; font-size: 12px; }
  .failure pre { margin: 8px 0 4px; padding: 10px 12px; border-radius: 10px;
                 background: rgba(0,0,0,0.35); color: #94a3b8; font-size: 11.5px;
                 line-height: 1.5; white-space: pre-wrap; word-break: break-word;
                 max-height: 320px; overflow: auto; }
  .checklist { margin: 8px 0 4px; padding: 0 0 0 2px; list-style: none; }
  .checklist li { margin: 0 0 8px; padding: 8px 12px; border-radius: 10px;
                  background: rgba(0,0,0,0.25); font-size: 12px; color: #cbd5e1; }
  .checklist li:last-child { margin-bottom: 0; }
  .checklist .fix { margin-top: 4px; color: #6ee7b7; }
  .checklist .fix::before { content: "fix: "; color: #64748b; }
</style></head>
<body>
  <h1>Beta installs</h1>
  <p class="lede">A highlighted row means the app updated but the stack did not, so that Kit
  is running older code than its version says; a red one means its own health checks say it is
  down. Open a row's summary to read which check is unhappy, in Kit's own words. Forget deletes
  a row outright, which is how someone comes off this list when they ask.</p>
  ${strip}
  <div class="scroller"><table>
    <thead><tr><th>Operator</th><th>Kit</th><th>App</th><th>Stack</th>
    <th>Surfaces</th><th>Health</th><th>Last seen</th><th>Since</th><th></th></tr></thead>
    ${body}
  </table></div>

  <h1 style="margin-top:40px">Invites</h1>
  <p class="lede">Each invite is a personal link to the install page: one owner, an expiry, a small
  use budget so a forwarded link dies after a few clicks, and revoke, which kills it at once.
  Mint one here and send the link yourself, or ask Kit to.</p>
  ${minted ? `<div class="minted"><div class="sub">Invite for ${esc(minted.email)}, ${minted.max_uses} uses, expires ${esc(minted.expires_at.slice(0, 10))}. Shown once; copy it now.</div>
    <code>${esc(minted.url)}</code></div>` : ""}
  <form method="POST" class="mint">
    <input type="email" name="mint_email" placeholder="email" required>
    <input type="text" name="mint_label" placeholder="label (optional)">
    <input type="number" name="mint_days" value="30" min="1" max="365" title="days">
    <input type="number" name="mint_uses" value="5" min="1" max="50" title="uses">
    <button type="submit">Mint invite</button>
  </form>
  <div class="bar">
    <span class="sub">${showArchived
      ? `${archivedRows.length} archived invite${archivedRows.length === 1 ? "" : "s"}`
      : `${liveRows.length} invite${liveRows.length === 1 ? "" : "s"}${deadIds.length ? `, ${deadIds.length} dead` : ""}`}</span>
    ${archiveReady && !showArchived && deadIds.length ? `<form method="POST" class="inline">
      <input type="hidden" name="sweep" value="dead">
      <button type="submit" class="linkish" onclick="return confirm(${jsAttr(`Archive ${deadIds.length} dead invite${deadIds.length === 1 ? "" : "s"}? They stay in the database, just out of this list.`)})">sweep the dead ones</button>
    </form>` : ""}
    ${archiveReady ? (showArchived
      ? '<a class="forget" href="?">back to live invites</a>'
      : (archivedRows.length ? `<a class="forget" href="?show=archived">show ${archivedRows.length} archived</a>` : ""))
      : '<span class="sub">Archiving needs the archived_at column: paste api/beta_invites.sql into the Supabase SQL editor.</span>'}
  </div>
  <div class="scroller"><table>
    <thead><tr><th>Email</th><th>Label</th><th>Uses</th><th>Expires</th><th>Last used</th><th>Made</th><th></th></tr></thead>
    ${inviteBody}
  </table></div>
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

// Everything the page needs, in one place, so the GET path and the POST path
// cannot drift into showing different things.
async function render(opts = {}) {
  const rows = (await db("beta_installs?select=*&order=last_seen.desc")) || [];
  const { invites, archiveReady } = await loadInvites();
  return page(rows, invites, { ...opts, archiveReady });
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

  const html = (body, status = 200) => {
    res.statusCode = status;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.end(body);
  };
  // Post/redirect/get, so a refresh after an action does not replay it.
  const back = (query = "") => {
    res.statusCode = 302;
    res.setHeader("Location", url.pathname + query);
    return res.end();
  };

  if (req.method === "POST") {
    const form = await readForm(req);
    const showArchived = form.get("show") === "archived";
    const suffix = showArchived ? "?show=archived" : "";

    // Signed-in operator minting an invite: insert the hash, render the page
    // once with the raw link (it is never stored and never shown again).
    if (cookieOk && form.get("mint_email")) {
      const email = String(form.get("mint_email") || "").trim().toLowerCase();
      const days = Math.min(Math.max(parseInt(form.get("mint_days") || "30", 10) || 30, 1), 365);
      const maxUses = Math.min(Math.max(parseInt(form.get("mint_uses") || "5", 10) || 5, 1), 50);
      let minted = null;
      if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        const token = randomToken();
        const row = {
          email,
          label: (form.get("mint_label") || "").trim().slice(0, 120) || null,
          token_hash: await sha256Hex(token),
          expires_at: new Date(Date.now() + days * 86400e3).toISOString(),
          max_uses: maxUses,
          created_by: "roster",
        };
        const saved = await db("beta_invites", { method: "POST", body: JSON.stringify(row), headers: { Prefer: "return=representation" } });
        if (saved && saved[0]) minted = { email, max_uses: maxUses, expires_at: row.expires_at, url: `https://kit-project.com/install/?invite=${token}` };
      }
      return html(await render({ minted }));
    }

    // Delete one invite outright. Revoked and archived rows keep the record of
    // who was invited; this is for the row that should not exist at all, and
    // it is the one action on this page with no way back, which is why it is a
    // POST with a confirm rather than a link.
    const doomed = (form.get("delete_invite") || "").trim();
    if (cookieOk && /^\d{1,12}$/.test(doomed)) {
      await db(`beta_invites?id=eq.${doomed}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
      return back(suffix);
    }

    // Sweep: archive every dead invite in the live list in one go. Computed
    // from the rows the page is showing rather than from a clever filter, so
    // what gets archived is exactly what the operator was looking at, and
    // "uses >= max_uses" stays a comparison this code makes rather than one
    // PostgREST has to be talked into.
    if (cookieOk && form.get("sweep") === "dead") {
      const { invites, archiveReady } = await loadInvites();
      const ids = archiveReady
        ? invites.filter((i) => !i.archived_at && inviteState(i)).map((i) => Number(i.id)).filter(Number.isFinite)
        : [];
      if (ids.length) {
        await db(`beta_invites?id=in.(${ids.join(",")})`, {
          method: "PATCH",
          body: JSON.stringify({ archived_at: new Date().toISOString(), revoked: true }),
          headers: { Prefer: "return=minimal" },
        });
      }
      return back(suffix);
    }

    // A signed-in operator whose POST matched no action (a mangled id, a stale
    // form) gets the page back, not a sign-in wall: the password branch below
    // is for someone who is not signed in yet, and showing it to someone who
    // is reads as "you have been logged out" when nothing of the sort happened.
    if (cookieOk) return html(await render({ showArchived }));

    if (sameSecret((form.get("password") || "").trim(), ADMIN_TOKEN)) {
      res.statusCode = 302;
      res.setHeader("Set-Cookie",
        `kit_beta=${encodeURIComponent(ADMIN_TOKEN)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`);
      // Back to whichever path they signed in on: this page answers on /beta
      // via a rewrite as well as its own /api path.
      res.setHeader("Location", url.pathname);
      return res.end();
    }
    return html(signInPage(true), 401);
  }

  const token = (url.searchParams.get("token") || "").trim();
  if (!cookieOk && !sameSecret(token, ADMIN_TOKEN)) {
    return html(signInPage(false), 401);
  }

  const showArchived = url.searchParams.get("show") === "archived";
  const suffix = showArchived ? "?show=archived" : "";

  const forget = (url.searchParams.get("forget") || "").trim();
  if (/^[a-f0-9]{8,64}$/.test(forget)) {
    await db(`beta_installs?id=eq.${encodeURIComponent(forget)}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    });
    return back(suffix);
  }

  // Revoke an invite: the link stops working on the next request, and any
  // browser it already let in keeps its cookie until that expires (90 days);
  // forgetting the install below is the harder cut if that ever matters.
  const revoke = (url.searchParams.get("revoke") || "").trim();
  if (/^\d{1,12}$/.test(revoke)) {
    await db(`beta_invites?id=eq.${revoke}`, {
      method: "PATCH",
      body: JSON.stringify({ revoked: true }),
      headers: { Prefer: "return=minimal" },
    });
    return back(suffix);
  }

  // Archive: out of the list, still in the database. Revoking alongside it is
  // deliberate belt and braces, so a hidden invite can never be a working
  // door: whatever else changes, nothing this page has put out of sight is
  // still letting someone in.
  const archive = (url.searchParams.get("archive") || "").trim();
  if (/^\d{1,12}$/.test(archive)) {
    await db(`beta_invites?id=eq.${archive}`, {
      method: "PATCH",
      body: JSON.stringify({ archived_at: new Date().toISOString(), revoked: true }),
      headers: { Prefer: "return=minimal" },
    });
    return back(suffix);
  }

  // Restore puts the row back in the list. It stays revoked: the archive
  // revoked it, and un-revoking is the separate decision of minting a new one.
  const restore = (url.searchParams.get("restore") || "").trim();
  if (/^\d{1,12}$/.test(restore)) {
    await db(`beta_invites?id=eq.${restore}`, {
      method: "PATCH",
      body: JSON.stringify({ archived_at: null }),
      headers: { Prefer: "return=minimal" },
    });
    return back(suffix);
  }

  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  return html(await render({ showArchived }));
}
