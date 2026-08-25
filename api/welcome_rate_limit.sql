-- Rate-limit ledger for api/welcome.mjs, for the Supabase database connected to
-- this Vercel project. Paste once into the Supabase SQL editor, as with
-- beta_installs, beta_invites and beta_requests.
--
-- Why this exists (2026-08-25). The welcome endpoint is guarded by
-- KIT_WELCOME_TOKEN, a token that ships inside every copy of Kit.app and can be
-- read out of the bundle in under a minute. That was always understood: the
-- loopback check on reset_url is what stops a leaked token becoming a phishing
-- relay, and it holds. What nothing stopped was VOLUME. With the token and a
-- loop, anyone could send unlimited Kit-branded mail to any address they liked,
-- spending the Resend quota and, far more expensively, kit-project.com's
-- sending reputation. A token in a distributed binary is not a secret, so the
-- endpoint has to be safe when it is public, and that means metered.
--
-- Addresses are stored as a SHA-256 hex digest, never in the clear. This table
-- exists to count, not to know who was written to, and a rate limiter is a poor
-- reason to start a second register of people's email addresses.
create table if not exists welcome_sends (
  id          bigserial primary key,
  kind        text        not null check (kind in ('welcome', 'password-reset')),
  to_hash     text        not null,
  ip_hash     text,
  created_at  timestamptz not null default now()
);

-- The limiter only ever reads a recent window, so both indexes lead with time.
create index if not exists idx_welcome_sends_to  on welcome_sends (to_hash, created_at desc);
create index if not exists idx_welcome_sends_ip  on welcome_sends (ip_hash, created_at desc);

-- Nothing reads this table after its window has passed. Keeping it small keeps
-- the count queries fast and means an abuse burst cannot grow it without bound.
-- Run from a Supabase scheduled job, or let it ride: the row is tiny.
--   delete from welcome_sends where created_at < now() - interval '7 days';
