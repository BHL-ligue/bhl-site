alter table public.bhl_news add column body_format text not null default 'plain' check(body_format in ('plain','html'));
