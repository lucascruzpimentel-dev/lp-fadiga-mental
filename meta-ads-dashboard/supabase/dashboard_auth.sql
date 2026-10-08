-- Login do dashboard (senha única). Rode no SQL Editor do projeto Supabase de ANÚNCIOS (META_*).
-- A senha fica só como hash bcrypt. Quem valida é a função verify_dashboard_password,
-- chamada apenas pelo servidor do dashboard (service_role). Nenhum visitante consegue executá-la.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.dashboard_auth (
  id int primary key default 1 check (id = 1),  -- uma única senha
  password_hash text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.dashboard_login_attempts (
  id bigint generated always as identity primary key,
  ip text,
  ok boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists dashboard_login_attempts_idx on public.dashboard_login_attempts (ip, created_at);

-- RLS ligado e sem policies: anon/authenticated não leem nem escrevem nada.
alter table public.dashboard_auth enable row level security;
alter table public.dashboard_login_attempts enable row level security;
revoke all on public.dashboard_auth, public.dashboard_login_attempts from anon, authenticated;

create or replace function public.set_dashboard_password(p_password text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if length(p_password) < 10 then raise exception 'use pelo menos 10 caracteres'; end if;
  insert into public.dashboard_auth (id, password_hash) values (1, crypt(p_password, gen_salt('bf', 12)))
  on conflict (id) do update set password_hash = excluded.password_hash, updated_at = now();
end $$;

create or replace function public.verify_dashboard_password(p_password text)
returns boolean language sql security definer stable set search_path = public, extensions as $$
  select coalesce((select password_hash = crypt(p_password, password_hash) from public.dashboard_auth where id = 1), false)
$$;

-- Só o servidor (service_role) pode executar. Sem isso, qualquer pessoa chamaria /rpc com a chave pública.
revoke execute on function public.set_dashboard_password(text) from public, anon, authenticated;
revoke execute on function public.verify_dashboard_password(text) from public, anon, authenticated;
grant execute on function public.set_dashboard_password(text) to service_role;
grant execute on function public.verify_dashboard_password(text) to service_role;

-- Definir/trocar a senha (rode você mesmo; use uma senha longa):
--   select public.set_dashboard_password('SUA-SENHA-LONGA-AQUI');
