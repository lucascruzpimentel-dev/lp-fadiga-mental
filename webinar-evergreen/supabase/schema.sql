-- Webinars evergreen — rode este arquivo uma vez no Supabase (SQL Editor).
-- O acesso é feito só pelo servidor com a service_role key; RLS ligado e sem
-- policies significa que as chaves públicas (anon) não leem nem escrevem nada.

create table if not exists public.webinars (
  id          text primary key,
  data        jsonb       not null,
  updated_at  timestamptz not null default now()
);

create table if not exists public.leads (
  id          bigint generated always as identity primary key,
  webinar_id  text        not null references public.webinars (id) on delete cascade,
  name        text        not null,
  email       text        not null,
  created_at  timestamptz not null default now()
);

create index if not exists leads_webinar_id_idx on public.leads (webinar_id, created_at desc);

alter table public.webinars enable row level security;
alter table public.leads    enable row level security;
