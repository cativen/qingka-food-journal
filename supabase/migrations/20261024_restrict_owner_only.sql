-- Restrict this personal app to the verified Google account cativenll@gmail.com.
-- The UUID is taken from auth.users; it is not a secret and cannot be impersonated via a signed Supabase JWT.
-- Applies on top of supabase/schema.sql and the sync queue setup.
alter policy "food select own" on public.food_entries using (auth.uid()=user_id and auth.uid()='1db152f5-37b0-4430-8cd9-7078812bfdf7'::uuid);
alter policy "food insert own" on public.food_entries with check (auth.uid()=user_id and auth.uid()='1db152f5-37b0-4430-8cd9-7078812bfdf7'::uuid);
alter policy "food update own" on public.food_entries using (auth.uid()=user_id and auth.uid()='1db152f5-37b0-4430-8cd9-7078812bfdf7'::uuid) with check (auth.uid()=user_id and auth.uid()='1db152f5-37b0-4430-8cd9-7078812bfdf7'::uuid);
alter policy "food delete own" on public.food_entries using (auth.uid()=user_id and auth.uid()='1db152f5-37b0-4430-8cd9-7078812bfdf7'::uuid);
alter policy "weight select own" on public.weight_entries using (auth.uid()=user_id and auth.uid()='1db152f5-37b0-4430-8cd9-7078812bfdf7'::uuid);
alter policy "weight insert own" on public.weight_entries with check (auth.uid()=user_id and auth.uid()='1db152f5-37b0-4430-8cd9-7078812bfdf7'::uuid);
alter policy "weight update own" on public.weight_entries using (auth.uid()=user_id and auth.uid()='1db152f5-37b0-4430-8cd9-7078812bfdf7'::uuid) with check (auth.uid()=user_id and auth.uid()='1db152f5-37b0-4430-8cd9-7078812bfdf7'::uuid);
alter policy "own mailbox read" on public.chat_sync_mailboxes using (auth.uid()=user_id and auth.uid()='1db152f5-37b0-4430-8cd9-7078812bfdf7'::uuid);
alter policy "own mailbox create" on public.chat_sync_mailboxes with check (auth.uid()=user_id and auth.uid()='1db152f5-37b0-4430-8cd9-7078812bfdf7'::uuid);
alter policy "read own pending" on public.chat_sync_inbox using (auth.uid()='1db152f5-37b0-4430-8cd9-7078812bfdf7'::uuid and exists(select 1 from public.chat_sync_mailboxes b where b.inbox_code=chat_sync_inbox.inbox_code and b.user_id=auth.uid()));
alter policy "delete own pending" on public.chat_sync_inbox using (auth.uid()='1db152f5-37b0-4430-8cd9-7078812bfdf7'::uuid and exists(select 1 from public.chat_sync_mailboxes b where b.inbox_code=chat_sync_inbox.inbox_code and b.user_id=auth.uid()));
alter policy "photos own read" on storage.objects using (bucket_id='meal-photos' and (storage.foldername(name))[1]=auth.uid()::text and auth.uid()='1db152f5-37b0-4430-8cd9-7078812bfdf7'::uuid);
alter policy "photos own insert" on storage.objects with check (bucket_id='meal-photos' and (storage.foldername(name))[1]=auth.uid()::text and auth.uid()='1db152f5-37b0-4430-8cd9-7078812bfdf7'::uuid);
alter policy "photos own delete" on storage.objects using (bucket_id='meal-photos' and (storage.foldername(name))[1]=auth.uid()::text and auth.uid()='1db152f5-37b0-4430-8cd9-7078812bfdf7'::uuid);
