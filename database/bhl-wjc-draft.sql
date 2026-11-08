-- Junior pool: one locked state per edition; all mutations go through a checked RPC.
create schema if not exists bhl_private;
create table public.bhl_wjc_drafts (
 year integer primary key check (year between 2027 and 2100),
 status text not null default 'setup' check(status in ('setup','open','paused','complete')),
 config jsonb not null default '{"teams":[],"players":[],"order":[]}',
 selections jsonb not null default '[]',
 revision integer not null default 1,
 updated_at timestamptz not null default now(),
 check(jsonb_typeof(config)='object' and jsonb_typeof(selections)='array')
);
alter table public.bhl_wjc_drafts enable row level security;
create table bhl_private.wjc_audit (
 id bigint generated always as identity primary key,
 year integer not null references public.bhl_wjc_drafts(year),
 action text not null, actor uuid not null, created_at timestamptz not null default now(), detail jsonb
);
create index wjc_audit_year_idx on bhl_private.wjc_audit(year);
alter table bhl_private.wjc_audit enable row level security;
revoke all on bhl_private.wjc_audit from public,anon,authenticated;
revoke all on public.bhl_wjc_drafts from anon,authenticated;
grant select(year,status,config,selections,revision,updated_at) on public.bhl_wjc_drafts to authenticated;
create policy wjc_participants_read on public.bhl_wjc_drafts for select to authenticated using (
 exists(select 1 from public.bhl_profiles p where p.user_id=(select auth.uid()) and
 (p.role='admin' or (p.role='dg' and exists(select 1 from jsonb_array_elements(config->'teams') t where t->'dgIds' ? (select auth.uid())::text))))
);

create function bhl_private.wjc_validate(c jsonb, picks jsonb, opening boolean) returns void
language plpgsql security invoker set search_path='' as $$
declare t jsonb; p jsonb; s jsonb; tid text; ids text[]:='{}'; names text[]:='{}'; u text; n integer; k integer; slots integer; cap integer;
begin
 if jsonb_typeof(c) is distinct from 'object' or jsonb_typeof(c->'teams') is distinct from 'array' or jsonb_typeof(c->'players') is distinct from 'array' or jsonb_typeof(c->'order') is distinct from 'array' then raise exception 'Configuration invalide'; end if;
 if jsonb_array_length(c->'teams')>32 or jsonb_array_length(c->'players')>1000 or jsonb_array_length(c->'order')>1000 then raise exception 'Configuration trop volumineuse';end if;
 for t in select value from jsonb_array_elements(c->'teams') loop
  tid:=t->>'id';cap:=(t->>'capacity')::integer;
  if tid is null or tid !~ '^[a-z0-9_-]{1,80}$' or tid=any(ids) or coalesce(char_length(trim(t->>'name')),0) not between 1 and 100 or cap is null or cap not between 1 and 100 or jsonb_typeof(t->'dgIds') is distinct from 'array' then raise exception 'Équipe invalide : nom, identifiant, total de joueurs ou DG';end if;
  ids:=array_append(ids,tid);
  if jsonb_array_length(t->'dgIds')>10 then raise exception 'Trop de DG pour une équipe';end if;
  for u in select jsonb_array_elements_text(t->'dgIds') loop
   if not exists(select 1 from public.bhl_profiles where user_id=u::uuid and role in ('dg','admin')) then raise exception 'Le compte choisi doit être un DG approuvé';end if;
  end loop;
  if opening and jsonb_array_length(t->'dgIds')=0 then raise exception 'Associe un DG à chaque équipe avant l’ouverture';end if;
 end loop;
 for p in select value from jsonb_array_elements(c->'players') loop
  if coalesce(p->>'id','') !~ '^[a-z0-9_-]{1,160}$' or coalesce(char_length(trim(p->>'name')),0) not between 1 and 120 or lower(trim(p->>'name'))=any(names) or (select count(*) from jsonb_array_elements(c->'players') x where x->>'id'=p->>'id')<>1 then raise exception 'Joueur invalide ou doublon';end if;
  names:=array_append(names,lower(trim(p->>'name')));
  if char_length(coalesce(p->>'position',''))>30 or char_length(coalesce(p->>'country',''))>80 then raise exception 'Position ou pays trop long';end if;
  if nullif(p->>'keeperTeamId','') is not null and not (p->>'keeperTeamId'=any(ids)) then raise exception 'Équipe du joueur conservé inconnue';end if;
 end loop;
 for tid in select jsonb_array_elements_text(c->'order') loop
  if tid is null or not(tid=any(ids)) then raise exception 'Équipe inconnue dans l’ordre des choix';end if;
 end loop;
 n:=0;
 for s in select value from jsonb_array_elements(picks) loop
  if (s->>'pick')::integer<>n+1 or s->>'teamId' is distinct from c->'order'->>n then raise exception 'Les choix déjà faits doivent garder leur ordre et leur équipe';end if;
  if not exists(select 1 from jsonb_array_elements(c->'players') x where x->>'id'=s->>'playerId' and nullif(x->>'keeperTeamId','') is null) then raise exception 'Un joueur sélectionné doit rester dans la liste et ne peut pas devenir un joueur conservé';end if;
  if (select count(*) from jsonb_array_elements(picks) x where x->>'playerId'=s->>'playerId')<>1 then raise exception 'Joueur déjà sélectionné';end if;
  n:=n+1;
 end loop;
 for t in select value from jsonb_array_elements(c->'teams') loop
  tid:=t->>'id';cap:=(t->>'capacity')::integer;
  select count(*) into k from jsonb_array_elements(c->'players') x where x->>'keeperTeamId'=tid;
  select count(*) into slots from jsonb_array_elements_text(c->'order') x where x=tid;
  if k+slots>cap then raise exception '% : joueurs conservés + choix dépassent le total prévu (%)',t->>'name',cap;end if;
  if opening and k+slots<>cap then raise exception '% : il faut % choix (conservés : %, total : %)',t->>'name',cap-k,k,cap;end if;
 end loop;
 if opening then
  if cardinality(ids)=0 or jsonb_array_length(c->'order')=0 then raise exception 'Ajoute des équipes et un ordre de choix';end if;
  select count(*) into k from jsonb_array_elements(c->'players') x where nullif(x->>'keeperTeamId','') is null;
  if k<jsonb_array_length(c->'order') then raise exception 'La liste disponible ne suffit pas à remplir tous les choix';end if;
 end if;
