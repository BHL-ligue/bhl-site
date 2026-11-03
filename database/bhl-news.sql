create table public.bhl_news (
 id uuid primary key default gen_random_uuid(),
 author_id uuid not null references public.bhl_profiles(user_id),
 author_name text not null default '', team_id text references public.bhl_teams(team_id), team_name text not null default '',
 title text not null check(char_length(trim(title)) between 1 and 160),
 summary text not null check(char_length(trim(summary)) between 1 and 350),
 body text not null check(char_length(trim(body)) between 1 and 20000),
 category text not null check(category in ('Ligue','Transactions','Équipes','Analyses')),
 status text not null default 'draft' check(status in ('draft','pending','published','rejected')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 published_at timestamptz,
 constraint news_published_date check((status='published')=(published_at is not null))
);
alter table public.bhl_news enable row level security;
revoke all on public.bhl_news from anon,authenticated;
grant select on public.bhl_news to anon;
grant select,insert,update on public.bhl_news to authenticated;
create index bhl_news_author_idx on public.bhl_news(author_id);
create index bhl_news_team_idx on public.bhl_news(team_id);
create index bhl_news_status_date_idx on public.bhl_news(status,published_at desc);
create policy news_public on public.bhl_news for select to anon,authenticated using(status='published');
create policy news_private_read on public.bhl_news for select to authenticated using(
 author_id=(select auth.uid()) or exists(select 1 from public.bhl_profiles p where p.user_id=(select auth.uid()) and p.role='admin'));
create policy news_create on public.bhl_news for insert to authenticated with check(
 author_id=(select auth.uid()) and status in ('draft','pending') and exists(select 1 from public.bhl_profiles p where p.user_id=(select auth.uid()) and (p.role='admin' or (p.role='dg' and p.team_id is not null))));
create policy news_owner_edit on public.bhl_news for update to authenticated using(
 author_id=(select auth.uid()) and status in ('draft','rejected') and exists(select 1 from public.bhl_profiles p where p.user_id=(select auth.uid()) and (p.role='admin' or (p.role='dg' and p.team_id is not null)))) with check(
 author_id=(select auth.uid()) and status in ('draft','pending') and exists(select 1 from public.bhl_profiles p where p.user_id=(select auth.uid()) and (p.role='admin' or (p.role='dg' and p.team_id is not null))));
create policy news_admin_edit on public.bhl_news for update to authenticated using(
 exists(select 1 from public.bhl_profiles p where p.user_id=(select auth.uid()) and p.role='admin')) with check(
 exists(select 1 from public.bhl_profiles p where p.user_id=(select auth.uid()) and p.role='admin'));
create function public.bhl_news_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare p public.bhl_profiles%rowtype;
begin
 select * into p from public.bhl_profiles where user_id=auth.uid();
 if p.user_id is null or (p.role<>'admin' and (p.role<>'dg' or p.team_id is null)) then raise exception 'Compte DG approuvé requis' using errcode='42501'; end if;
 if TG_OP='INSERT' then
  if new.author_id<>auth.uid() or new.status not in ('draft','pending') then raise exception 'Soumission invalide' using errcode='42501'; end if;
  new.author_name:=coalesce(nullif(trim(p.full_name),''),'Rédaction BHL');
  new.team_id:=p.team_id;
  new.team_name:=coalesce((select team_name from public.bhl_teams where team_id=p.team_id),'BHL');
  new.created_at:=now(); new.published_at:=null;
 else
  if (new.id,new.author_id,new.author_name,new.team_id,new.team_name,new.created_at) is distinct from (old.id,old.author_id,old.author_name,old.team_id,old.team_name,old.created_at) then raise exception 'Identité de l’article non modifiable' using errcode='42501'; end if;
  if p.role<>'admin' and (old.status not in ('draft','rejected') or new.status not in ('draft','pending') or old.author_id<>auth.uid()) then raise exception 'Modification réservée à l’administration' using errcode='42501'; end if;
  if new.status='published' then new.published_at:=coalesce(old.published_at,now()); else new.published_at:=null; end if;
 end if;
 new.updated_at:=now();
 return new;
end $$;
revoke all on function public.bhl_news_guard() from public,anon,authenticated;
create trigger bhl_news_guard before insert or update on public.bhl_news for each row execute function public.bhl_news_guard();
