begin;
create temp table news_meta_test as select
 (select user_id from public.bhl_profiles where role='dg' order by created_at limit 1) dg,
 (select user_id from public.bhl_profiles where role='admin' limit 1) admin,
 gen_random_uuid() article;
grant select on news_meta_test to authenticated,anon;
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',dg,'role','authenticated')::text,true) is not null from news_meta_test;
insert into public.bhl_news(id,author_id,title,summary,body,category,status,article_date,season,reporter_name,media_name) select article,dg,'__META_TEST__','Résumé','Article historique','Ligue','pending',date '2018-11-15','2018-19','Jean de Démonstration','Le Journal de Démonstration' from news_meta_test;
do $$ begin
 if not exists(select 1 from public.bhl_news where id=(select article from news_meta_test) and article_date=date '2018-11-15' and season='2018-19' and reporter_name='Jean de Démonstration' and media_name='Le Journal de Démonstration' and author_id=auth.uid()) then raise exception 'Historical metadata not saved';end if;
 begin
 update public.bhl_news set season='2018-20' where id=(select article from news_meta_test);
 raise exception 'Invalid season accepted';
 exception when check_violation then null;end;
end $$;
reset role;
set local role anon;
select set_config('request.jwt.claims','{}',true) is not null;
do $$ begin
 if exists(select 1 from public.bhl_news where id=(select article from news_meta_test)) then raise exception 'Visitor saw draft';end if;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',admin,'role','authenticated')::text,true) is not null from news_meta_test;
update public.bhl_news set status='published',reporter_name='Jean de Démonstration corrigé' where id=(select article from news_meta_test);
do $$ begin
 if not exists(select 1 from public.bhl_news where id=(select article from news_meta_test) and article_date=date '2018-11-15' and published_at>date '2020-01-01' and author_id=(select dg from news_meta_test) and reporter_name='Jean de Démonstration corrigé') then raise exception 'Approval changed history or ownership';end if;
end $$;
reset role;
set local role anon;
select set_config('request.jwt.claims','{}',true) is not null;
do $$ begin
 if not exists(select 1 from public.bhl_news_seasons where season='2018-19') then raise exception 'Published season inaccessible';end if;
 if not exists(select 1 from public.bhl_news where id=(select article from news_meta_test) and reporter_name='Jean de Démonstration corrigé' and media_name='Le Journal de Démonstration') then raise exception 'Published byline inaccessible';end if;
end $$;
reset role;
select 'PASS: historical date, season validation, fictional reporter/media, ownership preserved, independent publication date, public season/byline and draft privacy' as result;
rollback;
