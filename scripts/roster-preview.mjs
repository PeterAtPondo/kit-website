// Look at /beta without a database, and without deploying to find out.
//
// A push to this repo deploys, so the roster page had no way to be reviewed
// before it was live: the only data it can render lives in production
// Supabase. This serves api/beta-roster.mjs against a stubbed Supabase full
// of made-up installs and invites, so a change to that page can be looked at,
// clicked through, and checked for what it does to the store first.
//
//   node scripts/roster-preview.mjs            then open http://localhost:4321/beta
//   NO_ARCHIVE=1 node scripts/roster-preview.mjs   the not-yet-migrated store
//   HOSTILE=1 node scripts/roster-preview.mjs      markup in every field
//
// The password is "preview". Every write the page attempts is logged to the
// console as MUTATE and then swallowed, so nothing here can change anything.
import http from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";

const TOKEN = "preview";
process.env.KIT_BETA_ADMIN_TOKEN = TOKEN;
process.env.SUPABASE_URL = "https://stub.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "stub";

const HAS_ARCHIVE = process.env.NO_ARCHIVE !== "1";
const HOSTILE = process.env.HOSTILE === "1";
const PORT = Number(process.env.PORT || 4321);

const daysAgo = (d) => new Date(Date.now() - d * 86400e3).toISOString();
const inDays = (d) => new Date(Date.now() + d * 86400e3).toISOString();
// Every string the page renders, filled with markup, to prove esc() covers it.
const X = '"><script>window.PWNED=1</script><img src=x onerror="window.PWNED=2">';

// One install per shape the page has to draw: healthy, behind, unhappy, down,
// too old to send the new fields, and old enough to send no debug block at all.
const installs = [
  { id: "a".repeat(32), email: "ludwig@example.com", operator_name: "Ludwig", kit_name: "Ludwig's Kit",
    surfaces: ["claude-code", "cursor"], app_version: "0.2.201", stack_version: "0.2.201",
    first_seen: daysAgo(20), last_seen: daysAgo(0.02), update_failure: null,
    debug: { runtime: "docker", skew: false, health: { overall: "ok", attention: 0 },
             dream: { last_completed_age_days: 0.9, consecutive_failures: 0 } } },

  { id: "b".repeat(32), email: "ian@example.com", operator_name: "Ian", kit_name: "Kit",
    surfaces: ["claude-code"], app_version: "0.2.201", stack_version: "0.2.198",
    first_seen: daysAgo(34), last_seen: daysAgo(0.1),
    update_failure: { kind: "compose_pull", detail: "docker compose pull exited 1", at: daysAgo(0.3),
                      app_version: "0.2.201", log_tail: "KIT_STACK=personal\nError response from daemon: manifest unknown\nretry 3/3 failed" },
    debug: { runtime: "docker", installed_version: "0.2.201", skew: true,
             health: { overall: "degraded", attention: 2,
                       attention_ids: ["dream_cycle", "recall_canary"],
                       attention_summaries: [
                         { id: "dream_cycle", status: "degraded", summary: "No deep dream has completed in 9 days.",
                           remedy: "Run a dream manually from the menu bar, then check dream_logs for the failing stage." },
                         { id: "recall_canary", status: "degraded", summary: "3 of 12 canary questions no longer return their expected memory.",
                           remedy: "Re-embed the affected area from Settings, Knowledge." }] },
             dream: { last_completed_age_days: 9.2, consecutive_failures: 4 } } },

  { id: "c".repeat(32), email: "kat@example.com", operator_name: "Kat", kit_name: "Kat",
    surfaces: ["claude-code", "codex", "telegram"], app_version: "0.2.200", stack_version: null,
    first_seen: daysAgo(12), last_seen: daysAgo(0.5), update_failure: null,
    debug: { runtime: "native", health: { overall: "down", attention: 1 },
             native_processes: [{ name: "api", alive: false, restarts: 14 }, { name: "worker", alive: true, restarts: 0 }],
             dream: { last_completed_age_days: 3.1, consecutive_failures: 1 },
             last_failure: { kind: "dream_crash", detail: "deep dream exited during novel-association", at: daysAgo(0.2),
                             app_version: "0.2.200", log_tail: "KIT_DREAM=deep\nTraceback (most recent call last):\n  novel_association timeout after 900s\nexit 1" } } },

  { id: "d".repeat(32), email: "roger@example.com", operator_name: "Roger", kit_name: "Kit",
    surfaces: [], app_version: "0.2.187", stack_version: "0.2.187",
    first_seen: daysAgo(41), last_seen: daysAgo(19), update_failure: null,
    debug: { runtime: "docker", operator_stopped: true, health: { overall: "unknown", attention: 0 } } },

  { id: "e".repeat(32), email: "sam@example.com", operator_name: "Sam", kit_name: "Sam's Kit",
    surfaces: ["cursor"], app_version: "0.2.193", stack_version: "0.2.193",
    first_seen: daysAgo(8), last_seen: daysAgo(1.2), update_failure: null,
    debug: { runtime: "docker", health: { overall: "degraded", attention: 3 } } },

  { id: "f".repeat(32), email: "early@example.com", operator_name: "Early adopter", kit_name: "Kit",
    surfaces: ["claude-code"], app_version: "0.2.155", stack_version: "0.2.155",
    first_seen: daysAgo(60), last_seen: daysAgo(9), update_failure: null },
];

