begin;
create temp table edit_test as select
 (select user_id from public.bhl_profiles where role='dg' order by created_at limit 1) dg,
 (select user_id from public.bhl_profiles where role='dg' order by created_at offset 1 limit 1) other_dg,
 (select user_id from public.bhl_profiles where role='admin' limit 1) admin,
 gen_random_uuid() article, gen_random_uuid() image;
grant select on edit_test to authenticated;
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',dg,'role','authenticated')::text,true) is not null from edit_test;
insert into public.bhl_news(id,author_id,title,summary,body,category,status) select article,dg,'__EDIT_TEST__','Résumé','Version originale','Ligue','pending' from edit_test;
update public.bhl_news set body='Correction DG en attente' where id=(select article from edit_test);
do $$ begin
 if not exists(select 1 from public.bhl_news where id=(select article from edit_test) and status='pending' and body='Correction DG en attente') then raise exception 'Owner pending edit failed'; end if;
 begin
 update public.bhl_news set status='published' where id=(select article from edit_test);
 raise exception 'Owner published';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',other_dg,'role','authenticated')::text,true) is not null from edit_test;
do $$ declare n int; begin
 update public.bhl_news set body='Autre DG' where id=(select article from edit_test);get diagnostics n=row_count;if n<>0 then raise exception 'Another DG edited';end if;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',admin,'role','authenticated')::text,true) is not null from edit_test;
update public.bhl_news set body='Correction administrateur',status='published',cover_path=(select admin::text||'/'||image::text||'.webp' from edit_test) where id=(select article from edit_test);
create temp table approved_snapshot as select author_id,author_name,created_at,published_at,updated_at from public.bhl_news where id=(select article from edit_test);
update public.bhl_news set title='Titre corrigé après publication',body='Correction publiée',cover_caption='Image modifiée par administrateur' where id=(select article from edit_test);
do $$ begin
 if not exists(select 1 from public.bhl_news n,approved_snapshot a where n.id=(select article from edit_test) and n.status='published' and n.author_id=a.author_id and n.author_name=a.author_name and n.created_at=a.created_at and n.published_at=a.published_at and n.updated_at>a.updated_at and n.body='Correction publiée') then raise exception 'Admin edit changed author, dates or publication state';end if;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',dg,'role','authenticated')::text,true) is not null from edit_test;
do $$ declare n int; begin
 update public.bhl_news set body='Correction DG après approbation' where id=(select article from edit_test);get diagnostics n=row_count;if n<>0 then raise exception 'DG edited published article';end if;
 update public.bhl_news set body='Stale pending edit' where id=(select article from edit_test) and status='pending';get diagnostics n=row_count;if n<>0 then raise exception 'Stale edit overwrote approval';end if;
end $$;
reset role;
select 'PASS: owner edits pending, another DG denied, owner publication denied, admin edits published with original authorship/date, published owner edits denied, stale pending updates denied' as result;
rollback;
