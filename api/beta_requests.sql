-- Beta access requests, for the Supabase database connected to this Vercel
-- project. Written by Kit on 2026-08-20, the evening the soft launch went out
-- on LinkedIn and X. Peter pastes it into the Supabase SQL editor once, as with
-- beta_installs and beta_invites.
--
-- Until now /install/request/ posted straight to Formspree, which emails Peter
-- and tells Kit nothing. A request could not be answered by anything but hand
-- work, and nothing recorded who had asked, when, or what happened next. This
-- table is the record; the playbook (beta-request, seeded in kit's
-- api/database.py) is what acts on it.
--
-- The lifecycle is deliberately small:
--   new       just arrived, nobody has looked
--   notified  Kit has put it in front of Peter and is waiting on his answer
--   approved  he said yes; invite_id points at the beta_invites row minted
--   declined  he said no; a warm note went out, nothing was minted
--   failed    something broke after the decision (see notes); safe to retry
--
-- Formspree stays wired as a parallel notification, so a bug in this path
-- costs Kit its record but never costs Peter the request.

create table if not exists public.beta_requests (
  id           bigserial primary key,
  name         text not null,
  email        text not null,
  mac          text,
  tools        text,
  message      text,
  source       text,
  -- Coarse request context, for spotting a flood of look-alike submissions.
  -- No IP address: it would be the only personal datum here that the person
  -- did not choose to type, and it buys nothing the honeypot does not.
  user_agent   text,
  country      text,
  created_at   timestamptz not null default now(),

  status       text not null default 'new',
  notified_at  timestamptz,
  decided_at   timestamptz,
  decided_by   text,
  -- The beta_invites row minted on approval. No foreign key: an invite may be
  -- revoked and cleaned up independently, and losing the invite must not take
  -- the record of the request with it.
  invite_id    bigint,
  mail_sent_at timestamptz,
  notes        text,

  constraint beta_requests_status_known
    check (status in ('new', 'notified', 'approved', 'declined', 'failed'))
);

-- The feed reads "what is waiting", so index the way it asks.
create index if not exists beta_requests_status_idx
  on public.beta_requests (status, created_at desc);
create index if not exists beta_requests_email_idx
  on public.beta_requests (lower(email));

-- One live request per address at a time. A person who submits twice while
-- their first is still open updates it rather than queueing a duplicate for
-- Peter to read twice; once decided, a later request is a new row.
create unique index if not exists beta_requests_one_open_per_email
  on public.beta_requests (lower(email))
  where status in ('new', 'notified');

-- Same posture as beta_invites: the serverless functions run with the
-- service-role key, so no policy is needed for them, and no anon access is
-- granted to this table. The public POST path writes through the function,
-- never from the browser.
alter table public.beta_requests enable row level security;
revoke all on table public.beta_requests from anon, authenticated;
revoke all on sequence public.beta_requests_id_seq from anon, authenticated;
