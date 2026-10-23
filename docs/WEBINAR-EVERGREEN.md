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
  assets/   core.js + player-engines.js + webinar.css   agenda/fuso, chat, API, players (arquivo e Vimeo), estilos
  supabase/schema.sql                  tabelas (rodar uma vez no SQL Editor do Supabase)
api/
  webinar.js                           função serverless (único endpoint: POST /api/webinar)
  _lib/                                banco (Supabase), login (HMAC) e validação
```

## Vídeo

O campo de vídeo do painel aceita:

- **Vimeo (recomendado):** link `https://vimeo.com/ID`, link de vídeo não listado `https://vimeo.com/ID/HASH`,
  `https://player.vimeo.com/video/ID?h=HASH` ou o código `<iframe>` de incorporação (o painel extrai o link).
  O Vimeo converte o arquivo (3–4 GB sem problema) e entrega em qualidade adaptativa por CDN.
- **Arquivo direto** `.mp4`/`.webm` com `faststart`, hospedado em CDN (ex.: Cloudflare R2, Bunny Storage).

Como o Vimeo funciona aqui: a sala carrega o player do Vimeo atrás de uma camada que bloqueia cliques e teclado
e usa a API oficial (`player.js`) para manter o vídeo no ponto do "ao vivo" (desfaz pausa, avanço e velocidade).
Só volume e tela cheia ficam disponíveis ao espectador.

### Ajustes no Vimeo (por vídeo: Configurações → Privacidade / Incorporar)

1. **Quem pode assistir:** *Ocultar do Vimeo* (link não listado) — use o link com `/HASH` no painel.
2. **Onde pode ser incorporado:** *Domínios específicos* → `atletacampeaotreinamentos.com`. Isso impede que o vídeo
   seja aberto fora da sala. Depende do plano.
3. **Player (opções de incorporação):** esconder título, autor e logo e desativar controles (`controls=0`
   já é enviado pela sala, mas só é respeitado em planos pagos).
4. Se o vídeo não carregar dentro de ~25 s (privado, domínio não permitido, vídeo removido), a sala mostra
   "Não foi possível carregar o vídeo". Em "Detectar do vídeo", o painel avisa se não conseguir ler.

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
- Com Vimeo + restrição por domínio, o vídeo só abre dentro da sala. Com arquivo direto, o arquivo continua
  acessível a quem souber a URL (para blindar, use HLS com URL assinada).
