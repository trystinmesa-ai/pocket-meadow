-- Pocket Meadow cloud save. Paste into Supabase: SQL Editor -> New query -> Run.
-- Uses the same Supabase project (and the same login) as Tally.
-- One row per account holding the whole farm.

create table if not exists public.meadow_saves (
  user_id    uuid        primary key default auth.uid() references auth.users (id) on delete cascade,
  data       jsonb       not null,
  rev        integer     not null default 1,     -- goes up by one on every upload; used to spot a newer save from another device
  saved_at   timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

revoke all on public.meadow_saves from anon;
grant select, insert, update, delete on public.meadow_saves to authenticated;

alter table public.meadow_saves enable row level security;

drop policy if exists "own farm: read"   on public.meadow_saves;
drop policy if exists "own farm: insert" on public.meadow_saves;
drop policy if exists "own farm: update" on public.meadow_saves;
drop policy if exists "own farm: delete" on public.meadow_saves;

create policy "own farm: read"   on public.meadow_saves for select to authenticated using ((select auth.uid()) = user_id);
create policy "own farm: insert" on public.meadow_saves for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own farm: update" on public.meadow_saves for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own farm: delete" on public.meadow_saves for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function public.meadow_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists meadow_touch on public.meadow_saves;
create trigger meadow_touch before insert or update on public.meadow_saves
  for each row execute function public.meadow_touch();
