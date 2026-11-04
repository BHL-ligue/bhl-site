
create table public.bhl_journalists (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(trim(name)) between 1 and 120),
 media_name text not null default '' check(length(media_name)<=160),
 owner_id uuid not null references public.bhl_profiles(user_id),
 team_id text references public.bhl_teams(team_id),
 created_at timestamptz not null default now()
);
create unique index bhl_journalists_name_unique on public.bhl_journalists(lower(trim(name)));
create index bhl_journalists_owner_idx on public.bhl_journalists(owner_id);
alter table public.bhl_journalists enable row level security;
grant select,insert,update,delete on public.bhl_journalists to authenticated;
create policy journalists_read on public.bhl_journalists for select to authenticated using(owner_id=(select auth.uid()) or exists(select 1 from public.bhl_profiles where user_id=(select auth.uid()) and role='admin'));
create policy journalists_admin on public.bhl_journalists for all to authenticated using(exists(select 1 from public.bhl_profiles where user_id=(select auth.uid()) and role='admin')) with check(exists(select 1 from public.bhl_profiles where user_id=(select auth.uid()) and role='admin'));
alter table public.bhl_news add column journalist_id uuid references public.bhl_journalists(id), add column team_tags text[] not null default '{}';
create index bhl_news_journalist_idx on public.bhl_news(journalist_id);
create index bhl_news_team_tags_idx on public.bhl_news using gin(team_tags);
insert into public.bhl_journalists(name,media_name,owner_id,team_id)
 select distinct on(lower(trim(reporter_name))) trim(reporter_name),coalesce(media_name,''),author_id,team_id from public.bhl_news where nullif(trim(reporter_name),'') is not null order by lower(trim(reporter_name)),updated_at desc;
alter table public.bhl_news disable trigger bhl_news_guard;
update public.bhl_news n set journalist_id=j.id from public.bhl_journalists j where lower(trim(n.reporter_name))=lower(trim(j.name));
alter table public.bhl_news enable trigger bhl_news_guard;
create function public.bhl_news_journalist_guard() returns trigger language plpgsql set search_path='' as $$
declare j public.bhl_journalists%rowtype; admin boolean;
begin
 select role='admin' into admin from public.bhl_profiles where user_id=auth.uid();
 if cardinality(new.team_tags)>16 or exists(select 1 from unnest(new.team_tags) t where t is null or not exists(select 1 from public.bhl_teams where team_id=t)) then raise exception 'Tag équipe invalide'; end if;
 if new.journalist_id is not null then
  select * into j from public.bhl_journalists where id=new.journalist_id;
  if j.id is null or (not coalesce(admin,false) and j.owner_id<>auth.uid()) then raise exception 'Choisis un journaliste attribué à ton compte' using errcode='42501'; end if;
  new.reporter_name:=j.name;
 elsif TG_OP='INSERT' and new.status<>'draft' then raise exception 'Choisis un journaliste avant la soumission';
 elsif TG_OP='UPDATE' and (new.reporter_name is distinct from old.reporter_name or (new.status<>'draft' and new.journalist_id is distinct from old.journalist_id)) then raise exception 'Choisis un journaliste dans la liste';
 end if;
 return new;
end $$;
create trigger bhl_news_journalist_guard before insert or update on public.bhl_news for each row execute function public.bhl_news_journalist_guard();
create view public.bhl_news_authors with(security_invoker=true) as select distinct reporter_name from public.bhl_news where status='published' and nullif(trim(reporter_name),'') is not null;
grant select on public.bhl_news_authors to anon,authenticated;

create or replace function public.bhl_news_journalist_guard() returns trigger language plpgsql set search_path='' as $$
declare j public.bhl_journalists%rowtype; admin boolean;
begin
 select role='admin' into admin from public.bhl_profiles where user_id=auth.uid();
 if cardinality(new.team_tags)>16 or exists(select 1 from unnest(new.team_tags) t where t is null or not exists(select 1 from public.bhl_teams where team_id=t)) then raise exception 'Tag équipe invalide'; end if;
 if new.journalist_id is not null then
  select * into j from public.bhl_journalists where id=new.journalist_id;
  if j.id is null or (not coalesce(admin,false) and j.owner_id<>auth.uid()) then raise exception 'Choisis un journaliste attribué à ton compte' using errcode='42501'; end if;
  new.reporter_name:=j.name;
 else
  if new.status<>'draft' then raise exception 'Choisis un journaliste avant la soumission'; end if;
  new.reporter_name:='';
 end if;
 return new;
end $$;

revoke all on public.bhl_journalists from anon;
