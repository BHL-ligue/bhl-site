alter table public.bhl_draft_boards add column settings jsonb not null default '{"needsWeight":0.15,"candidateWindow":5}'::jsonb;
create or replace function public.bhl_draft_board_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare p jsonb; ranks integer[]:='{}'; names text[]:='{}'; r integer; n text; strength numeric; weight numeric; candidate integer;
begin
 if jsonb_typeof(new.settings)<>'object' then raise exception 'Réglages invalides';end if;
 weight:=(new.settings->>'needsWeight')::numeric;candidate:=(new.settings->>'candidateWindow')::integer;
 if weight is null or weight<0 or weight>1 or candidate is null or candidate<1 or candidate>50 then raise exception 'Poids des besoins entre 0 et 100 pour cent, fenêtre entre 1 et 50';end if;
 for p in select value from jsonb_array_elements(new.prospects) loop
  r:=(p->>'rank')::integer;n:=trim(p->>'name');
  if r is null or r<1 or r>500 or r=any(ranks) or n is null or char_length(n) not between 1 and 120 or lower(n)=any(names) or coalesce(p->>'position','') !~ '^(C|LW|RW|D|G|F)(/(C|LW|RW|D|G|F))*$' then raise exception 'Espoir invalide ou doublon';end if;
  if p ? 'strength' and p->>'strength' is not null then strength:=(p->>'strength')::numeric;if strength<0 or strength>100 then raise exception 'Force de l’espoir entre 0 et 100';end if;end if;
  ranks:=array_append(ranks,r);names:=array_append(names,lower(n));
 end loop;
 if TG_OP='UPDATE' then new.revision:=old.revision+1;end if;new.updated_at:=clock_timestamp();return new;
end $$;
