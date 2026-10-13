-- Oportunidades do HighLevel (GHL), sincronizadas pelo n8n. Rode no SQL Editor do Supabase onde ficarão as tabelas do painel (pode ser um projeto seu).
-- Vendas = status 'won'. Em aberto = status 'open'. O responsável (responsavel_id) é o vendedor.
create table if not exists public.ghl_oportunidades (
  id                  text primary key,
  nome                text,
  status              text not null,          -- open | won | lost | abandoned
  valor               numeric not null default 0,
  pipeline_id         text,
  pipeline_nome       text,
  etapa_id            text,
  etapa_nome          text,
  responsavel_id      text,                   -- usuário do HighLevel (mesmo id usado em wa_mensagens.user_id)
  contact_id          text,
  contato_nome        text,
  contato_telefone    text,
  contato_email       text,
  criada_em           timestamptz,
  atualizada_em       timestamptz,
  status_alterado_em  timestamptz,            -- data do ganho quando status = won
  sincronizada_em     timestamptz not null default now()
);
create index if not exists ghl_oport_status_data on public.ghl_oportunidades (status, status_alterado_em);
create index if not exists ghl_oport_resp on public.ghl_oportunidades (responsavel_id);
create index if not exists ghl_oport_contact on public.ghl_oportunidades (contact_id);
-- Sem políticas: só a chave de servidor (service_role) lê e grava. O dashboard usa essa chave no backend.
alter table public.ghl_oportunidades enable row level security;

-- Usuários do HighLevel (vendedores): dão o nome de quem é o responsavel_id.
create table if not exists public.ghl_usuarios (
  id               text primary key,
  nome             text,
  funcao           text,
  sincronizada_em  timestamptz not null default now()
);
alter table public.ghl_usuarios enable row level security;

-- Contatos das conversas (nome e telefone), consultados direto no HighLevel.
create table if not exists public.ghl_contatos (
  id               text primary key,
  nome             text,        -- no Instagram é o @usuário ou o nome de exibição
  telefone         text,
  email            text,
  responsavel_id   text,        -- usuário do HighLevel a quem o contato está atribuído
  tags             jsonb,
  sincronizada_em  timestamptz not null default now()
);
alter table public.ghl_contatos enable row level security;

-- Total de oportunidades abertas no HighLevel, para o dashboard mostrar quanto da carteira está sincronizada.
create table if not exists public.ghl_sync (
  id             text primary key,
  total          integer,
  atualizado_em  timestamptz not null default now()
);
alter table public.ghl_sync enable row level security;

-- Auditoria diária por IA: uma segunda IA confere uma amostra das análises do dia e registra onde discorda.
create table if not exists public.wa_auditorias (
  dia                       date not null,
  conversation_id           text not null,
  contact_id                text,
  nota_ia                   numeric,
  nota_auditor              numeric,
  concorda_nota             boolean,
  resolvido_correto         boolean,
  interesse_compra_correto  boolean,
  risco                     text,
  divergencias              jsonb,
  o_que_faltou              text,
  resposta_sugerida         text,
  resumo_analise            text,
  criada_em                 timestamptz not null default now(),
  primary key (dia, conversation_id)
);
alter table public.wa_auditorias enable row level security;

-- Análise por IA das conversas de Instagram (social selling): avalia a abordagem, a qualificação e o convite para reunião.
create table if not exists public.ig_analises (
  conversation_id    text not null,
  contact_id         text,
  analisada_em       timestamptz not null default now(),
  ultima_msg_em      timestamptz,
  etapa              text,        -- sem_resposta | respondeu | qualificado | convite_feito | agendado | recusou
  qualificado        boolean,     -- falou de produto ou serviço
  interesse_produto  text,        -- produto ou serviço citado
  objecao            text,
  personalizacao     integer,     -- 1 a 10: a abordagem usa algo real do perfil/contexto do lead
  qualificacao       integer,     -- 1 a 10: fez perguntas que descobrem necessidade e momento
  convite            integer,     -- 1 a 10: convidou com clareza para reunião ou próximo passo
  followup           integer,     -- 1 a 10: retomou o lead quando esfriou
  nota               numeric,
  resumo             text,
  proxima_acao       text,
  mensagem_sugerida  text,
  pontos_melhoria    jsonb,
  atendentes         jsonb,
  modelo             text,
  tokens_entrada     integer,
  tokens_saida       integer,
  primary key (conversation_id, ultima_msg_em)
);
create index if not exists ig_analises_data on public.ig_analises (analisada_em);
alter table public.ig_analises enable row level security;
