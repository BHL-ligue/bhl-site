begin;
create temp table cover_test as select
 (select user_id from public.bhl_profiles where role='dg' order by created_at limit 1) dg,
 (select user_id from public.bhl_profiles where role='dg' order by created_at offset 1 limit 1) other_dg,
 (select user_id from public.bhl_profiles where role='admin' limit 1) admin,
 gen_random_uuid() article, gen_random_uuid() image;
grant select on cover_test to authenticated,anon;
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',dg,'role','authenticated')::text,true) is not null as owner_session from cover_test;
insert into storage.objects(bucket_id,name,owner_id,metadata) select 'bhl-news-images',dg::text||'/'||image::text||'.webp',dg::text,'{"mimetype":"image/webp","size":10}'::jsonb from cover_test;
insert into public.bhl_news(id,author_id,title,summary,body,category,cover_path,cover_alt,cover_caption) select article,dg,'__COVER_TEST__','Résumé','Article','Ligue',dg::text||'/'||image::text||'.webp','Description','Crédit' from cover_test;
do $$ begin
 if (select count(*) from storage.objects where bucket_id='bhl-news-images' and name=(select dg::text||'/'||image::text||'.webp' from cover_test))<>1 then raise exception 'Owner cannot read image'; end if;
 begin
 update public.bhl_news set cover_path=(select other_dg::text||'/'||image::text||'.webp' from cover_test) where id=(select article from cover_test);
 raise exception 'Other author cover accepted';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',other_dg,'role','authenticated')::text,true) is not null as other_session from cover_test;
do $$ begin
 if exists(select 1 from storage.objects where bucket_id='bhl-news-images' and name=(select dg::text||'/'||image::text||'.webp' from cover_test)) then raise exception 'Other DG read draft image'; end if;
 begin
 insert into storage.objects(bucket_id,name,owner_id) select 'bhl-news-images',dg::text||'/'||gen_random_uuid()::text||'.webp',other_dg::text from cover_test;
 raise exception 'Other folder upload accepted';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
select set_config('request.jwt.claims','{}',true) is not null as visitor_session;
do $$ begin
 if exists(select 1 from storage.objects where bucket_id='bhl-news-images' and name=(select dg::text||'/'||image::text||'.webp' from cover_test)) then raise exception 'Visitor read draft image'; end if;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',admin,'role','authenticated')::text,true) is not null as admin_session from cover_test;
do $$ begin
 if not exists(select 1 from storage.objects where bucket_id='bhl-news-images' and name=(select dg::text||'/'||image::text||'.webp' from cover_test)) then raise exception 'Admin cannot review image'; end if;
end $$;
update public.bhl_news set status='published' where id=(select article from cover_test);
reset role;
set local role anon;
select set_config('request.jwt.claims','{}',true) is not null as visitor_session;
do $$ begin
 if not exists(select 1 from storage.objects where bucket_id='bhl-news-images' and name=(select dg::text||'/'||image::text||'.webp' from cover_test)) then raise exception 'Visitor cannot read approved image'; end if;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',admin,'role','authenticated')::text,true) is not null as admin_session from cover_test;
update public.bhl_news set status='rejected' where id=(select article from cover_test);
reset role;
set local role anon;
select set_config('request.jwt.claims','{}',true) is not null as visitor_session;
do $$ begin
 if exists(select 1 from storage.objects where bucket_id='bhl-news-images' and name=(select dg::text||'/'||image::text||'.webp' from cover_test)) then raise exception 'Visitor can sign a rejected image'; end if;
end $$;
reset role;
select 'PASS: owner upload/read, draft privacy, admin review, approved image access, rejected image hidden, other-author paths denied' as result;
rollback;
