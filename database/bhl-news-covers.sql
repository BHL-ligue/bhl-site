alter table public.bhl_news
 add column cover_path text,
 add column cover_alt text not null default '' check(char_length(cover_alt)<=200),
 add column cover_caption text not null default '' check(char_length(cover_caption)<=300),
 add constraint bhl_news_cover_owner check(cover_path is null or (
 split_part(cover_path,'/',1)=author_id::text and cover_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'));
create index bhl_news_cover_idx on public.bhl_news(cover_path) where cover_path is not null;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('bhl-news-images','bhl-news-images',false,5242880,array['image/webp']);
create policy bhl_news_image_upload on storage.objects for insert to authenticated with check(
 bucket_id='bhl-news-images' and (storage.foldername(name))[1]=(select auth.uid())::text
 and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'
 and exists(select 1 from public.bhl_profiles p where p.user_id=(select auth.uid()) and (p.role='admin' or (p.role='dg' and p.team_id is not null))));
create policy bhl_news_image_private_read on storage.objects for select to authenticated using(
 bucket_id='bhl-news-images' and (
 (storage.foldername(name))[1]=(select auth.uid())::text or
 exists(select 1 from public.bhl_profiles p where p.user_id=(select auth.uid()) and p.role='admin')));
create policy bhl_news_image_public_read on storage.objects for select to anon,authenticated using(
 bucket_id='bhl-news-images' and exists(select 1 from public.bhl_news n where n.status='published' and n.cover_path=name));
