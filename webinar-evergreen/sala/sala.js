// Sala do webinar evergreen: cadastro + transmissão simulada ao vivo.
import {
  api, brandMark, fakeViewerCount, formatClock, h, lsGet, lsSet, newId, normalize, TOKEN_KEY, upcomingSessions,
} from '/webinar-evergreen/assets/core.js';
import { createEngine, parseVideoSource, probeDuration } from '/webinar-evergreen/assets/player-engines.js';
import { createTracker } from '/webinar-evergreen/assets/watch-tracker.js';

const app = document.getElementById('app');
const id = location.pathname.split('/').filter(Boolean).pop() || '';
const preview = new URLSearchParams(location.search).get('preview') === '1';
const viewerKey = 'evergreen:viewer:' + id;

const track = (event, extra) => {
  (window.dataLayer = window.dataLayer || []).push(Object.assign({ event, webinar_id: id }, extra));
};
const fmtSession = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' });

const ICON = {
  volume: '<svg viewBox="0 0 24 24"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg>',
  low: '<svg viewBox="0 0 24 24"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/></svg>',
  mute: '<svg viewBox="0 0 24 24"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6"/><path d="m16 9 6 6"/></svg>',
  enter: '<svg viewBox="0 0 24 24"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>',
  exit: '<svg viewBox="0 0 24 24"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>',
  send: '<svg viewBox="0 0 24 24"><path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/></svg>',
};
const icon = (svg) => { const s = h('span'); s.innerHTML = svg; return s.firstChild; }; // SVG estático, sem dados

function show(...nodes) { app.replaceChildren(...nodes); }
function message(title, text) {
  show(h('div', { class: 'center', style: 'padding:24px' }, h('h1', { style: 'font-size:22px' }, title), text && h('p', { class: 'muted' }, text)));
}

// ---------- boot ----------
async function boot() {
  show(h('p', { class: 'center muted' }, 'Carregando…'));
  let webinar;
  try {
    ({ webinar } = await api('get', { id, token: preview ? lsGet(TOKEN_KEY) || undefined : undefined }));
  } catch (e) {
    return message('Não foi possível carregar', 'Tente novamente em instantes.');
  }
  if (!webinar) return message('Webinar indisponível', 'Este webinar não está no ar no momento.');
  webinar = normalize(webinar);
  document.title = webinar.title + ' | Atleta Campeão';

  let viewer = null;
  if (preview) viewer = { name: 'Você (prévia)', email: '' };
  else { try { viewer = JSON.parse(lsGet(viewerKey) || 'null'); } catch (e) { /* ignora */ } }

  viewer ? room(webinar, viewer) : register(webinar);
}

// ---------- cadastro ----------
function register(webinar) {
  const next = upcomingSessions(webinar, webinar.duration || 3600, Date.now(), 1)[0];
  const name = h('input', { class: 'input', required: true, placeholder: 'Seu nome', autocomplete: 'name', maxlength: '100' });
  const email = h('input', { class: 'input', required: true, type: 'email', placeholder: 'Seu melhor e-mail', autocomplete: 'email', maxlength: '254' });
  const err = h('p', { class: 'error center', hidden: true });
  const btn = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, next && next.inProgress ? 'Entrar na transmissão' : 'Garantir minha vaga');

  const form = h('form', { class: 'reg stack' },
    h('div', null,
      brandMark(true),
      h('p', { class: 'eyebrow center', style: 'margin-top:28px' }, 'Webinar gratuito'),
      h('h1', null, webinar.title),
      webinar.host && h('p', { class: 'sub' }, 'com ' + webinar.host)),
    next && h('div', { class: 'next' },
      next.inProgress
        ? h('span', { class: 'live' }, 'Ao vivo agora')
        : [h('span', { class: 'muted' }, 'Próxima transmissão'), h('br'), h('span', { class: 'cap' }, fmtSession.format(next.startAt))]),
    name, email, err, btn,
    h('p', { class: 'note' }, 'Ao se cadastrar, você concorda com a ', h('a', { href: '/politica-de-privacidade/', target: '_blank', rel: 'noopener' }, 'Política de Privacidade'),
      '. Registramos sua presença e o tempo assistido.'));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    btn.disabled = true;
    err.hidden = true;
    const viewer = { name: name.value.trim(), email: email.value.trim() };
    try {
      const r = await api('lead', { id: webinar.id, name: viewer.name, email: viewer.email });
      viewer.sig = r.sig; // permite gravar a audiência deste espectador
      lsSet(viewerKey, JSON.stringify(viewer));
      track('webinar_lead');
      room(webinar, viewer);
    } catch (ex) {
      err.textContent = ex.status === 429 ? ex.message : 'Não foi possível concluir o cadastro. Confira o e-mail e tente de novo.';
      err.hidden = false;
      btn.disabled = false;
    }
  });
  show(h('div', { style: 'display:flex;flex:1' }, form));
}

