-- One row per heartbeat, so the beta roster can show an install's history and
-- not only its latest word. Written by Kit on 2026-09-11, on Peter's ask: the
-- roster showed "?" and "unknown" for most installs, and a single upserted row
-- cannot say whether a Kit was healthy yesterday, when its version moved, or
-- how its restart count has been climbing.
--
-- Same rules as beta_installs: states, counts and Kit's own check ids only,
-- nothing the operator wrote, no IP. beta-ping.mjs rebuilds every field and
-- bounds it before it gets here, and writes here only after the roster row
-- has landed; a missing table is a silent no-op there, so an old database
-- never loses a heartbeat to this one.
--
-- Paste into the Supabase SQL editor, the same way beta_invites.sql was.

create table if not exists public.beta_install_pings (
  id                  bigserial primary key,
  install_id          text not null references public.beta_installs(id) on delete cascade,
  seen_at             timestamptz not null default now(),
  app_version         text,
  stack_version       text,
  runtime             text,
  -- The install's own verdict on itself, as its app reported it.
  overall             text,
  attention           integer,
  attention_ids       text[] not null default '{}',
  -- Dream and process health, as counts.
  dream_age_days      numeric,
  dream_failures      integer,
  restarts            integer,
  dead_processes      integer,
  -- Evidence of trouble, by kind and time only; the detail stays on the
  -- roster row it belongs to.
  crash_kind          text,
  crash_at            timestamptz,
  update_failure_kind text,
  operator_stopped    boolean not null default false
);

create index if not exists beta_install_pings_install_seen_idx
  on public.beta_install_pings (install_id, seen_at desc);

-- The roster is reached only by our serverless functions, which hold the
-- service role key. RLS on with no policies is default-deny for everyone else.
alter table public.beta_install_pings enable row level security;
revoke all on table public.beta_install_pings from anon, authenticated;
revoke all on sequence public.beta_install_pings_id_seq from anon, authenticated;
