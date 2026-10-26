-- 轻卡公众号教程：聊天同步队列 SQL
-- 先在新 Supabase 项目中执行 supabase/schema.sql，再执行本文件。
-- 注意：不要直接执行原项目 20261024_restrict_owner_only.sql；它锁定原作者账号。
-- 这份文件面向个人独立部署。数据表由 Supabase RLS 保护。

alter table public.food_entries add column if not exists incoming_id uuid;
create unique index if not exists food_entries_incoming_id_unique
  on public.food_entries (incoming_id) where incoming_id is not null;
create policy "food update own" on public.food_entries
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table public.chat_sync_mailboxes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  inbox_code uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table public.chat_sync_inbox (
  id uuid primary key default gen_random_uuid(),
  inbox_code uuid not null references public.chat_sync_mailboxes(inbox_code) on delete cascade,
  entry_date date not null,
  meal text not null check (meal in ('早餐','午餐','晚餐','加餐')),
  calories integer not null check (calories between 0 and 10000),
  note text,
  photos jsonb not null default '[]'::jsonb check (jsonb_typeof(photos) = 'array'),
  source_key text unique,
  created_at timestamptz not null default now()
);

alter table public.chat_sync_mailboxes enable row level security;
alter table public.chat_sync_inbox enable row level security;
create policy "own mailbox read" on public.chat_sync_mailboxes
  for select to authenticated using (auth.uid() = user_id);
create policy "own mailbox create" on public.chat_sync_mailboxes
  for insert to authenticated with check (auth.uid() = user_id);
create policy "read own pending" on public.chat_sync_inbox
  for select to authenticated using (
    exists (
      select 1 from public.chat_sync_mailboxes b
      where b.inbox_code = chat_sync_inbox.inbox_code and b.user_id = auth.uid()
    )
  );
create policy "delete own pending" on public.chat_sync_inbox
  for delete to authenticated using (
    exists (
      select 1 from public.chat_sync_mailboxes b
      where b.inbox_code = chat_sync_inbox.inbox_code and b.user_id = auth.uid()
    )
  );

grant select, insert on public.chat_sync_mailboxes to authenticated;
grant select, delete on public.chat_sync_inbox to authenticated;
-- 故意不向 authenticated 角色授予待处理队列的 INSERT。
-- 入队须通过用户已授权的后端或 Supabase 管理连接器执行。
