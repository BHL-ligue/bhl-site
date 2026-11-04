begin;
set local role anon;
do $$ begin
 if (select jsonb_array_length(sections) from public.bhl_rules where id=1)<>15 then raise exception 'Lecture publique invalide'; end if;
 begin update public.bhl_rules set title='Test interdit' where id=1; raise exception 'Écriture anonyme autorisée'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims',(select json_build_object('sub',user_id,'role','authenticated')::text from public.bhl_profiles where role='dg' limit 1),true);
set local role authenticated;
do $$ declare n int; begin
 update public.bhl_rules set title='Test DG interdit' where id=1;get diagnostics n=row_count;
 if n<>0 then raise exception 'Écriture DG autorisée';end if;
end $$;
reset role;
select set_config('request.jwt.claims',(select json_build_object('sub',user_id,'role','authenticated')::text from public.bhl_profiles where role='admin' limit 1),true);
set local role authenticated;
do $$ declare previous int; n int; begin
 select revision into previous from public.bhl_rules where id=1;
 update public.bhl_rules set introduction=introduction where id=1 and revision=previous;
 get diagnostics n=row_count;if n<>1 then raise exception 'Écriture admin refusée';end if;
 if (select revision from public.bhl_rules where id=1)<>previous+1 then raise exception 'Révision incorrecte';end if;
 update public.bhl_rules set introduction=introduction where id=1 and revision=previous;
 get diagnostics n=row_count;if n<>0 then raise exception 'Conflit non détecté';end if;
 begin update public.bhl_rules set sections='[{"id":"1.1"}]'::jsonb where id=1;raise exception 'Article incomplet autorisé';exception when invalid_parameter_value then null;end;
end $$;
reset role;
rollback;
select 'PASS: public read, anonymous/DG write denied, admin update allowed, revision conflict protected, invalid article denied; all test writes rolled back' as result;
