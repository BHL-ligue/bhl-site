-- Public read-only draft board; account identifiers and administrative audit stay private.
create or replace function bhl_private.wjc_public_draft(c jsonb,s jsonb,stage text) returns jsonb
language sql immutable security invoker set search_path='' as $$
 select jsonb_build_object('status',stage,'completed',jsonb_array_length(s),'picks',
 coalesce((select jsonb_agg(jsonb_build_object('number',o.n,'teamId',o.id,
 'player',(select jsonb_build_object('id',p->>'id','name',p->>'name','position',p->>'position','country',p->>'country','birthYear',p->'birthYear')
 from jsonb_array_elements(c->'players')p where p->>'id'=s->(o.n::integer-1)->>'playerId')) order by o.n)
 from jsonb_array_elements_text(c->'order') with ordinality o(id,n)),'[]'::jsonb));
$$;
revoke all on function bhl_private.wjc_public_draft(jsonb,jsonb,text) from public,anon,authenticated;
create or replace function bhl_private.wjc_publish_rosters() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into public.bhl_wjc_public_rosters(year,payload,updated_at)
 values(new.year,bhl_private.wjc_public_payload(new.config,new.selections) ||
 jsonb_build_object('draft',bhl_private.wjc_public_draft(new.config,new.selections,new.status)),clock_timestamp())
 on conflict(year) do update set payload=excluded.payload,updated_at=excluded.updated_at;
 return new;
end $$;
revoke all on function bhl_private.wjc_publish_rosters() from public,anon,authenticated;
drop trigger wjc_publish_rosters on public.bhl_wjc_drafts;
create trigger wjc_publish_rosters after insert or update of config,selections,status on public.bhl_wjc_drafts
 for each row execute function bhl_private.wjc_publish_rosters();
insert into public.bhl_wjc_public_rosters(year,payload,updated_at)
select year,bhl_private.wjc_public_payload(config,selections) ||
 jsonb_build_object('draft',bhl_private.wjc_public_draft(config,selections,status)),clock_timestamp()
from public.bhl_wjc_drafts
on conflict(year) do update set payload=excluded.payload,updated_at=excluded.updated_at;