end $$;

create function bhl_private.wjc_mutate(p_year integer,p_action text,p_payload jsonb,p_revision integer) returns integer
language plpgsql security definer set search_path='' as $$
declare d public.bhl_wjc_drafts%rowtype; role_name text; me uuid:=auth.uid(); team jsonb; player jsonb; tid text; next_pick integer; event jsonb;
begin
 if me is null then raise exception 'Connexion requise' using errcode='42501';end if;
 select role into role_name from public.bhl_profiles where user_id=me;
 if role_name is null or role_name not in ('admin','dg') then raise exception 'Compte non autorisé' using errcode='42501';end if;
 select * into d from public.bhl_wjc_drafts where year=p_year for update;
 if not found then raise exception 'Édition introuvable';end if;
 if p_revision is distinct from d.revision then raise exception 'Le repêchage a changé. Actualise puis confirme de nouveau.' using errcode='40001';end if;
 if p_action<>'pick' and role_name<>'admin' then raise exception 'Réservé à l’administration' using errcode='42501';end if;
 if p_action='save' then
  if d.status not in ('setup','paused') then raise exception 'Mets le repêchage en pause avant de modifier la préparation';end if;
  perform bhl_private.wjc_validate(p_payload,d.selections,false);d.config:=p_payload;
 elsif p_action='open' then
  if d.status not in ('setup','paused') then raise exception 'Repêchage déjà ouvert ou terminé';end if;
  perform bhl_private.wjc_validate(d.config,d.selections,true);
  if jsonb_array_length(d.selections)>=jsonb_array_length(d.config->'order') then raise exception 'Tous les choix sont déjà faits';end if;
  d.status:='open';
 elsif p_action='pause' then
  if d.status<>'open' then raise exception 'Le repêchage n’est pas ouvert';end if;d.status:='paused';
 elsif p_action='undo' then
  if d.status not in ('paused','complete') or jsonb_array_length(d.selections)=0 then raise exception 'Mets le repêchage en pause et vérifie le dernier choix';end if;
  event:=d.selections->-1;d.selections:=d.selections-(jsonb_array_length(d.selections)-1);d.status:='paused';
 elsif p_action='pick' then
  if d.status<>'open' then raise exception 'Le repêchage n’est pas ouvert';end if;
  next_pick:=jsonb_array_length(d.selections);tid:=d.config->'order'->>next_pick;
  select value into team from jsonb_array_elements(d.config->'teams') where value->>'id'=tid;
  if team is null or (role_name<>'admin' and not(team->'dgIds' ? me::text)) then raise exception 'Ce n’est pas ton tour' using errcode='42501';end if;
  select value into player from jsonb_array_elements(d.config->'players') where value->>'id'=p_payload->>'playerId';
  if player is null or nullif(player->>'keeperTeamId','') is not null or exists(select 1 from jsonb_array_elements(d.selections) s where s->>'playerId'=player->>'id') then raise exception 'Ce joueur n’est plus disponible';end if;
  event:=jsonb_build_object('pick',next_pick+1,'teamId',tid,'playerId',player->>'id','by',me,'at',clock_timestamp());
  d.selections:=d.selections||jsonb_build_array(event);
  if jsonb_array_length(d.selections)=jsonb_array_length(d.config->'order') then d.status:='complete';end if;
 else raise exception 'Action inconnue';end if;
 update public.bhl_wjc_drafts set config=d.config,selections=d.selections,status=d.status,revision=revision+1,updated_at=clock_timestamp() where year=p_year returning revision into next_pick;
 insert into bhl_private.wjc_audit(year,action,actor,detail) values(p_year,p_action,me,event);
 return next_pick;
end $$;
-- Exposed wrapper has no elevated privileges. Private implementation enforces identity,
-- fresh revision, turn, availability and edition lock in one transaction.
create function public.bhl_wjc_action(p_year integer,p_action text,p_payload jsonb,p_revision integer) returns integer
language sql security invoker set search_path='' as $$ select bhl_private.wjc_mutate(p_year,p_action,p_payload,p_revision); $$;
revoke all on function bhl_private.wjc_validate(jsonb,jsonb,boolean) from public,anon,authenticated;
revoke all on function bhl_private.wjc_mutate(integer,text,jsonb,integer) from public,anon,authenticated;
revoke all on function public.bhl_wjc_action(integer,text,jsonb,integer) from public,anon,authenticated;
grant usage on schema bhl_private to authenticated;
grant execute on function bhl_private.wjc_mutate(integer,text,jsonb,integer) to authenticated;
grant execute on function public.bhl_wjc_action(integer,text,jsonb,integer) to authenticated;
insert into public.bhl_wjc_drafts(year) values(2027);
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='bhl_wjc_drafts') then alter publication supabase_realtime add table public.bhl_wjc_drafts;end if;
end $$;
