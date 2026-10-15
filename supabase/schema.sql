-- Run in Supabase SQL Editor after creating your Supabase project.
create table if not exists public.food_entries(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 entry_date date not null,
 meal text not null check(meal in ('早餐','午餐','晚餐','加餐')),
 calories integer not null check(calories>=0 and calories<=10000),
 note text,
 photo_paths text[] not null default '{}',
 created_at timestamptz not null default now()
);
create index if not exists food_user_date_idx on public.food_entries(user_id,entry_date desc);
alter table public.food_entries enable row level security;
create policy "food select own" on public.food_entries for select to authenticated using (auth.uid()=user_id);
create policy "food insert own" on public.food_entries for insert to authenticated with check(auth.uid()=user_id);
create policy "food delete own" on public.food_entries for delete to authenticated using(auth.uid()=user_id);
create table if not exists public.weight_entries(
 user_id uuid not null references auth.users(id) on delete cascade,
 entry_date date not null,
 weight_kg numeric(5,1) not null check(weight_kg>0),
 primary key(user_id,entry_date)
);
alter table public.weight_entries enable row level security;
create policy "weight select own" on public.weight_entries for select to authenticated using(auth.uid()=user_id);
create policy "weight insert own" on public.weight_entries for insert to authenticated with check(auth.uid()=user_id);
create policy "weight update own" on public.weight_entries for update to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('meal-photos','meal-photos',false,8388608,array['image/jpeg','image/png','image/webp','image/heic']) on conflict(id) do nothing;
create policy "photos own insert" on storage.objects for insert to authenticated with check(bucket_id='meal-photos' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "photos own read" on storage.objects for select to authenticated using(bucket_id='meal-photos' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "photos own delete" on storage.objects for delete to authenticated using(bucket_id='meal-photos' and (storage.foldername(name))[1]=auth.uid()::text);
