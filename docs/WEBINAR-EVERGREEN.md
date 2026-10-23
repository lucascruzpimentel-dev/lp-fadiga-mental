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

## Identidade visual

Segue o **Atleta Campeão Design System** (Claude Design, set/2026): marinho `#0A1B33` + dourado `#B08D2A` sobre
branco, Sora (títulos e rótulos em caixa alta) + Source Serif 4 (corpo), tudo chapado (raio 0, sem sombra, sem
degradê, sem blur), filetes de 1px e 3px, ícones monolineares (Lucide, traço 1,5) e marca nominal "ATLETA CAMPEÃO"
com filete dourado (não há logo). Os tokens estão no topo de `webinar-evergreen/assets/webinar.css`.

O design system é de material impresso; para a tela foram adicionados só foco, hover e estado desativado, também
chapados. Regras de contraste: dourado como texto apenas sobre marinho; sobre branco, só filete ou preenchimento;
texto sobre dourado é marinho; borda de campo usa o cinza-legenda. Cores de tipo de conteúdo (conceito, exercício…)
não são usadas aqui. Os comentários simulados do chat mantêm o jeito de gente real (podem ter emoji).

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

## Audiência: quanto cada pessoa assistiu

Cada espectador cadastrado tem o tempo assistido medido sobre a **duração total do vídeo**:

- A sala registra os trechos em que o vídeo está de fato tocando na posição do "ao vivo" (pausado pelo navegador,
  aba sem reprodução ou botão "Entrar na transmissão" pendente não contam) e envia um batimento a cada 15 s e
  ao fechar ou recarregar a página. Recarregar não zera: o estado fica no navegador e o servidor une os trechos.
- Quem entra no meio da sessão não alcança 100%: o percentual é sobre o vídeo inteiro. A coluna "Entrou em" mostra
  em que ponto da transmissão a pessoa chegou.
- Por pessoa vale a **melhor sessão**. "Assistiu" = ao menos 1 minuto.
- No painel: cada webinar mostra um resumo ("2 assistiram · média 70% · 2 com 50% ou mais · 1 com 90% ou mais") e o
  botão **Audiência** abre a tabela por pessoa, com filtros (assistiram, não assistiram, 50%+, 90%+) e **Baixar CSV**
  com `pct_assistido`, `segundos_assistidos`, `entrou_em`, `ultima_atividade` e `sessoes` (o CSV de leads também traz
  essas colunas).
- **Ativação:** rode de novo `webinar-evergreen/supabase/schema.sql` no Supabase (cria `watch_sessions`; é idempotente).
  Sem a tabela o painel continua funcionando e a tela de audiência avisa o que fazer.
- **Segurança:** o cadastro devolve uma assinatura (HMAC) do par webinar + e-mail; sem ela o servidor rejeita
  batimentos. O servidor também recusa mais segundos assistidos do que o tempo decorrido desde o início da sessão.
  A medição é indicativa (quem controla o próprio navegador poderia inflar o próprio número, não o de outras pessoas).
- **Privacidade:** a tela de cadastro avisa que o tempo assistido é registrado e linka a Política de Privacidade.
  Vale revisar o texto da política (LGPD) para citar esse uso. Quem se cadastrou antes desta versão não é rastreado
  até se cadastrar de novo.

## Comentários coerentes com o vídeo (transcrição + IA)

No editor, em **Chat**, importe a transcrição com timestamps e gere os comentários a partir dela:

1. **Transcrição:** cole ou importe um arquivo `.srt`, `.vtt` ou `.txt`. São aceitos SRT, VTT, linhas `mm:ss texto`
   ou `[hh:mm:ss] texto` e o formato "Nome  mm:ss" (Zoom/Otter). No Vimeo: Configurações do vídeo → Legendas →
   baixar o `.vtt`. O painel agrupa em trechos de ~12 s e mostra o resumo (nº de trechos e cobertura).
2. **Gerar comentários com IA:** o servidor divide o vídeo em janelas de ~7 min, chama a Claude API em paralelo
   (uma chamada por janela) e devolve mensagens com horário, nome e texto, cada uma reagindo ao que foi dito
   segundos antes. As primeiras janelas têm cumprimentos de chegada e, depois de cada oferta, mensagens de
   interesse (sem preço ou condição, que não estão na transcrição). Revise o resultado e clique em **Salvar**.
3. **Sem chave de API:** "Copiar prompt" gera um prompt pronto (com a transcrição e as regras) para colar no
   Claude.ai; cole a resposta no campo de comentários. "Modelo genérico (sem IA)" continua disponível.

Detalhes técnicos: `api/_lib/webinar-ai.js` usa o SDK oficial `@anthropic-ai/sdk` (`package.json` na raiz),
modelo `claude-opus-5-5` por padrão (troque com a variável `ANTHROPIC_MODEL`, ex.: `claude-sonnet-5-5` para gastar
cerca da metade), saída estruturada por JSON Schema, `effort` baixo e `fallbacks: "default"` (reexecuta no modelo
recomendado se um classificador de segurança recusar). A ação exige login, tem limite de 12 gerações por hora por IP
(best-effort) e a função roda até 60 s (`vercel.json`). A transcrição fica salva no webinar, **só visível ao admin**:
a API pública não a entrega. Estimativa de custo para ~100 comentários em 1 h de vídeo: da ordem de US$ 0,20 a 0,50
com o modelo padrão (confira o consumo no console da Anthropic).

## Configuração (uma vez)

1. **Supabase** → SQL Editor → rodar `webinar-evergreen/supabase/schema.sql`.
2. **Vercel** → projeto `lp-fadiga-mental` → Settings → Environment Variables (Production e Preview):
   - `SUPABASE_URL` — `https://SEU-PROJETO.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` — chave `service_role` (só no servidor; **nunca** no código)
   - `ADMIN_PASSWORD` — senha do painel
   - `ANTHROPIC_API_KEY` — *opcional*, só para "Gerar comentários com IA" (chave em console.anthropic.com)
   - `ANTHROPIC_MODEL` — *opcional*, padrão `claude-opus-5-5`
3. Redeploy (variáveis só valem em novos deploys).

## Segurança

- O banco só é acessado pela função em `/api`, com a service_role; RLS ligado e sem policies, então as
  chaves públicas do Supabase não leem nem escrevem nada.
- Login por senha única, token assinado de 7 dias; limite de tentativas por IP (best-effort).
- Servidor valida tudo (links só `http(s)://`, limites de tamanho); textos são exibidos com `textContent`.
- Com Vimeo + restrição por domínio, o vídeo só abre dentro da sala. Com arquivo direto, o arquivo continua
  acessível a quem souber a URL (para blindar, use HLS com URL assinada).
