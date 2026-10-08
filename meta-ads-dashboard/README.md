# Dashboard Meta Ads + Leads (HighLevel)

Relatório visual de campanhas do Meta Ads cruzado com os leads do formulário (Supabase).

- `server/` API Express que lê só o Supabase (não chama a API do Meta)
- `web/` Vite + React + Tailwind + Recharts (KPIs, gráfico, tabelas com drill-down campanha → conjunto)
- `supabase/leads.sql` tabela `leads`
- `n8n/` fluxo `Webhook GHL → Code → HTTP Request (Supabase)`

## Rodar localmente
```bash
cp .env.example .env   # preencha META_SUPABASE_URL / META_SUPABASE_SERVICE_ROLE_KEY (anúncios) e WA_SUPABASE_* (WhatsApp)
npm run install:all
npm run dev:server     # http://localhost:8787
npm run dev:web        # http://localhost:5173
```
Sem credenciais (ou com `MOCK=1`) o dashboard abre com dados de demonstração.

## De onde vêm os dados
O dashboard só lê do Supabase. Os dados de anúncios vêm de `meta_adset_daily` (+ nomes em `meta_campaigns` e `meta_adsets`), preenchidas por um processo de sincronização com o Meta que fica fora deste projeto. Se esse processo falhar, o dashboard avisa quais dias estão sem dados e mostra "Dados até DD/MM" no topo.
Observação: as "conversões" de `meta_adset_daily` e `meta_campaign_daily` não somam igual (gasto, cliques e receita somam). O dashboard usa só a de conjunto, para os números fecharem entre si.

## Match de leads
`utm_campaign` = ID da campanha · `utm_term` = ID do conjunto · `utm_content` = ID do anúncio.
São dois projetos Supabase: `META_SUPABASE_*` (anúncios/leads, usado pelo dashboard) e `WA_SUPABASE_*` (WhatsApp, reservado).
Se `utm_campaign` vier como nome, o match cai para comparação por nome.

## n8n
Importe `n8n/workflow.json`, troque `SEU-PROJETO` pela URL do Supabase e defina `SUPABASE_SERVICE_ROLE_KEY` como variável de ambiente do n8n. Duplicados são ignorados via `contact_id` único.

## Segurança
Chaves só no backend / variáveis de ambiente. `.env` está no `.gitignore`.

## Aba WhatsApp
Lê só o projeto `WA_SUPABASE_*` (`wa_custos_diarios`, `wa_precos`, `wa_painel_atendimento`, `wa_analises`) via `GET /api/whatsapp`.
- **Custo de templates:** usa a tabela de preços da Meta para o Brasil (BRL, vigente desde 01/10/2026: marketing 0,3217 · utility 0,0350 · authentication 0,0350). Para sobrescrever, preencha `preco` e `moeda` em `wa_precos` ou use `WA_PRICE_MARKETING` / `WA_PRICE_UTILITY`. A categoria do template não é registrada nas mensagens, então o custo aparece como faixa (mín = tudo utility, máx = tudo marketing). Atualize os preços quando a Meta publicar nova tabela.
- **Vendedores:** o banco guarda só o ID do usuário no HighLevel. Para exibir nomes: `WA_ATENDENTES='{"idDoUsuario":"Nome"}'`.
- **Sugestões:** regras sobre as notas, resolução, tempo de resposta e os "pontos de melhoria" já gerados em `wa_analises`. Nenhuma conversa é enviada a serviços externos.

## Login (senha única, validada no Supabase)
1. No SQL Editor do Supabase de **anúncios** (`META_*`), rode `supabase/dashboard_auth.sql`.
2. Defina a senha (use uma frase longa): `select public.set_dashboard_password('SUA-SENHA-LONGA');`
3. Defina `DASHBOARD_SESSION_SECRET` no servidor (`openssl rand -hex 32`).

Como funciona: o navegador envia a senha digitada ao servidor, que a confere chamando `verify_dashboard_password` no Supabase (hash bcrypt; a função só aceita a chave de servidor). Em caso de acerto, o servidor devolve um cookie de sessão assinado, `HttpOnly` e `SameSite=Strict`, válido por 12 h. Todas as rotas de dados (`/api/report`, `/api/whatsapp`) exigem esse cookie. 5 erros do mesmo IP bloqueiam por 15 minutos. Hash, chave do Supabase e segredo de sessão nunca vão para o navegador.
Para trocar a senha, rode `set_dashboard_password` de novo; para encerrar todas as sessões, troque `DASHBOARD_SESSION_SECRET`.
Para rodar localmente sem login, use `AUTH_DISABLED=1`.
