-- Beta install roster table, for the Supabase database connected to this
-- Vercel project. Applied by Kit on 2026-07-22.
--
-- One row per install, keyed on a hash of the lowercased email so the key
-- itself carries no address and a reinstall stays one row rather than becoming
-- two. Everything here is what the macOS app already sends: nothing about the
-- operator's memories, messages, files or projects is stored, and neither is
-- their IP.

create table if not exists public.beta_installs (
  id            text primary key,
  email         text not null,
  operator_name text,
  kit_name      text,
  surfaces      text[] not null default '{}',
  -- Both versions on purpose. When they disagree the app updated and the
  -- containers did not, which is the silent skew we had no way to see.
  app_version   text,
  stack_version text,
  -- Defaulted, never sent by the writer: PostgREST leaves columns absent from
  -- the request body alone on conflict, so an install's start date survives
  -- every later heartbeat.
  first_seen    timestamptz not null default now(),
  last_seen     timestamptz not null default now()
);

create index if not exists beta_installs_last_seen_idx
  on public.beta_installs (last_seen desc);

-- Why an update failed, when the app recorded one (added 2026-07-31): kind,
-- detail, timestamp, and the sanitised error lines from the run. Null once
-- app and stack agree again. Bounded by beta-ping.mjs before it gets here.
alter table public.beta_installs
  add column if not exists update_failure jsonb;

-- The roster is reached only by our two serverless functions, which hold the
-- service role key. RLS on with no policies means anon and authenticated
-- callers can read nothing at all, so a leaked anon key exposes no one.
alter table public.beta_installs enable row level security;
