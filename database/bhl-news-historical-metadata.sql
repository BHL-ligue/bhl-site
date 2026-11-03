alter table public.bhl_news
 add column article_date date not null default ((now() at time zone 'America/Toronto')::date),
 add column season text not null default (case when extract(month from now() at time zone 'America/Toronto')>=7 then extract(year from now() at time zone 'America/Toronto')::int else extract(year from now() at time zone 'America/Toronto')::int-1 end)::text || '-' || lpad(((case when extract(month from now() at time zone 'America/Toronto')>=7 then extract(year from now() at time zone 'America/Toronto')::int+1 else extract(year from now() at time zone 'America/Toronto')::int end)%100)::text,2,'0'),
 add column reporter_name text not null default '' check(char_length(reporter_name)<=120),
 add column media_name text not null default '' check(char_length(media_name)<=160);
-- Backfill legacy dates without changing publication timestamps or existing authorship.
-- The normal editor guard only applies to authenticated API writes.
alter table public.bhl_news disable trigger bhl_news_guard;
update public.bhl_news set article_date=(coalesce(published_at,created_at) at time zone 'America/Toronto')::date;
update public.bhl_news set season=(extract(year from article_date)::int-case when extract(month from article_date)<7 then 1 else 0 end)::text || '-' || lpad(((extract(year from article_date)::int+case when extract(month from article_date)>=7 then 1 else 0 end)%100)::text,2,'0');
alter table public.bhl_news enable trigger bhl_news_guard;
alter table public.bhl_news add constraint bhl_news_article_date_range check(article_date between date '1900-01-01' and date '2100-12-31');
alter table public.bhl_news add constraint bhl_news_season_format check(case when season ~ '^[0-9]{4}-[0-9]{2}$' then right(season,2)::int=(left(season,4)::int+1)%100 else false end);
create index bhl_news_season_date_idx on public.bhl_news(status,season,article_date desc);
create view public.bhl_news_seasons with(security_invoker=true) as select distinct season from public.bhl_news where status='published';
revoke all on public.bhl_news_seasons from anon,authenticated;
grant select on public.bhl_news_seasons to anon,authenticated;
