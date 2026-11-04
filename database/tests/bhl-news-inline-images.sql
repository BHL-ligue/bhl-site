
begin;
create temp table inline_test as select
 (select user_id from public.bhl_profiles where role='dg' and team_id is not null order by created_at limit 1) dg,
 (select user_id from public.bhl_profiles where role='dg' and team_id is not null order by created_at offset 1 limit 1) other_dg,
 (select user_id from public.bhl_profiles where role='admin' limit 1) admin,
 gen_random_uuid() article,gen_random_uuid() image,gen_random_uuid() journalist;
grant select on inline_test to authenticated,anon;
insert into public.bhl_journalists(id,name,owner_id) select journalist,'Inline test '||journalist::text,dg from inline_test;
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',dg,'role','authenticated')::text,true) from inline_test;
insert into storage.objects(bucket_id,name,owner_id,metadata) select 'bhl-news-images',dg::text||'/'||image::text||'.webp',dg::text,'{"mimetype":"image/webp","size":10}'::jsonb from inline_test;
insert into public.bhl_news(id,author_id,title,summary,body,body_format,category,status,article_date,season,media_name,reporter_name,journalist_id)
 select article,dg,'Inline test','Résumé','<p>Texte</p><img data-bhl-image="'||dg::text||'/'||image::text||'.webp" alt="Test">','html','Ligue','draft',current_date,'2026-27','Média test','',journalist from inline_test;
do $$ begin
 if not exists(select 1 from public.bhl_news where id=(select article from inline_test) and cardinality(inline_image_paths)=1) then raise exception 'Inline reference not derived';end if;
 begin
  update public.bhl_news set body='<img data-bhl-image="'||(select other_dg::text||'/'||image::text||'.webp' from inline_test)||'">' where id=(select article from inline_test);
  raise exception 'Foreign image accepted';
 exception when insufficient_privilege then null;end;
 update public.bhl_news set inline_image_paths=array['fake-reference'] where id=(select article from inline_test);
 if exists(select 1 from public.bhl_news where id=(select article from inline_test) and inline_image_paths=array['fake-reference']) then raise exception 'Client forged image reference';end if;
end $$;
reset role;
set local role anon;
select set_config('request.jwt.claims','{}',true);
do $$ begin if exists(select 1 from storage.objects where bucket_id='bhl-news-images' and name=(select dg::text||'/'||image::text||'.webp' from inline_test)) then raise exception 'Draft image is public';end if;end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',admin,'role','authenticated')::text,true) from inline_test;
update public.bhl_news set status='published' where id=(select article from inline_test);
reset role;
set local role anon;
select set_config('request.jwt.claims','{}',true);
do $$ begin if not exists(select 1 from storage.objects where bucket_id='bhl-news-images' and name=(select dg::text||'/'||image::text||'.webp' from inline_test)) then raise exception 'Published inline image unavailable';end if;end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',admin,'role','authenticated')::text,true) from inline_test;
update public.bhl_news set body='<p>Image retirée</p>' where id=(select article from inline_test);
reset role;
set local role anon;
select set_config('request.jwt.claims','{}',true);
do $$ begin if exists(select 1 from storage.objects where bucket_id='bhl-news-images' and name=(select dg::text||'/'||image::text||'.webp' from inline_test)) then raise exception 'Removed image remains public';end if;end $$;
rollback;
select 'Inline paths derived, foreign image denied, forged reference ignored, draft private, published visible, removed image private; all test data rolled back' as checks;
