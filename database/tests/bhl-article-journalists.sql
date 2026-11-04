
begin;
select set_config('bhl.test_a',(select user_id::text from public.bhl_profiles where role='dg' order by user_id limit 1),true);
select set_config('bhl.test_b',(select user_id::text from public.bhl_profiles where role='dg' order by user_id offset 1 limit 1),true);
select set_config('bhl.test_j1',gen_random_uuid()::text,true),set_config('bhl.test_j2',gen_random_uuid()::text,true);
insert into public.bhl_journalists(id,name,owner_id) values(current_setting('bhl.test_j1')::uuid,'TEST-'||gen_random_uuid()::text,current_setting('bhl.test_a')::uuid),(current_setting('bhl.test_j2')::uuid,'TEST-'||gen_random_uuid()::text,current_setting('bhl.test_b')::uuid);
select set_config('request.jwt.claims',json_build_object('sub',current_setting('bhl.test_a'),'role','authenticated')::text,true);
set local role authenticated;
do $$
declare article uuid;
begin
 if exists(select 1 from public.bhl_journalists where owner_id<>auth.uid()) then raise exception 'RLS journalist leak';end if;
 insert into public.bhl_news(title,author_id,status,journalist_id,category,article_date,season,summary,body,media_name,reporter_name) values('Temporary verification',auth.uid(),'draft',current_setting('bhl.test_j1')::uuid,'Ligue',current_date,'2026-27','','','','') returning id into article;
 begin
  update public.bhl_news set journalist_id=current_setting('bhl.test_j2')::uuid where id=article;
  raise exception 'Foreign journalist accepted';
 exception when insufficient_privilege then null;end;
 begin
  update public.bhl_news set team_tags=array['INVALID_TEAM'] where id=article;
  raise exception 'Invalid tag accepted';
 exception when raise_exception then if sqlerrm<>'Tag équipe invalide' then raise;end if;end;
 begin
  insert into public.bhl_journalists(name,owner_id) values('Unauthorized journalist',auth.uid());
  raise exception 'DG created reporter';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform * from public.bhl_journalists;raise exception 'Anonymous reporter accounts exposed';exception when insufficient_privilege then null;end;
 perform * from public.bhl_news_authors;
end $$;
rollback;
select 'Journalist ownership, draft save, foreign reporter denial, invalid tag denial, admin-only management and public author read verified' as checks;
