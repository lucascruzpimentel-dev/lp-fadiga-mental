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

-- Audiência: quanto de cada sessão cada pessoa assistiu (uma linha por webinar + e-mail + sessão).
-- Rode de novo este arquivo se o seu banco já tinha as tabelas acima (é idempotente).
create table if not exists public.watch_sessions (
  webinar_id       text        not null references public.webinars (id) on delete cascade,
  email            text        not null,
  session_start    timestamptz not null,
  name             text        not null default '',
  duration         integer     not null,
  seconds_watched  integer     not null default 0,
  first_offset     integer     not null default 0,
  max_offset       integer     not null default 0,
  intervals        jsonb       not null default '[]'::jsonb,
  first_seen       timestamptz not null default now(),
  last_seen        timestamptz not null default now(),
  primary key (webinar_id, email, session_start)
);

create index if not exists watch_sessions_webinar_idx on public.watch_sessions (webinar_id, last_seen desc);

alter table public.watch_sessions enable row level security;
