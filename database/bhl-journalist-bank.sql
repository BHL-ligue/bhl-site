
alter table public.bhl_journalists alter column owner_id drop not null;
drop policy journalists_read on public.bhl_journalists;
create policy journalists_read on public.bhl_journalists for select to authenticated using (
 owner_id=(select auth.uid()) or exists(select 1 from public.bhl_profiles where user_id=(select auth.uid()) and (role='admin' or (role='dg' and team_id is not null and bhl_journalists.owner_id is null)))
);
create policy journalists_claim on public.bhl_journalists for update to authenticated
 using(owner_id is null and exists(select 1 from public.bhl_profiles where user_id=(select auth.uid()) and role in ('dg','admin') and team_id is not null))
 with check(owner_id=(select auth.uid()) and team_id=(select p.team_id from public.bhl_profiles p where p.user_id=(select auth.uid())));
create function public.bhl_journalist_claim_guard() returns trigger language plpgsql set search_path='' as $$
declare p public.bhl_profiles%rowtype;
begin
 select * into p from public.bhl_profiles where user_id=auth.uid();
 if p.role='admin' then return new;end if;
 if p.role is distinct from 'dg' or p.team_id is null or old.owner_id is not null or new.owner_id is distinct from auth.uid() or (new.id,new.name,new.media_name,new.created_at) is distinct from (old.id,old.name,old.media_name,old.created_at) then raise exception 'Tu peux seulement choisir un journaliste disponible' using errcode='42501';end if;
 new.team_id:=p.team_id;
 return new;
end $$;
create trigger bhl_journalist_claim_guard before update on public.bhl_journalists for each row execute function public.bhl_journalist_claim_guard();
alter table public.bhl_news drop constraint bhl_news_journalist_id_fkey;
alter table public.bhl_news add constraint bhl_news_journalist_id_fkey foreign key(journalist_id) references public.bhl_journalists(id) on delete set null;
create or replace function public.bhl_news_journalist_guard() returns trigger language plpgsql set search_path='' as $$
declare j public.bhl_journalists%rowtype; admin boolean;
begin
 select role='admin' into admin from public.bhl_profiles where user_id=auth.uid();
 if cardinality(new.team_tags)>16 or exists(select 1 from unnest(new.team_tags) t where t is null or not exists(select 1 from public.bhl_teams where team_id=t)) then raise exception 'Tag équipe invalide'; end if;
 if new.journalist_id is not null then
  select * into j from public.bhl_journalists where id=new.journalist_id;
  if j.id is null or (not coalesce(admin,false) and j.owner_id is distinct from auth.uid()) then raise exception 'Choisis un journaliste attribué à ton compte' using errcode='42501'; end if;
  new.reporter_name:=j.name;
 elsif TG_OP='UPDATE' and coalesce(admin,false) and old.journalist_id is not null and not exists(select 1 from public.bhl_journalists where id=old.journalist_id) then
  new.reporter_name:=old.reporter_name;
 elsif TG_OP='UPDATE' and coalesce(admin,false) and old.journalist_id is null and nullif(old.reporter_name,'') is not null and new.reporter_name=old.reporter_name then
  new.reporter_name:=old.reporter_name;
 else
  if new.status<>'draft' then raise exception 'Choisis un journaliste avant la soumission';end if;
  new.reporter_name:='';
 end if;
 return new;
end $$;