// One invite per state: live, part-used, spent, expired, revoked, archived,
// plus an address with an apostrophe in it, which is what breaks a confirm()
// dialog built the naive way.
const invites = [
  { id: 12, email: "o'brien@example.com", label: "apostrophe", created_at: daysAgo(2), expires_at: inDays(28), max_uses: 5, uses: 0, last_used_at: null, revoked: false, created_by: "roster", archived_at: null },
  { id: 11, email: "new@example.com", label: "LinkedIn reply", created_at: daysAgo(1), expires_at: inDays(29), max_uses: 5, uses: 0, last_used_at: null, revoked: false, created_by: "roster", archived_at: null },
  { id: 10, email: "ludwig@example.com", label: null, created_at: daysAgo(20), expires_at: inDays(10), max_uses: 5, uses: 2, last_used_at: daysAgo(19), revoked: false, created_by: "operator", archived_at: null },
  { id: 9, email: "spent@example.com", label: "forwarded", created_at: daysAgo(25), expires_at: inDays(5), max_uses: 5, uses: 5, last_used_at: daysAgo(21), revoked: false, created_by: "roster", archived_at: null },
  { id: 8, email: "expired@example.com", label: null, created_at: daysAgo(60), expires_at: daysAgo(30), max_uses: 5, uses: 1, last_used_at: daysAgo(55), revoked: false, created_by: "roster", archived_at: null },
  { id: 7, email: "revoked@example.com", label: "asked to stop", created_at: daysAgo(40), expires_at: inDays(2), max_uses: 5, uses: 3, last_used_at: daysAgo(35), revoked: true, created_by: "kit", archived_at: null },
  { id: 6, email: "gone@example.com", label: "old round", created_at: daysAgo(80), expires_at: daysAgo(50), max_uses: 5, uses: 5, last_used_at: daysAgo(70), revoked: true, created_by: "roster", archived_at: daysAgo(3) },
];

