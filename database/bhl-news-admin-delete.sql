grant delete on public.bhl_news to authenticated;
create policy news_admin_delete on public.bhl_news for delete to authenticated using(exists(select 1 from public.bhl_profiles p where p.user_id=(select auth.uid()) and p.role='admin'));
