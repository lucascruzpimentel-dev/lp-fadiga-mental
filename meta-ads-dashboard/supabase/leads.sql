create table if not exists public.leads (
  id bigint generated always as identity primary key,
  contact_id text not null unique,
  full_name text, email text, phone_number text,
  utm_source text, utm_medium text,
  utm_campaign text,  -- ID da campanha Meta
  utm_content text,   -- ID do anúncio
  utm_term text,      -- ID do conjunto de anúncios
  origem_midia text,
  created_time timestamptz default now(),
  created_at timestamptz default now()
);
create index if not exists leads_created_idx on public.leads (created_time);
create index if not exists leads_campaign_idx on public.leads (utm_campaign);
alter table public.leads enable row level security; -- acesso só via service_role no backend
