begin;
create temp table delete_test as select
 (select user_id from public.bhl_profiles where role='dg' order by created_at limit 1) dg,
 (select user_id from public.bhl_profiles where role='admin' limit 1) admin,
 gen_random_uuid() article;
grant select on delete_test to authenticated,anon;
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',dg,'role','authenticated')::text,true) is not null from delete_test;
insert into public.bhl_news(id,author_id,title,summary,body,category,status) select article,dg,'__DELETE_TEST__','Résumé','Texte de test','Ligue','pending' from delete_test;
do $$ declare n int; begin
 delete from public.bhl_news where id=(select article from delete_test);get diagnostics n=row_count;
 if n<>0 then raise exception 'DG deleted own article';end if;
end $$;
reset role;
set local role anon;
select set_config('request.jwt.claims','{}',true) is not null;
do $$ begin
 begin
 delete from public.bhl_news where id=(select article from delete_test);
 raise exception 'Anonymous delete allowed';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',admin,'role','authenticated')::text,true) is not null from delete_test;
update public.bhl_news set status='published' where id=(select article from delete_test);
do $$ declare n int;begin
 delete from public.bhl_news where id=(select article from delete_test) and updated_at='2000-01-01'::timestamptz;get diagnostics n=row_count;
 if n<>0 then raise exception 'Stale delete overwrote newer article';end if;
 delete from public.bhl_news where id=(select article from delete_test);get diagnostics n=row_count;
 if n<>1 then raise exception 'Admin could not delete article';end if;
end $$;
reset role;
set local role anon;
select set_config('request.jwt.claims','{}',true) is not null;
do $$ begin
 if exists(select 1 from public.bhl_news where id=(select article from delete_test)) then raise exception 'Deleted article still publicly readable';end if;
end $$;
reset role;
select 'PASS: admin deletion allowed, DG and visitor deletion denied, stale deletion rejected, deleted article no longer public' as result;
rollback;