// History (2026-09-11): a fortnight of heartbeats per install, shaped like
// the real table. Ludwig is steady, Ian has been degraded for a week and
// moved version twice, Kat went down two days ago and restarts climb, Roger
// is stopped and silent, Sam pings without health, Early adopter has none.
// NO_HISTORY=1 answers the way a store without the table does.
const HAS_HISTORY = process.env.NO_HISTORY !== "1";
const ping = (install, d, extra = {}) => ({
  install_id: install.id, seen_at: daysAgo(d), app_version: install.app_version, stack_version: install.stack_version,
  runtime: (install.debug || {}).runtime || "docker", overall: null, attention: null, attention_ids: [],
  dream_age_days: null, dream_failures: null, restarts: null, dead_processes: null,
  crash_kind: null, crash_at: null, update_failure_kind: null, operator_stopped: false, ...extra,
});
const pings = [];
for (let d = 13; d >= 0; d--) {
  pings.push(ping(installs[0], d + 0.3, { overall: "ok", attention: 0, restarts: 2, dead_processes: 0, dream_age_days: 0.8 }));
  if (d % 3 === 0) pings.push(ping(installs[0], d + 0.1, { overall: null }));
  pings.push(ping(installs[1], d + 0.5, {
    app_version: d > 9 ? "0.2.196" : d > 4 ? "0.2.198" : "0.2.201", stack_version: "0.2.198",
    overall: d > 7 ? "ok" : "degraded", attention: d > 7 ? 0 : 2, attention_ids: d > 7 ? [] : ["dream_cycle", "recall_canary"],
    restarts: 20 + (13 - d), dead_processes: 0, dream_age_days: d > 7 ? 0.5 : 9 - d * 0.2, dream_failures: d > 7 ? 0 : 4,
    update_failure_kind: d < 4 ? "compose_pull" : null,
  }));
  if (d > 1) pings.push(ping(installs[2], d + 0.2, { overall: "ok", attention: 0, restarts: d > 5 ? 3 : 3 + (5 - d) * 2, dead_processes: 0 }));
  else pings.push(ping(installs[2], d + 0.2, { overall: "down", attention: 1, attention_ids: ["system.native-processes"], restarts: 14, dead_processes: 1, crash_kind: "dream_crash", crash_at: daysAgo(0.2) }));
  if (d > 8) pings.push(ping(installs[4], d, { overall: null, restarts: 1 }));
}
pings.sort((a, b) => Date.parse(a.seen_at) - Date.parse(b.seen_at));

const hostile = (row) => Object.fromEntries(Object.entries(row).map(([k, v]) =>
  [k, typeof v === "string" && k !== "id" ? X : v]));

globalThis.fetch = async (url, init = {}) => {
  const u = new URL(url);
  const table = u.pathname.replace("/rest/v1/", "");
  const method = (init.method || "GET").toUpperCase();
  const json = (v, status = 200) =>
    new Response(JSON.stringify(v), { status, headers: { "Content-Type": "application/json" } });

  if (method !== "GET") {
    console.log(`MUTATE ${method} ${table}${u.search} ${init.body || ""}`);
    return new Response(null, { status: 204 });
  }
  if (table.startsWith("beta_install_pings")) {
    if (!HAS_HISTORY) return json({ code: "PGRST205", message: "Could not find the table 'public.beta_install_pings'" }, 404);
    return json(HOSTILE ? pings.map(hostile) : pings);
  }
  if (table.startsWith("beta_installs")) return json(HOSTILE ? installs.map(hostile) : installs);
  if (table.startsWith("beta_invites")) {
    // What a store without the migration actually says, so the page's fallback
    // is exercised rather than assumed.
    if (!HAS_ARCHIVE && u.search.includes("archived_at")) {
      return json({ code: "42703", message: "column beta_invites.archived_at does not exist" }, 400);
    }
    const rows = HAS_ARCHIVE ? invites : invites.map(({ archived_at, ...rest }) => rest);
    return json(HOSTILE ? rows.map(hostile) : rows);
  }
  return json([]);
};

const here = path.dirname(fileURLToPath(import.meta.url));
const { default: handler } = await import(path.join(here, "..", "api", "beta-roster.mjs"));

http.createServer((req, res) =>
  handler(req, res).catch((e) => { res.statusCode = 500; res.end(String((e && e.stack) || e)); })
).listen(PORT, () => {
  console.log(`roster preview: http://localhost:${PORT}/beta?token=${TOKEN}`);
  console.log(`archive column: ${HAS_ARCHIVE}   hostile strings: ${HOSTILE}`);
});
