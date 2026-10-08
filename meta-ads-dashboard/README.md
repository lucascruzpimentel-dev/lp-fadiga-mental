# Dashboard Meta Ads + Leads (HighLevel)

Relatório visual de campanhas do Meta Ads cruzado com os leads do formulário (Supabase).

- `server/` API Express (proxy seguro da Meta Marketing API + leitura de leads no Supabase)
- `web/` Vite + React + Tailwind + Recharts (KPIs, gráfico, tabelas com drill-down campanha → conjunto)
- `supabase/leads.sql` tabela `leads`
- `n8n/` fluxo `Webhook GHL → Code → HTTP Request (Supabase)`

## Rodar localmente
```bash
cp .env.example .env   # preencha META_ACCESS_TOKEN, META_AD_ACCOUNT_ID, META_SUPABASE_URL, META_SUPABASE_SERVICE_ROLE_KEY
npm run install:all
npm run dev:server     # http://localhost:8787
npm run dev:web        # http://localhost:5173
```
Sem credenciais (ou com `MOCK=1`) o dashboard abre com dados de demonstração.

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
