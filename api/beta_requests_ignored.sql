-- 2026-09-13: the beta-request playbook gained an Ignore verb, for spam. It
-- closes the row as 'ignored' and sends nothing. Paste this once into the
-- Supabase SQL editor; beta_requests.sql carries the same list for a fresh
-- install.
alter table public.beta_requests
  drop constraint if exists beta_requests_status_known;
alter table public.beta_requests
  add constraint beta_requests_status_known
  check (status in ('new', 'notified', 'approved', 'declined', 'ignored', 'failed'));
