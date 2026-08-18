-- kit_letters had no row-level security and GRANT ALL to anon/authenticated:
-- anyone with the project URL and the public anon key could read, write and
-- delete the postbox. Supabase's advisor flagged it on 17 Aug 2026
-- (rls_disabled_in_public). The table's DDL lived as a comment in
-- api/postbox.mjs and never carried the RLS line the other two tables have.
--
-- Every caller in kit-website (middleware, beta-roster, beta-invite, postbox,
-- beta-feed, beta-ping) uses SUPABASE_SERVICE_ROLE_KEY server-side, and the
-- service role bypasses RLS, so enabling it with NO policies is default-deny
-- for anon/authenticated and changes nothing for the site. The grants are a
-- second door no code path uses; close it on all three tables.

alter table public.kit_letters enable row level security;

revoke all on table public.kit_letters   from anon, authenticated;
revoke all on table public.beta_installs from anon, authenticated;
revoke all on table public.beta_invites  from anon, authenticated;
revoke all on sequence public.beta_invites_id_seq from anon, authenticated;
