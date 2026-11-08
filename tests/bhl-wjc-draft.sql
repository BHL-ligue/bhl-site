-- Run in a transaction and roll back all fixtures; uses existing approved identities
-- without altering accounts or sending messages. No identity is recorded in this file.
begin;
do $$
declare a uuid; d1 uuid; d2 uuid; old_role text:=current_user; c jsonb; rev integer; n integer; action_failed boolean;
begin
 select user_id into a from public.bhl_profiles where role='admin' limit 1;
 select user_id into d1 from public.bhl_profiles where role='dg' order by user_id limit 1;
 select user_id into d2 from public.bhl_profiles where role='dg' and user_id<>d1 order by user_id limit 1;
 assert a is not null and d1 is not null and d2 is not null,'Three existing approved identities required';
 c:=jsonb_build_object('teams',jsonb_build_array(jsonb_build_object('id','a','name','Test A','capacity',5,'dgIds',jsonb_build_array(d1)),jsonb_build_object('id','b','name','Test B','capacity',6,'dgIds',jsonb_build_array(d2))),
 'players',(select jsonb_agg(jsonb_build_object('id','p'||i,'name','Test player '||i,'position','C','country','Test','keeperTeamId',case when i in(9,10) then 'a' when i=11 then 'b' else '' end)) from generate_series(1,11) i),
 'order','["b","a","b","b","a","b","a","b"]'::jsonb);
 insert into public.bhl_wjc_drafts(year) values(2099);
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform set_config('role','authenticated',true);
 assert not has_table_privilege('authenticated','public.bhl_wjc_drafts','UPDATE'),'No direct writes';
 assert not has_function_privilege('anon','public.bhl_wjc_action(integer,text,jsonb,integer)','EXECUTE'),'Anonymous RPC denied';
 rev:=public.bhl_wjc_action(2099,'save',c,1);
 rev:=public.bhl_wjc_action(2099,'open','{}',rev);
 -- DG A cannot select for the first team B, or issue admin commands.
 perform set_config('request.jwt.claim.sub',d1::text,true);
 action_failed:=false;begin perform public.bhl_wjc_action(2099,'pick','{"playerId":"p1"}',rev);exception when insufficient_privilege then action_failed:=true;end;assert action_failed,'Wrong turn must fail';
 action_failed:=false;begin perform public.bhl_wjc_action(2099,'pause','{}',rev);exception when insufficient_privilege then action_failed:=true;end;assert action_failed,'DG cannot pause';
 -- An actual participant can see the board through RLS.
 assert (select count(*) from public.bhl_wjc_drafts where year=2099)=1,'Participant can read';
 perform set_config('request.jwt.claim.sub',d2::text,true);
 -- Keepers can never be picked.
 action_failed:=false;begin perform public.bhl_wjc_action(2099,'pick','{"playerId":"p9"}',rev);exception when raise_exception then action_failed:=true;end;assert action_failed,'Keeper must be excluded';
 rev:=public.bhl_wjc_action(2099,'pick','{"playerId":"p1"}',rev);
 -- A duplicated/stale click cannot spill over into the next turn.
 action_failed:=false;begin perform public.bhl_wjc_action(2099,'pick','{"playerId":"p2"}',rev-1);exception when serialization_failure then action_failed:=true;end;assert action_failed,'Stale revision rejected';
 perform set_config('request.jwt.claim.sub',d1::text,true);
 action_failed:=false;begin perform public.bhl_wjc_action(2099,'pick','{"playerId":"p1"}',rev);exception when raise_exception then action_failed:=true;end;assert action_failed,'Duplicate player rejected';
 for n in 2..8 loop
  perform set_config('request.jwt.claim.sub',case when c->'order'->>(n-1)='a' then d1 else d2 end::text,true);
  rev:=public.bhl_wjc_action(2099,'pick',jsonb_build_object('playerId','p'||n),rev);
 end loop;
 assert (select status='complete' and jsonb_array_length(selections)=8 from public.bhl_wjc_drafts where year=2099),'Complete after unequal 3/5 picks';
 perform set_config('request.jwt.claim.sub',a::text,true);
 rev:=public.bhl_wjc_action(2099,'undo','{}',rev);
 assert (select status='paused' and jsonb_array_length(selections)=7 from public.bhl_wjc_drafts where year=2099),'Undo only last pick and pause';
 -- Cannot change an executed turn or make a drafted player a keeper.
 action_failed:=false;begin perform public.bhl_wjc_action(2099,'save',jsonb_set(c,'{order,0}','"a"'),rev);exception when raise_exception then action_failed:=true;end;assert action_failed,'Executed order protected';
 action_failed:=false;begin perform public.bhl_wjc_action(2099,'save',jsonb_set(c,'{players,0,keeperTeamId}','"a"'),rev);exception when raise_exception then action_failed:=true;end;assert action_failed,'Drafted player cannot become keeper';
 -- Pause blocks even an assigned DG. Admin can resume and choose for an absent DG.
 perform set_config('request.jwt.claim.sub',d2::text,true);
 action_failed:=false;begin perform public.bhl_wjc_action(2099,'pick','{"playerId":"p8"}',rev);exception when raise_exception then action_failed:=true;end;assert action_failed,'Pause enforced';
 perform set_config('request.jwt.claim.sub',a::text,true);
 rev:=public.bhl_wjc_action(2099,'open','{}',rev);
 rev:=public.bhl_wjc_action(2099,'pick','{"playerId":"p8"}',rev);
 -- A valid account that is not assigned must not read this edition.
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
 assert (select count(*) from public.bhl_wjc_drafts where year=2099)=0,'Unassigned identity cannot read';
 perform set_config('role',old_role,true);
 assert (select count(*) from bhl_private.wjc_audit where year=2099)=13,'Audit records actions including undo';
end $$;
select 'WJC: role, RLS, custom order 3/5, keeper, duplicate, stale revision, pause, undo and completion checks passed' as verification;
rollback;
