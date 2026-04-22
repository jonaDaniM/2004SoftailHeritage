-- Run this in Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.tickets (
  "number" integer primary key,
  "tier" text not null check ("tier" in ('paid', 'free')),
  "status" text not null check ("status" in ('available', 'pending_payment', 'approved', 'sold', 'claimed_free', 'canceled')),
  "buyerName" text,
  "paymentMethod" text check ("paymentMethod" in ('zelle', 'cashapp')),
  "paymentReference" text,
  "reservedBySessionId" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists public.admin_audit (
  "id" uuid primary key default gen_random_uuid(),
  "action" text not null,
  "ticketNumber" integer not null,
  "actor" text not null,
  "note" text,
  "createdAt" timestamptz not null default now()
);

alter table public.tickets enable row level security;
alter table public.admin_audit enable row level security;

-- Public users can read ticket states for board + realtime.
drop policy if exists "Public read tickets" on public.tickets;
create policy "Public read tickets"
  on public.tickets
  for select
  using (true);

-- No direct public writes. All writes happen through Netlify Functions.
revoke insert, update, delete on public.tickets from anon, authenticated;
revoke insert, update, delete on public.admin_audit from anon, authenticated;

-- Admin audit is readable only via service role in functions.
drop policy if exists "No public audit read" on public.admin_audit;
create policy "No public audit read"
  on public.admin_audit
  for select
  using (false);

alter publication supabase_realtime add table public.tickets;
