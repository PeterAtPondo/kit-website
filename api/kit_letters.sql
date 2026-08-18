-- The postbox: letters between a personal Kit and the canonical one, for the
-- Supabase database connected to this Vercel project. This DDL used to live
-- as a comment in api/postbox.mjs and never carried the row-level-security
-- line beta_installs.sql and beta_invites.sql have, so the table went live
-- with RLS off and GRANT ALL to anon: Supabase's advisor flagged it on
-- 17 Aug 2026 (rls_disabled_in_public). Fixed by migration
-- supabase/migrations/20260818190900_kit_letters_rls_and_revoke_anon.sql;
-- this file is the table's home from now on, with RLS on from birth.
--
-- All access is through api/postbox.mjs with the service-role key, which
-- bypasses RLS. No policy is needed and no anon access is granted.

create table if not exists public.kit_letters (
  id          uuid primary key default gen_random_uuid(),
  install_id  text not null,
  kit_name    text not null,
  direction   text not null check (direction in ('home', 'out')),
  status      text not null default 'new',
  title       text,
  body        text not null,
  blessed     boolean not null default false,
  app_version text,
  created_at  timestamptz not null default now(),
  fetched_at  timestamptz
);

create index if not exists kit_letters_direction_status on public.kit_letters (direction, status);

alter table public.kit_letters enable row level security;
revoke all on table public.kit_letters from anon, authenticated;
