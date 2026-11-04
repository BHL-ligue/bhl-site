
alter table public.bhl_news add column inline_image_paths text[] not null default '{}';
create index bhl_news_inline_image_paths_idx on public.bhl_news using gin(inline_image_paths);
create function public.bhl_news_inline_images_guard() returns trigger language plpgsql set search_path='' as $$
declare image_path text; previous_paths text[];
begin
 previous_paths:=case when TG_OP='UPDATE' then old.inline_image_paths else '{}'::text[] end;
 if new.body_format='html' then
  select coalesce(array_agg(distinct m[1]),'{}'::text[]) into new.inline_image_paths from regexp_matches(new.body,'data-bhl-image="([^"]+)"','g') as m;
 else new.inline_image_paths:='{}'; end if;
 if cardinality(new.inline_image_paths)>20 then raise exception 'Maximum de 20 images par article';end if;
 foreach image_path in array new.inline_image_paths loop
  if image_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}[.]webp$' then raise exception 'Image d’article invalide';end if;
  if not(image_path=any(previous_paths)) and split_part(image_path,'/',1) is distinct from auth.uid()::text then raise exception 'Utilise une image importée dans ton compte' using errcode='42501';end if;
 end loop;
 return new;
end $$;
create trigger bhl_news_inline_images_guard before insert or update on public.bhl_news for each row execute function public.bhl_news_inline_images_guard();
alter policy bhl_news_image_public_read on storage.objects to anon,authenticated using(bucket_id='bhl-news-images' and exists(select 1 from public.bhl_news n where n.status='published' and (n.cover_path=objects.name or n.inline_image_paths @> array[objects.name])));
