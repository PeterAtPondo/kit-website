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
//   background process alive/restart counts, health rollup, an
//   operator-stopped flag, the two dream-cycle numbers, the ids and
//   one-line summaries of unhappy health checks, and the newest runtime
//   failure with its crash record: the stack version, the dream phase and
//   step with their clocks, the exception classes down the cause chain, the
//   frames that resolved inside Kit's own package as base name, function and
//   line, how many did not, the failing statement with its binds dropped and
//   how many there were, and three row estimates for Kit's own tables).
//   States, counts and Kit's own words about its own machinery, never
//   content.
// Never: memories, message content, the operator's own paths, directories or
// project names, IP addresses. A frame names a file of Kit's own, by base
// name, and that is the whole of what a file name here can be.
//
// The health-check names and summaries, the dream numbers and the runtime
// failure are all disclosed in the 2026-08-21 terms, and the crash record's
// frames and row estimates in the 2026-09-06 revision; that clause and this
// file move together. The app has been sending them since 0.2.19x and this
// receiver dropped every one of them on the floor, because it rebuilds the
// debug block field by field and an unknown key simply never survives. That
// is the right default, and this is the other half of it: a field the terms
// promise we collect has to be named here or it does not exist.
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
// Numbers are bounded the same way strings are: a count that arrives as a
// string, a NaN, or six digits of nonsense must not reach the roster page.
const count = (v, max) =>
  Number.isFinite(Number(v)) ? Math.min(Math.max(0, Math.round(Number(v))), max) : null;
const days = (v) =>
  Number.isFinite(Number(v)) ? Math.min(Math.max(0, Math.round(Number(v) * 10) / 10), 3650) : null;

// A declared integer, taken only as one. count() above coerces on purpose,
// because the numbers it guards arrive as whatever an older app put in them.
// The crash-record fields below are typed on the Mac before they are sent (a
// step is an Int there), so a value that is not already a whole number in
// range is not the field it claims to be, and goes on the floor rather than
// being rounded into something that looks like an answer.
const whole = (v, max) =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= max ? v : null;

// An exception class or a dream phase key: a name out of Kit's own vocabulary.
// Anything that is not a bare identifier was built at runtime, and a
// runtime-built name can hold whatever built it. Over-long is dropped rather
// than cut, because half an identifier is not one.
const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const identifier = (v, n) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s && s.length <= n && IDENT_RE.test(s) ? s : null;
};

// A month of milliseconds. A dream cycle that ran longer than that did not.
const MONTH_MS = 31 * 24 * 60 * 60 * 1000;

// Where the cycle stopped: a phase key, whether it was a resume, and counts
// and clocks. Every one of them is resolvable only against stack_version,
// which is why that travels beside them.
const crashDream = (v) => {
  if (!v || typeof v !== "object") return null;
  const dream = {};
  const phase = identifier(v.phase, 60);
  if (phase) dream.phase = phase;
  if (typeof v.resumed === "boolean") dream.resumed = v.resumed;
  for (const [key, max] of [["step", 999], ["attempts", 9999], ["generation", 9999]]) {
    const n = whole(v[key], max);
    if (n !== null) dream[key] = n;
  }
  for (const key of ["phase_ms", "cycle_ms"]) {
    const ms = whole(v[key], MONTH_MS);
    if (ms !== null) dream[key] = ms;
  }
  return Object.keys(dream).length ? dream : null;
};

// One traceback frame: the base name of the file, the function, and the line.
// The stack sends a base name and never a directory, for the same reason the
// app redacts paths: a directory tree is a description of someone's work. So a
// separator or a space here means this is not the field it says it is, and the
// frame is dropped whole rather than repaired.
const crashFrame = (f) => {
  if (!f || typeof f !== "object") return null;
  const file = typeof f.file === "string" ? f.file.trim() : "";
  const func = typeof f.func === "string" ? f.func.trim() : "";
  const line = whole(f.line, 9999999);
  if (!file || file.length > 80 || /[/\\\s]/.test(file)) return null;
  if (!func || func.length > 120 || /[/\\\s]/.test(func)) return null;
  if (line === null) return null;
  return { file, func, line };
};

