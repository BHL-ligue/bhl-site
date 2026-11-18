-- Publish only the same harmless player fields as the existing public roster.
create or replace function bhl_private.wjc_public_candidate(p jsonb) returns jsonb
language sql immutable security invoker set search_path='' as $$
 select jsonb_build_object('id',left(p->>'id',160),'name',left(p->>'name',120),
 'position',left(p->>'position',24),'country',left(p->>'country',80),
 'birthYear',case when p->>'birthYear' ~ '^[0-9]{4}$' then (p->>'birthYear')::integer else null end);
$$;
revoke all on function bhl_private.wjc_public_candidate(jsonb) from public,anon,authenticated;
create or replace function bhl_private.wjc_public_draft(c jsonb,s jsonb,stage text) returns jsonb
language sql immutable security invoker set search_path='' as $$
 select jsonb_build_object('status',stage,'completed',jsonb_array_length(s),'picks',
 coalesce((select jsonb_agg(jsonb_build_object('number',o.n,'teamId',o.id,
 'player',(select bhl_private.wjc_public_candidate(p)
 from jsonb_array_elements(c->'players')p where p->>'id'=s->(o.n::integer-1)->>'playerId')) order by o.n)
 from jsonb_array_elements_text(c->'order') with ordinality o(id,n)),'[]'::jsonb),
 'targets',coalesce((select jsonb_agg(bhl_private.wjc_public_candidate(p))
 from (select value as p from jsonb_array_elements(case when jsonb_typeof(c->'targets')='array' then c->'targets' else '[]'::jsonb end) where nullif(trim(value->>'name'),'') is not null limit 1000)q),'[]'::jsonb),
 'available',coalesce((select jsonb_agg(bhl_private.wjc_public_candidate(p)) from jsonb_array_elements(c->'players')p
 where nullif(p->>'keeperTeamId','') is null and not exists(select 1 from jsonb_array_elements(s)pick where pick->>'playerId'=p->>'id')),'[]'::jsonb));
$$;
revoke all on function bhl_private.wjc_public_draft(jsonb,jsonb,text) from public,anon,authenticated;
update public.bhl_wjc_public_rosters r set payload=r.payload || jsonb_build_object('draft',bhl_private.wjc_public_draft(d.config,d.selections,d.status)),updated_at=clock_timestamp()
from public.bhl_wjc_drafts d where d.year=r.year;
