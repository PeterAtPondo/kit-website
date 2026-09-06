#!/usr/bin/env node
// What the beta heartbeat receiver keeps, asserted through to the feed row.
//
// api/beta-ping.mjs rebuilds every block it stores field by field, so a field
// the app sends and that file does not name is a field /api/beta-feed will
// never show, and a field named at the wrong type is a hole in a promise the
// terms make. Both halves are worth pinning, so this feeds one honest
// heartbeat and one hostile one and reads back the row the feed would serve.
//
// There is no package.json here and so no runner: node
// scripts/test-beta-ping.mjs, which exits 0 or prints what failed. Both
// functions reach the database over plain fetch, which is what makes that
// possible: one stand-in fetch is the whole table, and the row beta-ping
// writes is the row beta-feed reads back.

import assert from "node:assert/strict";

const APP_TOKEN = "test-app-token";
const FEED_TOKEN = "test-feed-token";
const DB_URL = "https://db.test.invalid";

process.env.KIT_WELCOME_TOKEN = APP_TOKEN;
process.env.KIT_BETA_FEED_TOKEN = FEED_TOKEN;
process.env.SUPABASE_URL = DB_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";

// The stand-in table. The one PostgREST behaviour that matters here is the
// upsert: a POST with merge-duplicates writes on id and leaves columns absent
// from the body alone, so rows merge rather than replace.
const table = new Map();
globalThis.fetch = async (input, init = {}) => {
  const url = String(input);
  if (url.startsWith(`${DB_URL}/rest/v1/beta_installs`)) {
    if ((init.method ?? "GET").toUpperCase() === "POST") {
      for (const row of JSON.parse(init.body)) {
        table.set(row.id, { ...(table.get(row.id) ?? {}), ...row });
      }
      return new Response(null, { status: 204 });
    }
    return Response.json([...table.values()]);
  }
  // The update nudge, answered here rather than on the wire: a test that
  // reaches the live site is a test that fails on a train. Not ok, so the
  // receiver falls through to its silent 204 exactly as it does when the
  // update channel is unreachable.
  if (url.startsWith("https://kit-project.com/")) return new Response("nope", { status: 503 });
  throw new Error(`unexpected request in this test: ${url}`);
};

const { default: ping } = await import("../api/beta-ping.mjs");
const { default: feed } = await import("../api/beta-feed.mjs");

const response = () => ({
  statusCode: 0,
  headers: {},
  body: "",
  setHeader(key, value) {
    this.headers[key] = value;
  },
  end(chunk) {
    this.body = chunk ?? "";
  },
});

const heartbeat = async (body) => {
  const res = response();
  await ping(
    { method: "POST", headers: { "x-kit-app-token": APP_TOKEN }, body: JSON.stringify(body) },
    res,
  );
  return res;
};

// The feed row, read the way canonical Kit reads it.
const feedRow = async (email) => {
  const res = response();
  await feed({ method: "GET", headers: { authorization: `Bearer ${FEED_TOKEN}` } }, res);
  assert.equal(res.statusCode, 200, "feed did not answer 200");
  const row = JSON.parse(res.body).rows.find((r) => r.email === email);
  assert.ok(row, `no feed row for ${email}`);
  return row;
};

const failures = [];
const check = async (name, fn) => {
  try {
    await fn();
    console.log(`  ok    ${name}`);
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
    console.log(`  FAIL  ${name}`);
  }
};

// ── An honest v2 crash record reaches the feed whole ────────────────────────
//
// The worked example from the plan: a similarity query against the statement
// timeout. Every field is at its declared type, and the row must hold all of
// them, because the point of the record is that a fix can be written from it
// without asking the operator for anything.

const HONEST_SQL =
  "SELECT 1 - (embedding <=> CAST($1 AS vector)) AS similarity FROM memories " +
  "WHERE id != $2 AND embedding IS NOT NULL ORDER BY embedding <=> CAST($1 AS vector) LIMIT 50";

const HONEST_CRASH = {
  kind: "dream_crashed",
  detail: "DBAPIError: QueryCanceledError: canceling statement due to statement timeout",
  app_version: "0.2.335",
  at: "2026-09-06T01:10:24Z",
  log_tail: "completed phases: operator_scrub, draft_triage",
  stack_version: "0.2.334",
  dream: {
    phase: "decay_consolidate",
    resumed: false,
    step: 3,
    attempts: 2,
    generation: 2,
    phase_ms: 934000,
    cycle_ms: 5040000,
  },
  cause_types: ["DBAPIError", "QueryCanceledError"],
  frames: [
    { file: "dream_service.py", func: "_recompute_centrality", line: 867 },
    { file: "dream_service.py", func: "_phase_decay_consolidate", line: 3559 },
  ],
  frames_elsewhere: 9,
  sql: HONEST_SQL,
  sql_params: 2,
  corpus: { memories: 61000, memories_embedded: 59000, memory_edges: 210000 },
};

const OLD_SHAPE_UPDATE = {
  kind: "update_failed",
  detail: "sparkle: could not verify the signature",
  app_version: "0.2.334",
  at: "2026-09-05T22:04:11Z",
  log_tail: "KIT_UPDATE_FAILED",
};

