-- Beta invite links, for the Supabase database connected to this Vercel
-- project. Written by Kit on 2026-08-18, replacing the shared install password;
-- Peter pastes it into the Supabase SQL editor once (as with beta_installs).
--
-- One row per invitation. The link a person receives carries a random token;
-- only its SHA-256 lands here, so a leaked table cannot be replayed. A token
-- has an owner (the email it was minted for), an expiry, a use budget (so a
-- link forwarded to a friend stops working after a few clicks rather than
-- becoming a public door), and a revoked flag Peter can flip at any time.
-- The middleware sets a signed cookie on first use, so a valid visitor keeps
-- access on that browser without burning uses; a fresh browser is one use.

create table if not exists public.beta_invites (
  id           bigserial primary key,
  email        text not null,
  label        text,
  token_hash   text not null unique,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '30 days',
  max_uses     integer not null default 5,
  uses         integer not null default 0,
  last_used_at timestamptz,
  revoked      boolean not null default false,
  created_by   text
);

create index if not exists beta_invites_email_idx on public.beta_invites (lower(email));

-- The middleware runs on Vercel's Edge with the service-role key: no RLS
-- policy is needed for it, and no anon access is granted to this table.
alter table public.beta_invites enable row level security;

-- No code path uses the anon or authenticated roles; close that door too.
revoke all on table public.beta_invites from anon, authenticated;
revoke all on sequence public.beta_invites_id_seq from anon, authenticated;