// The failing statement, whole or not at all, with its own cap. Whole because
// the detail cap of 300 cuts the worked example in half and half a statement
// cannot tell a kNN scan from a filtered one, and those want opposite fixes.
// The quote check runs on what arrived, before the cap, so a quoted value out
// past 2000 characters drops the statement rather than being sliced off it:
// nothing that keeps part of a statement can tell a keyword from someone's
// name. The stack applies this same rule first; this is its second fence.
const crashSql = (v) => {
  if (typeof v !== "string" || /['"`]/.test(v)) return null;
  return v.trim().slice(0, 2000) || null;
};

// How big this Kit's own tables are: three row estimates, integers, nothing
// else. That is how big its machinery is, never anything kept in it.
const crashCorpus = (v) => {
  if (!v || typeof v !== "object") return null;
  const corpus = {};
  for (const key of ["memories", "memories_embedded", "memory_edges"]) {
    const n = whole(v[key], 1000000000000);
    if (n !== null) corpus[key] = n;
  }
  return Object.keys(corpus).length ? corpus : null;
};

// Update failures and runtime failures are the same shape by design (the app
// builds both from one recorder), so they get one set of caps here rather than
// two that can drift apart. The app strips credentials from log_tail before
// sending; these caps are the second fence, not the first.
//
// Since kit item 78 a failure also carries the v2 crash record: where a dream
// cycle stopped, in values nobody wrote. The four fields above say what broke;
// these say where, well enough that a fix can be written without asking the
// operator for a screenshot. Each is named here one at a time and taken only
// at the type it is declared to be, because the type is the filter as much as
// the name is: a step is an integer, a phase is a phase key, a frame is a base
// name and two numbers, and none of those shapes can hold a sentence. A field
// that fails its own shape is dropped in silence, and a key nobody named here
// never existed, which is the same default the debug block has always had.
const failure = (v) => {
  if (!v || typeof v !== "object") return null;
  const out = {
    kind: cap(v.kind, 40),
    detail: cap(v.detail, 300),
    app_version: version(v.app_version),
    at: cap(v.at, 40),
    log_tail: cap(v.log_tail, 3000),
  };
  // The stack that actually crashed, which is not always the app bundle
  // app_version already names. A frame's line number and a step's index are
  // resolvable only against the tree that raised them.
  const stack = version(v.stack_version);
  if (stack) out.stack_version = stack;
  const dream = crashDream(v.dream);
  if (dream) out.dream = dream;
  // The cause chain, outermost first: the visible exception is often not the
  // one that matters. Eight is headroom over the five the stack walks.
  if (Array.isArray(v.cause_types)) {
    const causes = v.cause_types.slice(0, 8).map((t) => identifier(t, 80)).filter(Boolean);
    if (causes.length) out.cause_types = causes;
  }
  // Kit's own frames, innermost first. Twelve is the stack's own cap, so a
  // real record is never truncated here.
  if (Array.isArray(v.frames)) {
    const frames = v.frames.slice(0, 12).map(crashFrame).filter(Boolean);
    if (frames.length) out.frames = frames;
  }
  // Kept even at zero: "all nine frames were elsewhere" is a real answer, and
  // a missing number reads as no traceback at all.
  const elsewhere = whole(v.frames_elsewhere, 99999);
  if (elsewhere !== null) out.frames_elsewhere = elsewhere;
  const sql = crashSql(v.sql);
  if (sql) out.sql = sql;
  // How many binds the statement took. The values themselves never travel;
  // the stack counts them out of the statement's own placeholders.
  const binds = whole(v.sql_params, 9999);
  if (binds !== null) out.sql_params = binds;
  const corpus = crashCorpus(v.corpus);
  if (corpus) out.corpus = corpus;
  return out;
};

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
      update_failure: failure(body.update_failure),
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
        const health = {
          overall: cap(d.health.overall, 20),
          attention: count(d.health.attention, 999) ?? 0,
        };
        // WHICH checks are unhappy, not just how many. Three installs sat
        // degraded for weeks (2026-08-21) and nobody could say what was wrong
        // without asking their owner to run something, because the names never
        // left the machine. Ids and the check's own one-line summary and
        // remedy: Kit describing its own machinery. Never `detail`, which can
        // quote the operator's own content, and never anything not on this list.
        if (Array.isArray(d.health.attention_ids)) {
          health.attention_ids = d.health.attention_ids
            .slice(0, 12)
            .map((id) => cap(id, 60))
            .filter(Boolean);
        }
        if (Array.isArray(d.health.attention_summaries)) {
          health.attention_summaries = d.health.attention_summaries
            .slice(0, 12)
            .map((c) => ({
              id: cap(c?.id, 60),
              status: cap(c?.status, 20),
              summary: cap(c?.summary, 300),
              remedy: cap(c?.remedy, 300),
            }))
            .filter((c) => c.id);
        }
        debug.health = health;
      }
      // Dream-cycle health: how long since one finished, and how many have
      // failed in a row. A cycle that silently never completes shows up here
      // as rising age even when no crash was ever recorded, which is the only
      // way that failure mode is visible from outside the operator's Mac.
      if (d.dream && typeof d.dream === "object") {
        const dream = {};
        const age = days(d.dream.last_completed_age_days);
        if (age !== null) dream.last_completed_age_days = age;
        const failures = count(d.dream.consecutive_failures, 9999);
        if (failures !== null) dream.consecutive_failures = failures;
        if (Object.keys(dream).length) debug.dream = dream;
      }
      // The newest dream or background-process crash this app has seen. Same
      // shape as update_failure, its own key because an update failure and a
      // dream crash can both be live and neither may hide the other.
      const runtimeFailure = failure(d.last_failure);
      if (runtimeFailure) debug.last_failure = runtimeFailure;
      if (d.operator_stopped === true) debug.operator_stopped = true;
      record.debug = debug;
    }

    await upsertInstall(record);

    // Control channel (2026-08-03, Peter: bugs must surface as found, and
    // fixes must reach opted-in operators without waiting for tomorrow).
    // The response body, ignored by every app up to 0.2.146, becomes the
    // update nudge for 0.2.147+: {latest, check_now} and the app triggers an
    // immediate Sparkle check when check_now is true. Only an authenticated
    // ping gets a body, so the prober contract above is intact (they still
    // see 204 and learn nothing). latest.json comes from our own edge-cached
    // update channel rather than a bundled file, so a release cut updates
    // this answer with no redeploy here. Any failure falls through to the
    // silent 204: an app must never be delayed or broken by its own nudge.
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 2500);
      const lr = await fetch("https://kit-project.com/update/latest.json", { signal: ctl.signal });
      clearTimeout(timer);
      if (lr.ok) {
        const latest = await lr.json();
        const lv = version(latest.version);
        if (lv) {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.setHeader("Cache-Control", "no-store");
          return res.end(JSON.stringify({
            ok: true,
            latest: { version: lv, page: cap(latest.page, 300) },
            check_now: Boolean(record.app_version && record.app_version !== lv),
          }));
        }
      }
    } catch {
      // Fall through to the silent 204.
    }
  } catch {
    // Fail silent by design.
  }
  return done();
}
