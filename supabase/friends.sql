-- Pocket Meadow: visiting friends' farms and daily gifts.
-- Paste into Supabase: SQL Editor -> New query -> Run. Safe to run again.
-- Sharing is opt-in: a farm only appears here after its owner taps "Share my farm".

-- One row per shared farm: a short code friends type in, a display name and a
-- snapshot of the farm to look at (never the owner's email).
create table if not exists public.meadow_friends (
  code       text        primary key check (code ~ '^[A-Z0-9]{6}$'),
  user_id    uuid        not null unique default auth.uid() references auth.users (id) on delete cascade,
  name       text        not null default 'A little farm' check (char_length(name) between 1 and 24),
  farm       jsonb,
  updated_at timestamptz not null default now()
);

revoke all on public.meadow_friends from anon;
grant select, insert, update, delete on public.meadow_friends to authenticated;
alter table public.meadow_friends enable row level security;

drop policy if exists "friends: anyone signed in can look" on public.meadow_friends;
drop policy if exists "friends: share own farm"           on public.meadow_friends;
drop policy if exists "friends: update own farm"          on public.meadow_friends;
drop policy if exists "friends: stop sharing"             on public.meadow_friends;

create policy "friends: anyone signed in can look" on public.meadow_friends for select to authenticated using (true);
create policy "friends: share own farm"  on public.meadow_friends for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "friends: update own farm" on public.meadow_friends for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "friends: stop sharing"    on public.meadow_friends for delete to authenticated using ((select auth.uid()) = user_id);

drop trigger if exists meadow_friends_touch on public.meadow_friends;
create trigger meadow_friends_touch before insert or update on public.meadow_friends
  for each row execute function public.meadow_touch();

-- Gift baskets: one per sender, per friend, per day. The basket's contents are
-- worked out by the receiver's game, so a gift can't be used to cheat.
create table if not exists public.meadow_gifts (
  id         bigint      generated always as identity primary key,
  from_user  uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  from_name  text        not null check (char_length(from_name) between 1 and 24),
  to_code    text        not null references public.meadow_friends (code) on delete cascade,
  day        text        not null check (day ~ '^\d{4}-\d{2}-\d{2}$'),
  claimed    boolean     not null default false,
  created_at timestamptz not null default now(),
  unique (from_user, to_code, day)
);

revoke all on public.meadow_gifts from anon;
grant select, insert, update on public.meadow_gifts to authenticated;
alter table public.meadow_gifts enable row level security;

drop policy if exists "gifts: send"          on public.meadow_gifts;
drop policy if exists "gifts: see own"       on public.meadow_gifts;
drop policy if exists "gifts: open own"      on public.meadow_gifts;

create policy "gifts: send" on public.meadow_gifts for insert to authenticated
  with check ((select auth.uid()) = from_user and claimed = false);
create policy "gifts: see own" on public.meadow_gifts for select to authenticated
  using ((select auth.uid()) = from_user or to_code in (select code from public.meadow_friends where user_id = (select auth.uid())));
create policy "gifts: open own" on public.meadow_gifts for update to authenticated
  using (to_code in (select code from public.meadow_friends where user_id = (select auth.uid())))
  with check (to_code in (select code from public.meadow_friends where user_id = (select auth.uid())));
