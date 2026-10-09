-- Custos e templates do WhatsApp vindos da API da Meta.
-- Rode no SQL Editor do projeto Supabase de WHATSAPP (WA_*). Quem grava é o fluxo do n8n (service_role);
-- o dashboard só lê. RLS ligado e sem policies: anon/authenticated não acessam nada.

-- Volume de mensagens por dia, categoria de cobrança e tipo de preço (pricing_analytics da Meta).
create table if not exists public.wa_custos_meta (
  dia date not null,
  categoria text not null,   -- UTILITY | MARKETING | AUTHENTICATION | SERVICE ...
  tipo text not null,        -- REGULAR (cobrada) | FREE_CUSTOMER_SERVICE | FREE_ENTRY_POINT | ...
  volume integer not null default 0,
  atualizado_em timestamptz not null default now(),
  primary key (dia, categoria, tipo)
);

-- Templates da conta (message_templates da Meta).
create table if not exists public.wa_templates (
  id text primary key,       -- id do template na Meta
  nome text not null,
  idioma text,
  categoria text,            -- UTILITY | MARKETING | AUTHENTICATION
  status text,               -- APPROVED | REJECTED | PAUSED ...
  corpo text,                -- texto do corpo, com {{1}}, {{2}}...
  qualidade text,
  atualizado_em timestamptz not null default now()
);
create index if not exists wa_templates_status_idx on public.wa_templates (status, categoria);

alter table public.wa_custos_meta enable row level security;
alter table public.wa_templates enable row level security;
revoke all on public.wa_custos_meta, public.wa_templates from anon, authenticated;
