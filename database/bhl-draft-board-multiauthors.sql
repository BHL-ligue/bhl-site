create table public.bhl_draft_boards (
 year integer primary key check(year between 2027 and 2100),
 source_name text not null default 'Centrale de repêchage BHL' check(char_length(source_name)<=200),
 prospects jsonb not null default '[]'::jsonb check(jsonb_typeof(prospects)='array' and jsonb_array_length(prospects)<=500),
 revision integer not null default 1,
 updated_at timestamptz not null default now()
);
alter table public.bhl_draft_boards enable row level security;
grant select on public.bhl_draft_boards to anon,authenticated;
grant insert,update on public.bhl_draft_boards to authenticated;
create policy draft_board_read on public.bhl_draft_boards for select to anon,authenticated using(true);
create policy draft_board_admin_insert on public.bhl_draft_boards for insert to authenticated with check(exists(select 1 from public.bhl_profiles where user_id=(select auth.uid()) and role='admin'));
create policy draft_board_admin_update on public.bhl_draft_boards for update to authenticated using(exists(select 1 from public.bhl_profiles where user_id=(select auth.uid()) and role='admin')) with check(exists(select 1 from public.bhl_profiles where user_id=(select auth.uid()) and role='admin'));
insert into public.bhl_draft_boards(year) values(2027);
create function public.bhl_draft_board_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare p jsonb; ranks integer[]:='{}'; names text[]:='{}'; r integer; n text;
begin
 for p in select value from jsonb_array_elements(new.prospects) loop
  r:=(p->>'rank')::integer;n:=trim(p->>'name');
  if r is null or r<1 or r>500 or r=any(ranks) or n is null or char_length(n) not between 1 and 120 or lower(n)=any(names) or coalesce(p->>'position','') !~ '^(C|LW|RW|D|G|F)(/(C|LW|RW|D|G|F))*$' then raise exception 'Espoir invalide ou doublon';end if;
  ranks:=array_append(ranks,r);names:=array_append(names,lower(n));
 end loop;
 if TG_OP='UPDATE' then new.revision:=old.revision+1;end if;new.updated_at:=clock_timestamp();return new;
end $$;
create trigger draft_board_guard before insert or update on public.bhl_draft_boards for each row execute function public.bhl_draft_board_guard();
alter table public.bhl_news add column journalist_ids uuid[] not null default '{}';
alter table public.bhl_news add column reporter_names text[] not null default '{}';
alter table public.bhl_news drop constraint bhl_news_reporter_name_check;
alter table public.bhl_news add constraint bhl_news_reporter_name_check check(char_length(reporter_name)<=1000);
alter table public.bhl_news add constraint bhl_news_authors_limit check(cardinality(journalist_ids)<=5 and cardinality(reporter_names)<=5);
create or replace function public.bhl_news_journalist_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare j public.bhl_journalists%rowtype; admin boolean; ids uuid[]; pid uuid; names text[]:='{}';
begin
 select role='admin' into admin from public.bhl_profiles where user_id=auth.uid();
 if cardinality(new.team_tags)>16 or exists(select 1 from unnest(new.team_tags) t where t is null or not exists(select 1 from public.bhl_teams where team_id=t)) then raise exception 'Tag équipe invalide';end if;
 ids:=new.journalist_ids;
 if cardinality(ids)=0 and new.journalist_id is not null then ids:=array[new.journalist_id];end if;
 if TG_OP='UPDATE' and new.journalist_id is distinct from old.journalist_id and new.journalist_ids=old.journalist_ids then ids:=case when new.journalist_id is null then '{}'::uuid[] else array[new.journalist_id] end;end if;
 if cardinality(ids)>0 then
  if cardinality(ids)>5 or cardinality(ids)<>(select count(distinct x) from unnest(ids) x) or array_position(ids,null) is not null then raise exception 'Choisis entre un et cinq auteurs distincts';end if;
  foreach pid in array ids loop
   select * into j from public.bhl_journalists where id=pid;
   if j.id is null or (not coalesce(admin,false) and j.owner_id is distinct from auth.uid()) then raise exception 'Choisis des journalistes attribués à ton compte' using errcode='42501';end if;
   names:=array_append(names,j.name);
  end loop;
  new.journalist_ids:=ids;new.journalist_id:=ids[1];new.reporter_names:=names;new.reporter_name:=array_to_string(names,' et ');
 elsif TG_OP='UPDATE' and coalesce(admin,false) and old.journalist_id is null and nullif(old.reporter_name,'') is not null and new.reporter_name=old.reporter_name then
  new.reporter_name:=old.reporter_name;new.reporter_names:=old.reporter_names;
 else
  if new.status<>'draft' then raise exception 'Choisis un journaliste avant la soumission';end if;
  new.reporter_name:='';new.reporter_names:='{}';new.journalist_ids:='{}';new.journalist_id:=null;
 end if;
 return new;
end $$;
create or replace view public.bhl_news_authors with(security_invoker=true) as
 select distinct unnest(case when cardinality(reporter_names)>0 then reporter_names else array[reporter_name] end) reporter_name from public.bhl_news where status='published' and nullif(trim(reporter_name),'') is not null;
