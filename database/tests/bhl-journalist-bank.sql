
begin;
select set_config('bhl.bank_a',(select user_id::text from public.bhl_profiles where role='dg' and team_id is not null order by user_id limit 1),true);
select set_config('bhl.bank_b',(select user_id::text from public.bhl_profiles where role='dg' and team_id is not null order by user_id offset 1 limit 1),true);
select set_config('bhl.bank_admin',(select json_build_object('sub',user_id,'email',email,'role','authenticated')::text from public.bhl_profiles where role='admin' limit 1),true);
select set_config('bhl.bank_j1',gen_random_uuid()::text,true),set_config('bhl.bank_j2',gen_random_uuid()::text,true),set_config('bhl.bank_article',gen_random_uuid()::text,true);
insert into public.bhl_journalists(id,name) values(current_setting('bhl.bank_j1')::uuid,'Bank check '||gen_random_uuid()::text),(current_setting('bhl.bank_j2')::uuid,'Bank check '||gen_random_uuid()::text);
select set_config('request.jwt.claims',json_build_object('sub',current_setting('bhl.bank_a'),'role','authenticated')::text,true);
set local role authenticated;
do $$
declare affected int;
begin
 if not exists(select 1 from public.bhl_journalists where id=current_setting('bhl.bank_j1')::uuid) then raise exception 'Available reporter hidden';end if;
 begin
  insert into public.bhl_news(id,title,author_id,status,journalist_id,category,article_date,season,summary,body,media_name,reporter_name) values(current_setting('bhl.bank_article')::uuid,'Bank test',auth.uid(),'draft',current_setting('bhl.bank_j1')::uuid,'Ligue',current_date,'2026-27','','','','');
  raise exception 'Unclaimed reporter allowed in article';
 exception when insufficient_privilege then null;end;
 begin
  update public.bhl_journalists set name='Tampered',owner_id=auth.uid() where id=current_setting('bhl.bank_j2')::uuid;
  raise exception 'DG altered reporter';
 exception when insufficient_privilege then null;end;
 update public.bhl_journalists set owner_id=auth.uid() where id=current_setting('bhl.bank_j1')::uuid and owner_id is null;
 get diagnostics affected=row_count;if affected<>1 then raise exception 'Claim failed';end if;
 if not exists(select 1 from public.bhl_journalists j join public.bhl_profiles p on p.user_id=j.owner_id where j.id=current_setting('bhl.bank_j1')::uuid and j.team_id=p.team_id) then raise exception 'Claim team mismatch';end if;
 update public.bhl_journalists set owner_id=null where id=current_setting('bhl.bank_j1')::uuid;
 get diagnostics affected=row_count;if affected<>0 then raise exception 'DG can release owned reporter';end if;
 insert into public.bhl_news(id,title,author_id,status,journalist_id,category,article_date,season,summary,body,media_name,reporter_name) values(current_setting('bhl.bank_article')::uuid,'Bank test',auth.uid(),'pending',current_setting('bhl.bank_j1')::uuid,'Ligue',current_date,'2026-27','Test summary','Test body','Test media','');
end $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('bhl.bank_b'),'role','authenticated')::text,true);
set local role authenticated;
do $$ declare affected int; begin
 update public.bhl_journalists set owner_id=auth.uid() where id=current_setting('bhl.bank_j1')::uuid and owner_id is null;
 get diagnostics affected=row_count;if affected<>0 then raise exception 'Second account claimed owned reporter';end if;
 if exists(select 1 from public.bhl_journalists where id=current_setting('bhl.bank_j1')::uuid) then raise exception 'Other owner reporter visible';end if;
end $$;
reset role;
select set_config('request.jwt.claims',current_setting('bhl.bank_admin'),true);
set local role authenticated;
update public.bhl_news set status='published' where id=current_setting('bhl.bank_article')::uuid;
update public.bhl_journalists set owner_id=null,team_id=null where id=current_setting('bhl.bank_j1')::uuid;
do $$ begin if not exists(select 1 from public.bhl_journalists where id=current_setting('bhl.bank_j1')::uuid and owner_id is null) then raise exception 'Admin release failed';end if;end $$;
delete from public.bhl_journalists where id=current_setting('bhl.bank_j1')::uuid;
do $$ begin if not exists(select 1 from public.bhl_news where id=current_setting('bhl.bank_article')::uuid and journalist_id is null and reporter_name like 'Bank check %' and status='published') then raise exception 'Historical signature not preserved after deletion';end if;end $$;
rollback;
select 'Bank visibility, exclusive claim, assigned team, DG restrictions, admin release and deletion with published signature preservation passed' as checks;
