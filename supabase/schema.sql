-- AuroLIFE: run this once in Supabase → SQL Editor.
-- One table holds every collection (areas, tasks, triggers, journal, habits, diary, vision),
-- and row level security keeps each user's rows private.

create table if not exists public.docs (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  collection text        not null,
  id         text        not null,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, collection, id)
);

alter table public.docs enable row level security;
alter table public.docs replica identity full;

drop policy if exists "own rows: select" on public.docs;
drop policy if exists "own rows: insert" on public.docs;
drop policy if exists "own rows: update" on public.docs;
drop policy if exists "own rows: delete" on public.docs;
create policy "own rows: select" on public.docs for select using (user_id = auth.uid());
create policy "own rows: insert" on public.docs for insert with check (user_id = auth.uid());
create policy "own rows: update" on public.docs for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows: delete" on public.docs for delete using (user_id = auth.uid());

-- live updates between your phone and PC
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;
