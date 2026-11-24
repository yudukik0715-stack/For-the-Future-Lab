-- 画像の置き場（Storage）。SQL Editor に貼って Run。1回だけでOK。
-- 自分の画像は自分しか見られない「非公開」の置き場にする。
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('images', 'images', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

drop policy if exists "own images: read"   on storage.objects;
drop policy if exists "own images: upload" on storage.objects;
drop policy if exists "own images: update" on storage.objects;
drop policy if exists "own images: delete" on storage.objects;

-- 画像は「自分のユーザーID/ファイル名」に置く。自分のフォルダだけ触れる。
create policy "own images: read" on storage.objects for select to authenticated
  using (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own images: upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own images: update" on storage.objects for update to authenticated
  using (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own images: delete" on storage.objects for delete to authenticated
  using (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);
