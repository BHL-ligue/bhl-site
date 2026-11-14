-- Public projection deliberately omits accounts, draft order and administrative audit.
create table public.bhl_wjc_public_rosters (
 year integer primary key,
 payload jsonb not null,
 updated_at timestamptz not null default now()
);
alter table public.bhl_wjc_public_rosters enable row level security;
revoke all on public.bhl_wjc_public_rosters from public,anon,authenticated;
grant select on public.bhl_wjc_public_rosters to anon,authenticated;
create policy wjc_public_rosters_read on public.bhl_wjc_public_rosters for select to anon,authenticated using(true);
create function bhl_private.wjc_public_payload(c jsonb,s jsonb) returns jsonb
language sql immutable security invoker set search_path='' as $$
 select jsonb_build_object('teams',coalesce((select jsonb_agg(jsonb_build_object(
 'id',t->>'id','archiveId',t->>'archiveId','name',t->>'name','capacity',t->'capacity',
 'players',coalesce((select jsonb_agg(jsonb_build_object('id',p->>'id','name',p->>'name','position',p->>'position','country',p->>'country','birthYear',p->'birthYear',
 'source',case when p->>'keeperTeamId'=t->>'id' then 'keeper' else 'draft' end))
 from jsonb_array_elements(c->'players')p
 where p->>'keeperTeamId'=t->>'id' or exists(select 1 from jsonb_array_elements(s)pick where pick->>'playerId'=p->>'id' and pick->>'teamId'=t->>'id')),'[]'::jsonb)))
 from jsonb_array_elements(c->'teams')t),'[]'::jsonb));
$$;
create function bhl_private.wjc_publish_rosters() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into public.bhl_wjc_public_rosters(year,payload,updated_at)
 values(new.year,bhl_private.wjc_public_payload(new.config,new.selections),clock_timestamp())
 on conflict(year) do update set payload=excluded.payload,updated_at=excluded.updated_at;
 return new;
end $$;
revoke all on function bhl_private.wjc_public_payload(jsonb,jsonb) from public,anon,authenticated;
revoke all on function bhl_private.wjc_publish_rosters() from public,anon,authenticated;
create trigger wjc_publish_rosters after insert or update of config,selections on public.bhl_wjc_drafts for each row execute function bhl_private.wjc_publish_rosters();
insert into public.bhl_wjc_public_rosters(year,payload)
select year,bhl_private.wjc_public_payload(config,selections) from public.bhl_wjc_drafts;
