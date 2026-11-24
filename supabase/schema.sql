-- For the Future Lab のデータ置き場
-- Supabase の「SQL Editor」にこのファイルの中身を全部貼り付けて「Run」を押す。1回だけでOK。

-- すべてのデータ（型・ページ・設定）を1つの表に入れる。中身は自由な JSON なので、
-- あとから機能を増やしても表を作り直さなくていい。
create table if not exists public.records (
  id          text        not null,
  user_id     uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  kind        text        not null check (kind in ('type', 'item', 'setting')),
  data        jsonb       not null default '{}'::jsonb,
  deleted     boolean     not null default false,
  updated_at  timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists records_user_updated on public.records (user_id, updated_at desc);

-- 自分のデータは自分しか読めない・書けない
alter table public.records enable row level security;

drop policy if exists "own rows: select" on public.records;
drop policy if exists "own rows: insert" on public.records;
drop policy if exists "own rows: update" on public.records;
drop policy if exists "own rows: delete" on public.records;

create policy "own rows: select" on public.records for select using (user_id = auth.uid());
create policy "own rows: insert" on public.records for insert with check (user_id = auth.uid());
create policy "own rows: update" on public.records for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows: delete" on public.records for delete using (user_id = auth.uid());

-- 別の端末で変えた内容をすぐ受け取れるようにする
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'records'
  ) then
    alter publication supabase_realtime add table public.records;
  end if;
end $$;
