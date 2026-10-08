# Dashboard Meta Ads + Leads (HighLevel)

Relatório visual de campanhas do Meta Ads cruzado com os leads do formulário (Supabase).

- `server/` API Express (proxy seguro da Meta Marketing API + leitura de leads no Supabase)
- `web/` Vite + React + Tailwind + Recharts (KPIs, gráfico, tabelas com drill-down campanha → conjunto)
- `supabase/leads.sql` tabela `leads`
- `n8n/` fluxo `Webhook GHL → Code → HTTP Request (Supabase)`

## Rodar localmente
```bash
cp .env.example .env   # preencha META_ACCESS_TOKEN, META_AD_ACCOUNT_ID, WA_SUPABASE_URL, WA_SUPABASE_SERVICE_ROLE_KEY
npm run install:all
npm run dev:server     # http://localhost:8787
npm run dev:web        # http://localhost:5173
```
Sem credenciais (ou com `MOCK=1`) o dashboard abre com dados de demonstração.

## Match de leads
`utm_campaign` = ID da campanha · `utm_term` = ID do conjunto · `utm_content` = ID do anúncio.
Se `utm_campaign` vier como nome, o match cai para comparação por nome.

## n8n
Importe `n8n/workflow.json`, troque `SEU-PROJETO` pela URL do Supabase e defina `SUPABASE_SERVICE_ROLE_KEY` como variável de ambiente do n8n. Duplicados são ignorados via `contact_id` único.

## Segurança
Chaves só no backend / variáveis de ambiente. `.env` está no `.gitignore`.
