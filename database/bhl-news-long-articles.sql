-- Long articles with several editable grids. Keep draft and publication rules.
alter table public.bhl_news drop constraint bhl_news_body_check;
alter table public.bhl_news add constraint bhl_news_body_check
 check (char_length(trim(body)) <= 200000 and (status = 'draft' or char_length(trim(body)) >= 1));
