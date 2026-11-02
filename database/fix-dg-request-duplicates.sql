-- Applied to BHL-PORTAIL-DG on 2026-11-02.
-- Preserve approved requests and retain the technical duplicate as rejected history.
begin;
lock table public.bhl_account_requests in share row exclusive mode;
update public.bhl_account_requests r
set status='rejected', reviewed_at=now(),
admin_note=concat_ws(E'\n',nullif(r.admin_note,''),'Doublon technique clôturé : une demande approuvée existe déjà pour ce compte.')
where r.status='pending' and exists (
 select 1 from public.bhl_account_requests a where a.user_id=r.user_id and a.status='approved'
);
create unique index if not exists bhl_account_requests_unique_active_user
on public.bhl_account_requests(user_id) where status in ('pending','approved');
commit;