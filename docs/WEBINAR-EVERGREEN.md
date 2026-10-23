# Webinar evergreen

Transmissões gravadas que vão ao ar sozinhas, nos dias e horários definidos no painel. O espectador só
tem volume e tela cheia (sem pausar, avançar ou voltar). Chat com comentários programados e oferta
enviada automaticamente em um minuto definido do vídeo.

## URLs

| O quê | URL |
|---|---|
| Painel (senha) | `/painel-webinars` |
| Sala pública de cada webinar | `/w/ID-DO-WEBINAR` (botão "Copiar link" no painel) |
| Prévia (ignora agenda, começa agora) | `/w/ID?preview=1` — só abre se estiver logado no painel |

## Como funciona

- A sessão é **global**: todos veem a mesma transmissão no mesmo ponto. Quem chega com ela em andamento
  entra no meio (se "Permitir entrar com a sessão em andamento" estiver ligado); senão, aguarda a próxima
  com contagem regressiva.
- A posição do vídeo é sempre calculada pelo relógio (`agora - início da sessão`); pausa, seek e velocidade
  são desfeitos na hora.
- Horários são definidos num fuso (padrão Brasília) e cada espectador vê no seu horário local.

## Estrutura

```
webinar-evergreen/
  painel/   index.html + painel.js     painel de gestão (login, dashboard, editor)
  sala/     index.html + sala.js       cadastro + transmissão
  assets/   core.js + webinar.css      agenda/fuso, gerador de chat, cliente da API, estilos
  supabase/schema.sql                  tabelas (rodar uma vez no SQL Editor do Supabase)
api/
  webinar.js                           função serverless (único endpoint: POST /api/webinar)
  _lib/                                banco (Supabase), login (HMAC) e validação
```

## Configuração (uma vez)

1. **Supabase** → SQL Editor → rodar `webinar-evergreen/supabase/schema.sql`.
2. **Vercel** → projeto `lp-fadiga-mental` → Settings → Environment Variables (Production e Preview):
   - `SUPABASE_URL` — `https://SEU-PROJETO.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` — chave `service_role` (só no servidor; **nunca** no código)
   - `ADMIN_PASSWORD` — senha do painel
3. Redeploy (variáveis só valem em novos deploys).

## Segurança

- O banco só é acessado pela função em `/api`, com a service_role; RLS ligado e sem policies, então as
  chaves públicas do Supabase não leem nem escrevem nada.
- Login por senha única, token assinado de 7 dias; limite de tentativas por IP (best-effort).
- Servidor valida tudo (links só `http(s)://`, limites de tamanho); textos são exibidos com `textContent`.
- O arquivo de vídeo continua acessível a quem souber a URL. Para blindar de verdade, use HLS com URL
  assinada (Mux, Bunny Stream, Cloudflare Stream).
