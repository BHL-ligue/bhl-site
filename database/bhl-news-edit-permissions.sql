alter policy news_owner_edit on public.bhl_news using(
 author_id=(select auth.uid()) and status in ('draft','pending','rejected') and exists(select 1 from public.bhl_profiles p where p.user_id=(select auth.uid()) and (p.role='admin' or (p.role='dg' and p.team_id is not null)))) with check(
 author_id=(select auth.uid()) and status in ('draft','pending') and exists(select 1 from public.bhl_profiles p where p.user_id=(select auth.uid()) and (p.role='admin' or (p.role='dg' and p.team_id is not null))));
alter table public.bhl_news drop constraint bhl_news_cover_owner;
alter table public.bhl_news add constraint bhl_news_cover_path_format check(cover_path is null or cover_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$');
create or replace function public.bhl_news_guard() returns trigger language plpgsql security invoker set search_path='' as $$
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
  if p.role<>'admin' and (old.status not in ('draft','pending','rejected') or new.status not in ('draft','pending') or old.author_id<>auth.uid()) then raise exception 'Modification réservée à l’administration' using errcode='42501'; end if;
  if new.status='published' then new.published_at:=coalesce(old.published_at,now()); else new.published_at:=null; end if;
 end if;
 if new.cover_path is not null and (TG_OP='INSERT' or new.cover_path is distinct from old.cover_path) and split_part(new.cover_path,'/',1)<>auth.uid()::text then raise exception 'Utilise une image importée dans ton compte' using errcode='42501'; end if;
 new.updated_at:=clock_timestamp();
 return new;
end $$;
