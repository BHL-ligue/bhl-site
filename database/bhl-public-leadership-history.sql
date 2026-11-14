-- Sanitized public history: never publish account IDs or email addresses.
create table public.bhl_public_leadership_history(
 history_id bigint primary key,team_id text not null,changed_at timestamptz not null,changes jsonb not null
);
alter table public.bhl_public_leadership_history enable row level security;
revoke all on public.bhl_public_leadership_history from public,anon,authenticated;
grant select on public.bhl_public_leadership_history to anon,authenticated;
create policy public_leadership_history_read on public.bhl_public_leadership_history for select to anon,authenticated using(true);
create function bhl_private.leadership_changes(r jsonb) returns jsonb
language sql immutable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('role',role,'before',r->>('old_'||role),'after',r->>('new_'||role)) order by n),'[]'::jsonb)
 from unnest(array['captain','assistant_1','assistant_2','assistant_3']) with ordinality s(role,n)
 where coalesce(r->>('old_'||role),'')<>coalesce(r->>('new_'||role),'');
$$;
create function bhl_private.publish_leadership_history() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' then delete from public.bhl_public_leadership_history where history_id=old.history_id;return old;end if;
 insert into public.bhl_public_leadership_history values(new.history_id,new.team_id,new.changed_at,bhl_private.leadership_changes(to_jsonb(new)))
 on conflict(history_id) do update set team_id=excluded.team_id,changed_at=excluded.changed_at,changes=excluded.changes;
 return new;
end $$;
revoke all on function bhl_private.leadership_changes(jsonb) from public,anon,authenticated;
revoke all on function bhl_private.publish_leadership_history() from public,anon,authenticated;
create trigger publish_leadership_history after insert or update or delete on public.bhl_leadership_history
 for each row execute function bhl_private.publish_leadership_history();
insert into public.bhl_public_leadership_history
select history_id,team_id,changed_at,bhl_private.leadership_changes(to_jsonb(h)) from public.bhl_leadership_history h;