await check("an honest crash record reaches the feed row whole", async () => {
  const res = await heartbeat({
    email: "honest@example.com",
    operator_name: "Beta Operator",
    kit_name: "Kit",
    app_version: "0.2.335",
    stack_version: "0.2.335",
    update_failure: OLD_SHAPE_UPDATE,
    debug: { runtime: "native", last_failure: HONEST_CRASH },
  });
  assert.equal(res.statusCode, 204, "an unreachable update channel must still answer 204");
  const row = await feedRow("honest@example.com");
  assert.deepEqual(row.debug.last_failure, HONEST_CRASH);
  assert.equal(row.debug.runtime, "native");
});

await check("a failure carrying no crash record is the shape it always was", async () => {
  const row = await feedRow("honest@example.com");
  assert.deepEqual(row.update_failure, OLD_SHAPE_UPDATE);
});

// ── Hostile shapes are dropped in silence ───────────────────────────────────
//
// Every field below is either the wrong type, out of its range, or a name
// nobody enumerated. None of them may reach the row, the heartbeat still has
// to be accepted, and the fields that are honest in the same block still have
// to survive: dropping is per field, never per record.

const HOSTILE_CRASH = {
  kind: "dream_crashed",
  detail: "x".repeat(600),
  at: "2026-09-06T02:00:00Z",
  log_tail: "y".repeat(4000),
  stack_version: "the one from last Tuesday",
  dream: {
    phase: "decay consolidate; and then a sentence",
    resumed: "false",
    step: "3",
    attempts: 2.5,
    generation: -1,
    phase_ms: 934000,
    cycle_ms: 99 * 31 * 24 * 60 * 60 * 1000,
    note: "a sentence riding in under a name nobody named",
  },
  cause_types: ["QueryCanceledError", "Timeout Error", "os.system", 7, "A".repeat(200)],
  frames: [
    { file: "dream_service.py", func: "_recompute_centrality", line: 867 },
    { file: "/Users/someone/Code/a-client/ingest.py", func: "run", line: 12 },
    { file: "notes for the quarterly review.py", func: "run", line: 12 },
    { file: "dream_service.py", func: "_phase_decay_consolidate", line: "867" },
    { file: "dream_service.py", line: 12 },
    "dream_service.py:867",
  ],
  frames_elsewhere: 0,
  sql: "SELECT id FROM memories WHERE title = 'a title the operator wrote'",
  sql_params: "2",
  corpus: { memories: 61000, memories_embedded: "59000", memory_edges: 2.5, disk_free: 12 },
  hostname: "a-laptop.local",
};

await check("hostile shapes are dropped, honest ones beside them are not", async () => {
  await heartbeat({
    email: "hostile@example.com",
    app_version: "0.2.335",
    debug: { runtime: "docker", last_failure: HOSTILE_CRASH },
  });
  const row = await feedRow("hostile@example.com");
  assert.deepEqual(row.debug.last_failure, {
    kind: "dream_crashed",
    // The existing caps, unchanged: 300 for detail, 3000 for the log tail.
    detail: "x".repeat(300),
    app_version: null,
    at: "2026-09-06T02:00:00Z",
    log_tail: "y".repeat(3000),
    // A version that is not one, a phase that is not a phase key, a step that
    // arrived as a string, a fraction, a negative, a cycle longer than a
    // month, and a key nobody named: all gone. The one honest clock stays.
    dream: { phase_ms: 934000 },
    // A space, a dot, a number and 200 characters are each not an exception
    // class.
    cause_types: ["QueryCanceledError"],
    // A path, a name with spaces in it, a line that arrived as a string, a
    // frame with no function, and a frame that is not an object.
    frames: [{ file: "dream_service.py", func: "_recompute_centrality", line: 867 }],
    // Kept at zero: no frame resolved inside the package is an answer.
    frames_elsewhere: 0,
    // The statement holds a quoted value, so it travels nowhere.
    corpus: { memories: 61000 },
  });
});

// ── The statement's own cap ─────────────────────────────────────────────────

const LONG_SQL = `SELECT ${"a".repeat(2600)} FROM memories`;

await check("a long statement is cut at its own 2000, not at the detail cap", async () => {
  await heartbeat({
    email: "long-sql@example.com",
    debug: { last_failure: { kind: "dream_crashed", at: "2026-09-06T03:00:00Z", sql: LONG_SQL } },
  });
  const row = await feedRow("long-sql@example.com");
  assert.equal(row.debug.last_failure.sql, LONG_SQL.slice(0, 2000));
});

await check("a quote past the cap still drops the whole statement", async () => {
  await heartbeat({
    email: "late-quote@example.com",
    debug: {
      last_failure: {
        kind: "dream_crashed",
        at: "2026-09-06T04:00:00Z",
        sql: `${LONG_SQL} WHERE title = 'a title the operator wrote'`,
      },
    },
  });
  const row = await feedRow("late-quote@example.com");
  assert.ok(!("sql" in row.debug.last_failure), "a quoted value must not survive the cap");
});

if (failures.length) {
  console.error(`\nbeta-ping: ${failures.length} failure${failures.length === 1 ? "" : "s"}`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("\nbeta-ping: the receiver keeps what it names and nothing else.");
}