// ---------- sala ----------
function room(webinar, viewer) {
  if (!webinar.videoUrl) return message('Nenhuma sessão agendada no momento.');
  const source = parseVideoSource(webinar.videoUrl);
  if (webinar.duration) return start(webinar, viewer, webinar.duration, source);
  show(h('p', { class: 'center muted' }, 'Carregando…'));
  probeDuration(source)
    .then((d) => start(webinar, viewer, d, source))
    .catch(() => message('Não foi possível carregar o vídeo.'));
}

function start(webinar, viewer, duration, source) {
  let startAt;
  if (preview) startAt = Date.now();
  else {
    const first = upcomingSessions(webinar, duration, Date.now(), 1)[0];
    if (!first) return message('Nenhuma sessão agendada no momento.');
    startAt = first.startAt;
  }

  const tracker = createTracker({ webinarId: webinar.id, viewer, duration, enabled: !preview && Boolean(viewer.sig) });
  let needsTap = false;
  let lastOfferId = null;
  let joined = false;
  let tickTimer;
  let refreshTimer;
  let chatStart = false; // false = ainda não montou o histórico desta sessão
  const rendered = new Set();
  const sortedOffers = () => webinar.offers.slice().sort((a, b) => a.at - b.at);

  // --- vídeo (arquivo ou Vimeo), sem controles nativos ---
  const hooks = {};
  const engine = createEngine(source, hooks);
  const vstate = { volume: 1, muted: false };
  let lastSeek = 0;
  let lastPlay = 0;

  // --- controles: só volume e tela cheia ---
  const volBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Silenciar' });
  const vol = h('input', { class: 'vol', type: 'range', min: '0', max: '1', step: '0.05', value: '1', 'aria-label': 'Volume' });
  const fsBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Tela cheia' });
  const viewersEl = h('span', { class: 'viewers' });
  const bar = h('div', { class: 'bar' },
    h('div', { class: 'row', style: 'gap:0' }, h('span', { class: 'live-tag' }, h('i', { class: 'dot' }), 'Ao vivo'), viewersEl),
    h('div', { class: 'ctrl' }, volBtn, vol, fsBtn));

  const cover = h('div', { class: 'cover', hidden: true });
  const tap = h('button', { class: 'tap', type: 'button', hidden: true }, h('span', null, h('i', { class: 'dot' }), 'Entrar na transmissão ao vivo'));
  const fsOffer = h('div', { class: 'fs-offer' });
  const stage = h('div', { class: 'stage' }, engine.el, h('div', { class: 'shield' }), fsOffer, cover, tap);
  const player = h('div', { class: 'player' }, stage, bar);
  player.addEventListener('contextmenu', (e) => e.preventDefault());

  const syncVolIcon = () => { volBtn.replaceChildren(icon(vstate.muted || vstate.volume === 0 ? ICON.mute : vstate.volume < 0.5 ? ICON.low : ICON.volume)); };
  volBtn.addEventListener('click', () => {
    vstate.muted = !vstate.muted;
    engine.setMuted(vstate.muted);
    vol.value = vstate.muted ? '0' : String(vstate.volume || 1);
    syncVolIcon();
  });
  vol.addEventListener('input', () => {
    const v = Number(vol.value);
    vstate.volume = v; vstate.muted = v === 0;
    engine.setVolume(v); engine.setMuted(vstate.muted);
    syncVolIcon();
  });
  syncVolIcon();
  const syncFs = () => { fsBtn.replaceChildren(icon(document.fullscreenElement ? ICON.exit : ICON.enter)); fsBtn.setAttribute('aria-label', document.fullscreenElement ? 'Sair da tela cheia' : 'Tela cheia'); };
  fsBtn.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (player.requestFullscreen) player.requestFullscreen();
    else engine.requestFullscreen(); // iPhone
  });
  document.addEventListener('fullscreenchange', syncFs);
  syncFs();

  // --- chat ---
  const chatList = h('div', { class: 'chat-list' });
  const chatInput = h('input', { class: 'input', placeholder: 'Escreva uma mensagem…', maxlength: '280' });
  const chatForm = h('form', { class: 'chat-form' }, chatInput, h('button', { class: 'btn', type: 'submit', 'aria-label': 'Enviar' }, icon(ICON.send)));
  chatForm.hidden = !webinar.allowViewerChat;
  const chat = h('aside', { class: 'chat' }, h('div', { class: 'chat-head' }, 'Chat ao vivo'), chatList, chatForm);

  let stick = true;
  chatList.addEventListener('scroll', () => { stick = chatList.scrollHeight - chatList.scrollTop - chatList.clientHeight < 40; });
  function addLine(l, mine) {
    if (rendered.has(l.id)) return;
    rendered.add(l.id);
    chatList.append(h('p', { class: 'msg' + (mine ? ' me' : '') }, h('b', null, l.author), h('span', null, l.text)));
    while (chatList.children.length > 120) chatList.firstChild.remove();
    if (stick) chatList.scrollTop = chatList.scrollHeight;
  }
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text || chatInput.disabled) return;
    addLine({ id: 'me-' + newId(), author: viewer.name, text: text.slice(0, 280) }, true);
    chatInput.value = '';
    stick = true;
    chatList.scrollTop = chatList.scrollHeight;
  });

  // --- oferta ---
  const offerSlot = h('div', { class: 'offer-slot' });
  function offerCard(o, compact) {
    const a = h('a', { class: 'btn btn-primary', target: '_blank', rel: 'noopener noreferrer' }, o.cta || 'Quero aproveitar');
    if (/^https?:\/\//i.test(o.url)) a.href = o.url;
    a.addEventListener('click', () => track('webinar_offer_click', { offer_id: o.id }));
    return h('div', { class: 'offer' + (compact ? ' compact' : '') },
      h('p', { class: 'eyebrow' }, 'Oferta especial'),
      h('div', { class: 'offer-body' },
        h('div', null, h('h3', null, o.title), !compact && o.description && h('p', null, o.description), o.price && h('p', { class: 'price' }, o.price)),
        a));
  }
  function setOffer(o) {
    lastOfferId = o ? o.id : null;
    offerSlot.replaceChildren(...(o ? [offerCard(o, false)] : []));
    fsOffer.replaceChildren(...(o ? [offerCard(o, true)] : []));
    if (o) track('webinar_offer_shown', { offer_id: o.id });
  }

  // --- cabeçalho/layout ---
  const head = h('header', { class: 'topbar room-head' },
    brandMark(),
    h('div', { class: 'meta' }, h('h1', null, webinar.title), webinar.host && h('p', null, webinar.host)),
    preview && h('a', { class: 'btn btn-sm', href: '/painel-webinars' }, 'Voltar ao painel'));
  show(head, h('main', { class: 'room' }, h('div', { class: 'room-main' }, player, offerSlot), chat));

  // --- cover (espera / fim / erro) ---
  function setCover(node) {
    if (!node) { cover.hidden = true; return; }
    cover.hidden = false;
    cover.replaceChildren(...[].concat(node));
  }
  const countdownEl = h('div', { class: 'countdown' });
  const waitingNode = [h('p', { class: 'eyebrow' }, 'A transmissão começa em'), countdownEl];
  let coverMode = null;

  function endedNode() {
    const last = sortedOffers().pop();
    const next = preview ? null : upcomingSessions(Object.assign({}, webinar, { allowLateJoin: false }), duration, Date.now(), 1)[0];
    const nodes = [h('h2', { style: 'font-size:24px' }, 'Transmissão encerrada'), h('p', { class: 'muted', style: 'margin-top:6px' }, 'Obrigado por participar.')];
    if (last) nodes.push(h('div', { style: 'margin-top:12px;max-width:440px;width:100%' }, offerCard(last, false)));
    if (next) {
      nodes.push(h('button', { class: 'btn btn-ghost btn-sm', type: 'button', style: 'margin-top:12px', onclick: () => {
        startAt = next.startAt; chatStart = false; rendered.clear(); chatList.replaceChildren(); setOffer(null); coverMode = null; tick();
      } }, 'Aguardar a próxima transmissão · ', h('span', { class: 'cap' }, fmtSession.format(next.startAt))));
    }
    return nodes;
  }

  // --- sincronização com o "ao vivo" ---
  function enforce() {
    const offset = (Date.now() - startAt) / 1000;
    if (offset < 0 || offset >= duration) { if (!engine.paused) engine.pause(); return; }
    if (engine.rate !== 1) engine.setRate(1);
    const now = Date.now();
    if (Math.abs(engine.time - offset) > 1.5 && now - lastSeek > 800) { lastSeek = now; engine.seek(offset); }
    if (engine.paused && !needsTap && now - lastPlay > 800) {
      lastPlay = now;
      engine.play().catch((e) => { if (e && e.name === 'NotAllowedError') { needsTap = true; tap.hidden = false; } });
    }
  }
  hooks.enforce = enforce;
  hooks.onError = () => { coverMode = 'error'; setCover(h('p', { class: 'muted' }, 'Não foi possível carregar o vídeo.')); };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') enforce(); else tracker.flush(true); });
  window.addEventListener('pagehide', () => tracker.flush(true));
  tap.addEventListener('click', () => {
    needsTap = false; tap.hidden = true;
    const offset = (Date.now() - startAt) / 1000;
    if (offset >= 0 && offset < duration) { lastSeek = Date.now(); engine.seek(offset); }
    lastPlay = Date.now();
    engine.play().catch(() => { needsTap = true; tap.hidden = false; });
  });

  function tick() {
    const now = Date.now();
    const offset = (now - startAt) / 1000;
    const phase = offset < 0 ? 'waiting' : offset >= duration ? 'ended' : 'live';
    if (coverMode === 'error') return;

    enforce();
    bar.hidden = phase !== 'live';
    if (phase !== 'live') tap.hidden = true; else if (needsTap) tap.hidden = false;

    if (phase !== coverMode) {
      coverMode = phase;
      if (phase === 'waiting') setCover(waitingNode);
      else if (phase === 'ended') setCover(endedNode());
      else setCover(null);
    }
    if (phase === 'waiting') countdownEl.textContent = formatClock(Math.ceil(-offset));

    tracker.setSession(startAt);
    tracker.tick(Math.max(0, offset), phase === 'live' && !engine.paused && !needsTap);

    chatInput.disabled = phase !== 'live';
    if (phase === 'live') {
      if (!joined) { joined = true; track('webinar_join'); }
      viewersEl.textContent = fakeViewerCount(webinar.viewersBase, offset).toLocaleString('pt-BR') + ' assistindo';
      let due = webinar.chat.filter((l) => l.at <= offset);
      if (!chatStart) { due = due.slice(-80); chatStart = true; } else due = due.filter((l) => !rendered.has(l.id));
      due.forEach((l) => addLine(l, false));
      const current = sortedOffers().filter((o) => o.at <= offset).pop();
      if ((current ? current.id : null) !== lastOfferId) setOffer(current || null);
    } else if (lastOfferId && phase === 'waiting') setOffer(null);
  }
  tickTimer = setInterval(tick, 500);
  tick();

  // Atualiza chat/ofertas/ativação sem interromper quem já está assistindo.
  if (!preview) {
    refreshTimer = setInterval(async () => {
      try {
        const { webinar: fresh } = await api('get', { id });
        if (!fresh) {
          clearInterval(tickTimer); clearInterval(refreshTimer);
          engine.destroy();
          return message('Webinar indisponível', 'Este webinar não está no ar no momento.');
        }
        Object.assign(webinar, { chat: fresh.chat || [], offers: fresh.offers || [], viewersBase: fresh.viewersBase || webinar.viewersBase, allowViewerChat: fresh.allowViewerChat !== false });
        chatForm.hidden = !webinar.allowViewerChat;
      } catch (e) { /* mantém a configuração atual */ }
    }, 60000);
  }
}

boot();
