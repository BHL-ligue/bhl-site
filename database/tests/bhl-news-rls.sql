begin;
create temp table news_test_context as select
 (select user_id from public.bhl_profiles where role='dg' order by created_at limit 1) dg,
 (select user_id from public.bhl_profiles where role='dg' order by created_at offset 1 limit 1) other_dg,
 (select user_id from public.bhl_profiles where role='admin' limit 1) admin,
 gen_random_uuid() article;
grant select on news_test_context to authenticated,anon;
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',dg,'role','authenticated')::text,true) is not null as claims_set from news_test_context;
insert into public.bhl_news(id,author_id,title,summary,body,category) select article,dg,'Test privé','Résumé de test','Article de test','Ligue' from news_test_context;
do $$ begin
 if (select count(*) from public.bhl_news where id=(select article from news_test_context))<>1 then raise exception 'own draft not readable'; end if;
 begin
 update public.bhl_news set status='published' where id=(select article from news_test_context);
 raise exception 'DG published without approval';
 exception when insufficient_privilege then null; end;
end $$;
update public.bhl_news set status='pending' where id=(select article from news_test_context);
do $$ declare n int; begin
 update public.bhl_news set title='Changed while pending' where id=(select article from news_test_context); get diagnostics n=row_count;
 if n<>0 then raise exception 'DG changed pending article'; end if;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',other_dg,'role','authenticated')::text,true) is not null as other_claims_set from news_test_context;
do $$ begin
 if exists(select 1 from public.bhl_news where id=(select article from news_test_context)) then raise exception 'Another DG read private article'; end if;
 begin
 insert into public.bhl_news(author_id,title,summary,body,category) select dg,'Spoof','Spoof','Spoof','Ligue' from news_test_context;
 raise exception 'Author spoof accepted';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
select set_config('request.jwt.claims','{}',true) is not null as anon_claims_set;
do $$ begin
 if exists(select 1 from public.bhl_news where id=(select article from news_test_context)) then raise exception 'Visitor read pending article'; end if;
 begin
 insert into public.bhl_news(author_id,title,summary,body,category) select dg,'Anon','Anon','Anon','Ligue' from news_test_context;
 raise exception 'Anonymous insert accepted';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',admin,'role','authenticated')::text,true) is not null as admin_claims_set from news_test_context;
do $$ begin
 if not exists(select 1 from public.bhl_news where id=(select article from news_test_context) and status='pending') then raise exception 'Admin cannot see queue'; end if;
end $$;
update public.bhl_news set status='rejected' where id=(select article from news_test_context);
select set_config('request.jwt.claims',json_build_object('sub',dg,'role','authenticated')::text,true) is not null as dg_claims_set from news_test_context;
update public.bhl_news set status='pending',body='Article corrigé' where id=(select article from news_test_context);
select set_config('request.jwt.claims',json_build_object('sub',admin,'role','authenticated')::text,true) is not null as admin_claims_set from news_test_context;
update public.bhl_news set status='published' where id=(select article from news_test_context);
reset role;
set local role anon;
select set_config('request.jwt.claims','{}',true) is not null as anon_claims_set;
do $$ begin
 if not exists(select 1 from public.bhl_news where id=(select article from news_test_context) and published_at is not null and body='Article corrigé') then raise exception 'Approved article not public'; end if;
end $$;
reset role;
select 'PASS: private drafts, owner-only edits, submission lock, rejection/resubmission, admin approval, public read, anonymous write denied, author spoof denied' as result;
rollback;
