-- Delivery receipts are server-only; no subscriber addresses enter the repository.
create table public.newsletter_posts (
  url text primary key,
  title text not null,
  published_at timestamptz not null,
  first_seen_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('baseline', 'pending', 'complete')),
  completed_at timestamptz
);
alter table public.newsletter_posts enable row level security;
revoke all on public.newsletter_posts from public, anon, authenticated;
grant select, insert, update on public.newsletter_posts to service_role;

create table public.newsletter_deliveries (
  post_url text not null references public.newsletter_posts(url) on delete cascade,
  subscriber_id uuid not null references public.subscribers(id) on delete cascade,
  provider_id text not null,
  sent_at timestamptz not null default now(),
  primary key (post_url, subscriber_id)
);
create index newsletter_deliveries_subscriber_idx on public.newsletter_deliveries (subscriber_id);
alter table public.newsletter_deliveries enable row level security;
revoke all on public.newsletter_deliveries from public, anon, authenticated;
grant select, insert on public.newsletter_deliveries to service_role;

-- Enabling notifications must not mail the existing archive to future readers.
insert into public.newsletter_posts (url, title, published_at, status)
values ('https://www.henryjstarr.com/2026/08/31/why-i-rebuilt-this-site/', 'Why I Rebuilt This Site', '2026-08-31T00:00:00Z', 'baseline');
