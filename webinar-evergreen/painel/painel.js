// Painel de gestão dos webinars evergreen (login, dashboard e editor).
import {
  api, blankWebinar, brandMark, buildCommentsPrompt, chatToText, formatClock, generateChat, h, isValidSlot, lsGet, lsSet,
  newId, normalize, parseChatText, parseClock, parseTranscript, TOKEN_KEY, transcriptToText, upcomingSessions,
} from '/webinar-evergreen/assets/core.js';
import { parseVideoSource, probeDuration } from '/webinar-evergreen/assets/player-engines.js';

const app = document.getElementById('app');
const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const TIMEZONES = [['America/Sao_Paulo', 'Brasília (GMT-3)'], ['America/Manaus', 'Manaus (GMT-4)'], ['America/Rio_Branco', 'Rio Branco (GMT-5)'], ['America/New_York', 'Nova York'], ['Europe/Lisbon', 'Lisboa'], ['UTC', 'UTC']];
const TZ_SHORT = Object.fromEntries(TIMEZONES.map(([k, v]) => [k, v.replace(/ \(.*\)/, '')]));
const fmtWhen = (tz) => new Intl.DateTimeFormat('pt-BR', { timeZone: tz, weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * Ignora um segundo clique na MESMA posição em < 400 ms: ao re-renderizar, outro botão pode
 * surgir sob o cursor e receber um clique repetido (ex.: "Adicionar" -> "×" do chip criado).
 */
let last = { t: -1e9, x: NaN, y: NaN };
const once = (fn) => (e) => {
  if (e) {
    const same = e.timeStamp - last.t < 400 && e.clientX === last.x && e.clientY === last.y;
    if (same) return;
    last = { t: e.timeStamp, x: e.clientX, y: e.clientY };
  }
  return fn(e);
};

let token = lsGet(TOKEN_KEY);
let data = null; // { webinars, counts }

const logout = () => { token = null; data = null; lsSet(TOKEN_KEY, null); render(); };

async function call(action, payload) {
  try {
    return await api(action, Object.assign({ token }, payload));
  } catch (e) {
    if (e.status === 401) logout();
    throw e;
  }
}

async function load() {
  const d = await call('dashboard');
  data = { webinars: d.webinars.map(normalize), counts: d.counts, watch: d.watch };
}

/** Barra superior marinho com a marca nominal. */
function topbar(label, ...actions) {
  return h('header', { class: 'topbar' }, brandMark(),
    h('div', { class: 'row' }, h('span', { class: 'label' }, label), ...actions));
}

// ---------- roteamento por hash ----------
async function render() {
  if (!token) return renderLogin();
  if (!data) {
    app.replaceChildren(h('p', { class: 'center muted', style: 'padding:80px' }, 'Carregando…'));
    try { await load(); } catch (e) {
      if (e.status === 401) return;
      return app.replaceChildren(h('div', { class: 'wrap' }, h('p', { class: 'error' }, 'Não foi possível carregar: ' + e.message), h('button', { class: 'btn', onclick: () => render() }, 'Tentar de novo')));
    }
  }
  const au = /^#\/audience\/([\w-]+)/.exec(location.hash);
  if (au) {
    const w = data.webinars.find((x) => x.id === au[1]);
    return w ? renderAudience(w) : (location.hash = '#/');
  }
  const m = /^#\/edit\/([\w-]+)/.exec(location.hash);
  if (m) {
    const w = data.webinars.find((x) => x.id === m[1]);
    return w ? renderEditor(w) : (location.hash = '#/');
  }
  renderDashboard();
}
window.addEventListener('hashchange', render);

// ---------- login ----------
function renderLogin() {
  const pw = h('input', { class: 'input', type: 'password', placeholder: 'Senha', autofocus: true, autocomplete: 'current-password' });
  const err = h('p', { class: 'error', hidden: true });
  const btn = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'Entrar');
  const form = h('form', { class: 'stack', style: 'width:100%;max-width:340px' }, brandMark(true), h('h1', { style: 'font-size:24px;margin-top:28px' }, 'Painel de webinars'), pw, err, btn);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    btn.disabled = true; err.hidden = true;
    try {
      const r = await api('login', { password: pw.value });
      token = r.token; lsSet(TOKEN_KEY, token);
      render();
    } catch (ex) { err.textContent = ex.message; err.hidden = false; btn.disabled = false; }
  });
  app.replaceChildren(h('div', { style: 'min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px' }, form));
}

// ---------- dashboard ----------
function blocker(w) {
  if (!w.videoUrl) return 'Falta o vídeo';
  if (!w.slots.length || !w.days.length) return 'Falta definir dias e horários';
  return null;
}
const daysLabel = (d) => (d.length === 7 ? 'Todos os dias' : d.map((x) => DAYS[x]).join(', ') || 'Nenhum dia');

/** Evita que o Excel/Sheets execute células que começam com = + - @ (CSV injection). */
const csvCell = (v) => `"${(/^[=+\-@\t\r]/.test(v) ? "'" + v : v).replace(/"/g, '""')}"`;

const fmtLast = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

async function downloadLeads(w, given) {
  const leads = given || (await call('leads', { id: w.id })).leads;
  const header = 'nome,email,cadastro,pct_assistido,segundos_assistidos,entrou_em,ultima_atividade,sessoes';
  const rows = leads.map((l) => {
    const x = l.watch;
    return [csvCell(l.name), csvCell(l.email), new Date(l.at).toISOString(), x ? x.pct : 0, x ? x.seconds : 0,
      x ? formatClock(x.firstOffset) : '', x ? new Date(x.lastSeen).toISOString() : '', x ? x.sessions : 0].join(',');
  });
  const blob = new Blob(['\ufeff' + [header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = h('a', { href: URL.createObjectURL(blob), download: `leads-${w.id}.csv` });
  a.click();
  URL.revokeObjectURL(a.href);
}

async function save(w) {
  await call('save', { webinar: w });
  const i = data.webinars.findIndex((x) => x.id === w.id);
  if (i >= 0) data.webinars[i] = w; else data.webinars.unshift(w);
}

function demoWebinar() {
  const duration = 596;
  return Object.assign(blankWebinar(), {
    title: 'Aula demonstrativa', host: 'Seu Nome', duration,
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    chat: generateChat(duration, [300], 50),
    offers: [{ id: newId(), at: 300, title: 'Programa completo com 30% off', description: 'Condição exclusiva para quem está assistindo agora.', cta: 'Quero minha vaga', url: 'https://example.com/oferta', price: '12x de R$ 97' }],
  });
}

async function createAndOpen(w) {
  try { await save(w); location.hash = '#/edit/' + w.id; } catch (e) { alert('Não foi possível criar: ' + e.message); }
}

function renderDashboard() {
  const { webinars, counts } = data;
  const now = Date.now();
  const leadsTotal = Object.values(counts).reduce((n, c) => n + c, 0);

  const cards = webinars.map((w) => {
    const block = blocker(w);
    const next = block ? null : upcomingSessions(Object.assign({}, w, { allowLateJoin: true }), w.duration || 3600, now, 1)[0];
    const leads = counts[w.id] || 0;
    const status = !w.active ? h('span', { class: 'badge' }, 'Pausado')
      : next && next.inProgress ? h('span', { class: 'badge badge-live' }, h('i', { class: 'dot' }), 'Ao vivo agora')
      : h('span', { class: 'badge badge-on' }, 'No ar');

    const toggle = h('input', { type: 'checkbox', checked: w.active, disabled: !w.active && !!block });
    toggle.addEventListener('change', once(async () => {
      try { await save(Object.assign({}, w, { active: toggle.checked })); setTimeout(renderDashboard, 450); }
      catch (e) { alert(e.message); toggle.checked = w.active; }
    }));
    const copy = h('button', { class: 'btn btn-ghost btn-sm' }, 'Copiar link');
    copy.addEventListener('click', async () => {
      await navigator.clipboard.writeText(`${location.origin}/w/${w.id}`);
      copy.textContent = 'Copiado'; setTimeout(() => (copy.textContent = 'Copiar link'), 1500);
    });

    return h('div', { class: 'card' },
      h('div', { class: 'card-top' },
        h('div', null,
          h('div', { class: 'card-title' }, w.title || 'Sem título', status),
          h('div', { class: 'card-meta' },
            `${daysLabel(w.days)} · ${w.slots.join(', ') || 'sem horários'} · ${TZ_SHORT[w.timezone] || w.timezone}`, h('br'),
            `${w.duration ? formatClock(w.duration) : 'duração automática'} · ${w.chat.length} comentários · ${w.offers.length} ofertas · ${leads} cadastros`,
            w.active && next && !next.inProgress && [h('br'), 'Próxima sessão: ', h('b', { style: 'color:var(--text)' }, fmtWhen(w.timezone).format(next.startAt))],
            data.watch && data.watch[w.id] && data.watch[w.id].viewers > 0 && [h('br'),
              `Audiência: ${data.watch[w.id].viewers} assistiram · média ${data.watch[w.id].avg}% · ${data.watch[w.id].ge50} com 50% ou mais · ${data.watch[w.id].ge90} com 90% ou mais`],
            block && [h('br'), h('span', { class: 'error' }, block)])),
        h('label', { class: 'toggle' }, h('span', { class: 'switch' }, toggle, h('i')), w.active ? 'Ativo' : 'Pausado')),
      h('div', { class: 'card-actions' },
        copy,
        h('a', { class: 'btn btn-ghost btn-sm', href: `/w/${w.id}?preview=1`, target: '_blank', rel: 'noopener' }, 'Prévia'),
        h('a', { class: 'btn btn-ghost btn-sm', href: '#/audience/' + w.id }, 'Audiência'),
        h('button', { class: 'btn btn-ghost btn-sm', disabled: leads === 0, onclick: () => downloadLeads(w).catch((e) => alert(e.message)) }, 'Baixar leads'),
        h('span', { class: 'grow' }),
        h('a', { class: 'btn btn-ghost btn-sm', href: '#/edit/' + w.id }, 'Configurar'),
        h('button', { class: 'btn btn-ghost btn-sm', onclick: once(async () => {
          if (!confirm(`Excluir "${w.title}" e todos os seus cadastros?`)) return;
          try { await call('delete', { id: w.id }); data.webinars = data.webinars.filter((x) => x.id !== w.id); delete data.counts[w.id]; renderDashboard(); } catch (e) { alert(e.message); }
        }) }, 'Excluir')));
  });

  const stat = (label, value) => h('div', { class: 'stat' }, h('dt', null, label), h('dd', null, String(value)));
  app.replaceChildren(topbar('Painel de webinars', h('button', { class: 'btn btn-ghost btn-sm', onclick: logout }, 'Sair')), h('div', { class: 'wrap' },
    h('header', { class: 'row', style: 'align-items:flex-end;justify-content:space-between' },
      h('div', null, h('h1', { class: 'page-title' }, 'Webinars evergreen'),
        h('p', { class: 'muted', style: 'margin-top:12px' }, 'Transmissões gravadas que vão ao ar sozinhas, nos dias e horários que você define.')),
      h('button', { class: 'btn btn-primary', onclick: () => createAndOpen(blankWebinar()) }, 'Novo webinar')),
    h('dl', { class: 'stats' }, stat('Webinars', webinars.length), stat('No ar', webinars.filter((w) => w.active).length), stat('Cadastros', leadsTotal)),
    webinars.length
      ? h('div', { class: 'cards' }, cards)
      : h('div', { class: 'empty' }, h('p', { class: 'muted' }, 'Nenhum webinar ainda.'), h('button', { class: 'btn', style: 'margin-top:12px', onclick: () => createAndOpen(demoWebinar()) }, 'Criar exemplo pronto'))));
}

// ---------- audiência ----------
async function renderAudience(w) {
  app.replaceChildren(topbar('Audiência'), h('p', { class: 'center muted', style: 'padding:80px' }, 'Carregando…'));
  let r;
  try { r = await call('leads', { id: w.id }); } catch (e) {
    if (e.status === 401) return;
    return app.replaceChildren(topbar('Audiência'), h('div', { class: 'wrap' }, h('p', { class: 'error' }, 'Não foi possível carregar: ' + e.message)));
  }
  const leads = r.leads;
  const seen = (l) => l.watch && l.watch.seconds >= 60; // "assistiu" = pelo menos 1 minuto
  const people = leads.filter(seen);
  const stat = (label, value) => h('div', { class: 'stat' }, h('dt', null, label), h('dd', null, String(value)));
  const avg = people.length ? Math.round(people.reduce((n, l) => n + l.watch.pct, 0) / people.length) : 0;

  const filters = [
    ['all', 'Todos os cadastros', () => true],
    ['seen', 'Assistiram (1 min ou mais)', seen],
    ['none', 'Não assistiram', (l) => !seen(l)],
    ['50', '50% ou mais', (l) => seen(l) && l.watch.pct >= 50],
    ['90', '90% ou mais', (l) => seen(l) && l.watch.pct >= 90],
  ];
  const select = h('select', { class: 'select', style: 'max-width:280px', 'aria-label': 'Filtrar' },
    ...filters.map(([v, label]) => h('option', { value: v }, label)));
  const body = h('tbody');
  const count = h('span', { class: 'muted', style: 'font-size:14px' });
  const draw = () => {
    const f = filters.find(([v]) => v === select.value)[2];
    const rows = leads.filter(f).sort((a, b) => (b.watch ? b.watch.pct : -1) - (a.watch ? a.watch.pct : -1) || a.name.localeCompare(b.name));
    count.textContent = `${rows.length} ${rows.length === 1 ? 'pessoa' : 'pessoas'}`;
    body.replaceChildren(...rows.map((l) => h('tr', null,
      h('td', null, l.name),
      h('td', { class: 'muted' }, l.email),
      h('td', null, h('div', { class: 'pbar-row' }, h('span', { class: 'pbar', role: 'img', 'aria-label': `${l.watch ? l.watch.pct : 0}% assistido` }, h('i', { style: `width:${l.watch ? l.watch.pct : 0}%` })),
        h('b', null, `${l.watch ? l.watch.pct : 0}%`))),
      h('td', { class: 'muted' }, l.watch ? formatClock(l.watch.firstOffset) : '—'),
      h('td', { class: 'muted' }, l.watch ? fmtLast.format(new Date(l.watch.lastSeen)) : '—'),
      h('td', { class: 'muted' }, l.watch ? String(l.watch.sessions) : '—'))));
  };
  select.addEventListener('change', draw);
  draw();

  app.replaceChildren(topbar('Audiência'), h('div', { class: 'wrap' },
    h('a', { class: 'btn btn-ghost btn-sm', href: '#/' }, '← Webinars'),
    h('div', { class: 'row', style: 'margin-top:12px;justify-content:space-between;align-items:flex-end' },
      h('div', null, h('h1', { class: 'page-title', style: 'font-size:24px' }, w.title || 'Sem título'),
        h('p', { class: 'muted', style: 'margin-top:12px' }, 'Quanto de cada transmissão cada pessoa assistiu (trechos realmente reproduzidos, sobre a duração total do vídeo).')),
      h('button', { class: 'btn', onclick: () => downloadLeads(w, leads).catch((e) => alert(e.message)) }, 'Baixar CSV')),
    !r.watchEnabled && h('p', { class: 'box', style: 'margin-top:24px' }, 'A audiência ainda não está ativa: rode de novo o arquivo webinar-evergreen/supabase/schema.sql no SQL Editor do Supabase para criar a tabela watch_sessions.'),
    h('dl', { class: 'stats', style: 'grid-template-columns:repeat(5,1fr)' },
      stat('Cadastros', leads.length), stat('Assistiram', people.length), stat('50% ou mais', people.filter((l) => l.watch.pct >= 50).length),
      stat('90% ou mais', people.filter((l) => l.watch.pct >= 90).length), stat('Média', avg + '%')),
    h('div', { class: 'row', style: 'justify-content:space-between;margin-bottom:12px' }, select, count),
    h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
      h('thead', null, h('tr', null, ...['Nome', 'E-mail', 'Assistido', 'Entrou em', 'Última atividade', 'Sessões'].map((t) => h('th', null, t)))),
      body))));
}

// ---------- editor ----------
const field = (label, control) => h('label', { class: 'field' }, h('span', null, label), control);
const section = (title, ...children) => h('section', { class: 'section stack' }, h('h2', null, title), ...children);
function toggleRow(label, checked, onChange) {
  const input = h('input', { type: 'checkbox', checked });
  input.addEventListener('change', () => onChange(input.checked));
  return h('label', { class: 'toggle' }, h('span', { class: 'switch' }, input, h('i')), label);
}
function textInput(value, onInput, attrs) {
  const el = h('input', Object.assign({ class: 'input', value }, attrs));
  el.addEventListener('input', () => onInput(el.value));
  return el;
}
/** Campo mm:ss que só confirma o valor ao sair do campo. */
function clockInput(value, onChange) {
  const el = h('input', { class: 'input mono w-sm', value: formatClock(value) });
  el.addEventListener('blur', () => {
    const s = parseClock(el.value);
    if (Number.isNaN(s)) el.value = formatClock(value); else { value = s; onChange(s); el.value = formatClock(s); }
  });
  return el;
}

function renderEditor(stored) {
  const d = JSON.parse(JSON.stringify(stored));
  let chatText = chatToText(d.chat);

  const title = h('h1', { class: 'page-title', style: 'font-size:24px' }, d.title || 'Sem título');
  const status = h('span', { class: 'muted', style: 'font-size:13px' });
  const saveBtn = h('button', { class: 'btn btn-primary' }, 'Salvar');

  // básico
  const durationBox = clockInput(d.duration, (s) => { d.duration = s; renderSessions(); });
  const videoHint = h('p', { class: 'muted', style: 'margin:6px 0 0;font-size:12px' });
  const showVideoHint = () => {
    const src = parseVideoSource(d.videoUrl);
    videoHint.textContent = !d.videoUrl ? 'Cole o link do Vimeo (ou o código de incorporação) ou a URL de um arquivo .mp4/.webm.'
      : src.type === 'vimeo' ? `Vimeo reconhecido (vídeo ${src.id}${src.hash ? ', link não listado' : ''}).`
      : 'Arquivo de vídeo direto.';
  };
  const videoInput = textInput(d.videoUrl, (v) => { d.videoUrl = parseVideoSource(v).url; showVideoHint(); }, { placeholder: 'https://vimeo.com/123456789  ou  https://…/webinar.mp4' });
  videoInput.addEventListener('blur', () => { videoInput.value = d.videoUrl; }); // cola o <iframe> e fica só o link
  showVideoHint();
  const detect = h('button', { class: 'btn', type: 'button' }, 'Detectar do vídeo');
  detect.addEventListener('click', async () => {
    detect.disabled = true; detect.textContent = 'Detectando…';
    try {
      d.duration = await probeDuration(parseVideoSource(d.videoUrl));
      durationBox.value = formatClock(d.duration); renderSessions();
    } catch (e) {
      alert('Não foi possível ler o vídeo. No Vimeo, confira se o vídeo está liberado para incorporação neste domínio; em arquivo direto, a URL precisa ser .mp4 ou .webm.');
    }
    detect.disabled = false; detect.textContent = 'Detectar do vídeo';
  });

  // agenda
  const daysBox = h('div', { class: 'days' });
  DAYS.forEach((label, i) => {
    const btn = h('button', { class: 'btn btn-sm', type: 'button' }, label);
    const paint = () => btn.classList.toggle('btn-primary', d.days.includes(i));
    btn.addEventListener('click', once(() => { d.days = d.days.includes(i) ? d.days.filter((x) => x !== i) : [...d.days, i].sort(); paint(); renderSessions(); }));
    paint();
    daysBox.append(btn);
  });
  const chipsBox = h('span', { class: 'row', style: 'display:contents' });
  const slotInput = h('input', { class: 'input w-sm', type: 'time' });
  const addSlot = h('button', { class: 'btn btn-sm', type: 'button' }, 'Adicionar');
  const slotsBox = h('div', { class: 'row' }, chipsBox, slotInput, addSlot);
  const renderSlots = () => chipsBox.replaceChildren(
    ...d.slots.map((s) => h('span', { class: 'chip' }, s, h('button', { type: 'button', 'aria-label': 'Remover ' + s, onclick: once(() => { d.slots = d.slots.filter((x) => x !== s); renderSlots(); renderSessions(); }) }, '×'))));
  addSlot.addEventListener('click', once(() => {
    const s = slotInput.value.trim().padStart(5, '0');
    if (isValidSlot(s) && !d.slots.includes(s)) { d.slots = [...d.slots, s].sort(); renderSlots(); renderSessions(); }
    slotInput.value = '';
  }));
  const tz = h('select', { class: 'select', style: 'max-width:260px' }, ...TIMEZONES.map(([k, v]) => h('option', { value: k, selected: k === d.timezone }, v)));
  tz.addEventListener('change', () => { d.timezone = tz.value; renderSessions(); });
  const sessionsBox = h('div', { class: 'box sessions' });
  function renderSessions() {
    const list = upcomingSessions(d, d.duration || 3600, Date.now(), 5);
    sessionsBox.replaceChildren(h('b', null, 'Próximas sessões (fuso selecionado)'),
      ...(list.length ? list.map((u) => h('div', null, fmtWhen(d.timezone).format(u.startAt) + (u.inProgress ? ' · em andamento' : ''))) : [h('div', null, 'Defina ao menos um dia e um horário.')]));
  }
  const lateJoin = toggleRow('Permitir entrar com a sessão em andamento (senão, aguarda a próxima)', d.allowLateJoin, (v) => { d.allowLateJoin = v; renderSessions(); });

  // chat
  const chatArea = h('textarea', { class: 'textarea mono', rows: '10', placeholder: '00:12 | Mariana S. | Boa noite, pessoal! 👋\n05:40 | Rafael Lima | Isso é ouro' });
  chatArea.value = chatText;
  const chatInfo = h('span', { class: 'muted', style: 'font-size:13px' });
  const updateChatInfo = () => {
    const p = parseChatText(chatArea.value);
    chatInfo.replaceChildren(`${p.lines.length} comentários`, p.errors.length ? h('span', { class: 'error' }, ' · linhas inválidas: ' + p.errors.join(', ')) : '');
  };
  chatArea.addEventListener('input', updateChatInfo);
  const genCount = h('input', { class: 'input w-sm', type: 'number', min: '5', max: '300', value: '60', style: 'width:90px', 'aria-label': 'Quantidade de comentários' });
  const gen = h('button', { class: 'btn btn-sm', type: 'button' }, 'Modelo genérico (sem IA)');
  gen.addEventListener('click', () => {
    const n = Math.min(300, Math.max(5, Number(genCount.value) || 60));
    chatArea.value = chatToText(generateChat(d.duration || 3600, d.offers.map((o) => o.at), n));
    updateChatInfo();
  });
  updateChatInfo();

  // transcrição + geração coerente com o conteúdo
  d.transcript = d.transcript || [];
  const trArea = h('textarea', { class: 'textarea mono', rows: '6', placeholder: 'Cole a transcrição com timestamps (SRT, VTT ou linhas "mm:ss texto")…' });
  trArea.value = transcriptToText(d.transcript);
  const trInfo = h('p', { class: 'muted', style: 'font-size:13px' });
  const updateTrInfo = (r) => {
    const segs = d.transcript;
    if (segs.length) {
      const end = segs[segs.length - 1].at;
      const short = d.duration && end < d.duration * 0.8 ? ` · termina em ${formatClock(end)}, antes do fim do vídeo (${formatClock(d.duration)})` : '';
      trInfo.className = 'muted';
      trInfo.textContent = `${segs.length} trechos · ${formatClock(segs[0].at)} a ${formatClock(end)}${short}`;
    } else if (trArea.value.trim()) {
      trInfo.className = 'error';
      trInfo.textContent = 'Nenhum timestamp reconhecido. Use linhas no formato "mm:ss texto" ou um arquivo .srt/.vtt.';
    } else {
      trInfo.className = 'muted';
      trInfo.textContent = 'Sem transcrição. No Vimeo: Configurações do vídeo → Legendas → baixe o arquivo .vtt.';
    }
  };
  const applyTranscript = (raw, rewrite) => {
    d.transcript = parseTranscript(raw).segments;
    if (rewrite && d.transcript.length) trArea.value = transcriptToText(d.transcript);
    updateTrInfo();
  };
  trArea.addEventListener('input', () => applyTranscript(trArea.value, false));
  trArea.addEventListener('blur', () => { if (d.transcript.length) trArea.value = transcriptToText(d.transcript); });
  const fileIn = h('input', { type: 'file', accept: '.srt,.vtt,.txt,text/plain,text/vtt', hidden: true });
  fileIn.addEventListener('change', async () => {
    const f = fileIn.files[0];
    fileIn.value = '';
    if (!f) return;
    if (f.size > 3_000_000) return alert('Arquivo grande demais (máximo 3 MB).');
    const txt = await f.text();
    trArea.value = txt;
    applyTranscript(txt, true);
  });
  const pick = h('button', { class: 'btn btn-sm', type: 'button', onclick: () => fileIn.click() }, 'Importar arquivo (.srt, .vtt, .txt)');
  updateTrInfo();

  const aiStatus = h('p', { class: 'muted', style: 'font-size:13px' });
  const say = (text, isError) => { aiStatus.className = isError ? 'error' : 'muted'; aiStatus.textContent = text; };
  const checkReady = () => {
    if (d.transcript.length < 3) { say('Importe a transcrição com timestamps antes de gerar.', true); return false; }
    if (!d.duration) { say('Informe a duração do vídeo (use "Detectar do vídeo").', true); return false; }
    return true;
  };
  const wanted = () => Math.min(300, Math.max(5, Number(genCount.value) || 60));
  const aiBtn = h('button', { class: 'btn btn-primary', type: 'button' }, 'Gerar comentários com IA');
  aiBtn.addEventListener('click', async () => {
    if (!checkReady()) return;
    if (chatArea.value.trim() && !confirm('Substituir os comentários atuais pelos que serão gerados?')) return;
    aiBtn.disabled = true;
    say('Gerando… pode levar até 1 minuto.');
    try {
      const r = await call('chat-generate', {
        transcript: d.transcript, duration: d.duration, count: wanted(), offers: d.offers.map((o) => o.at), title: d.title, host: d.host,
      });
      chatArea.value = chatToText(r.comments);
      updateChatInfo();
      say(`${r.comments.length} comentários gerados (${r.model}, ${(r.usage.input + r.usage.output).toLocaleString('pt-BR')} tokens). Revise e clique em Salvar.`);
    } catch (e) { say(e.message, true); }
    aiBtn.disabled = false;
  });
  const copyPrompt = h('button', { class: 'btn btn-sm', type: 'button' }, 'Copiar prompt (usar no Claude.ai)');
  copyPrompt.addEventListener('click', async () => {
    if (!checkReady()) return;
    await navigator.clipboard.writeText(buildCommentsPrompt({ title: d.title, host: d.host, duration: d.duration, count: wanted(), offers: d.offers.map((o) => o.at), segments: d.transcript }));
    say('Prompt copiado. Cole no Claude.ai, copie a resposta e cole no campo de comentários abaixo.');
  });

  // ofertas
  const offersBox = h('div', { class: 'stack' });
  function renderOffers() {
    offersBox.replaceChildren(...d.offers.map((o) => h('div', { class: 'box stack' },
      h('div', { class: 'row' }, h('span', { style: 'font-size:13px;font-weight:600' }, 'Aparece em'), clockInput(o.at, (s) => (o.at = s)), h('span', { class: 'grow' }),
        h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: once(() => { d.offers = d.offers.filter((x) => x !== o); renderOffers(); }) }, 'Remover')),
      textInput(o.title, (v) => (o.title = v), { placeholder: 'Título da oferta' }),
      (() => { const t = h('textarea', { class: 'textarea', rows: '2', placeholder: 'Descrição' }); t.value = o.description; t.addEventListener('input', () => (o.description = t.value)); return t; })(),
      h('div', { class: 'grid2' }, textInput(o.cta, (v) => (o.cta = v), { placeholder: 'Texto do botão' }), textInput(o.price || '', (v) => (o.price = v), { placeholder: 'Preço (ex.: 12x de R$ 97)' })),
      textInput(o.url, (v) => (o.url = v.trim()), { placeholder: 'https://link-de-checkout' }))));
  }
  const addOffer = h('button', { class: 'btn', type: 'button', onclick: () => {
    d.offers.push({ id: newId(), at: Math.floor((d.duration || 3600) * 0.7), title: '', description: '', cta: 'Quero aproveitar', url: '', price: '' });
    renderOffers();
  } }, '+ Adicionar oferta');

  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true; status.className = 'muted'; status.textContent = 'Salvando…';
    try {
      d.chat = parseChatText(chatArea.value).lines;
      await save(d);
      title.textContent = d.title || 'Sem título';
      status.textContent = 'Salvo';
    } catch (e) { status.className = 'error'; status.textContent = e.message; }
    saveBtn.disabled = false;
  });

  renderSlots(); renderSessions(); renderOffers();
  app.replaceChildren(topbar('Editar webinar'), h('div', { class: 'wrap', style: 'max-width:760px' },
    h('a', { class: 'btn btn-ghost btn-sm', href: '#/' }, '← Webinars'),
    h('div', { class: 'row', style: 'margin-top:12px;justify-content:space-between' }, title,
      h('div', { class: 'row' }, status, h('a', { class: 'btn', href: `/w/${d.id}?preview=1`, target: '_blank', rel: 'noopener' }, 'Prévia'), saveBtn)),
    section('Básico',
      field('Título', textInput(d.title, (v) => (d.title = v))),
      field('Apresentador', textInput(d.host, (v) => (d.host = v))),
      field('Vídeo (link do Vimeo ou arquivo .mp4/.webm)', h('div', null, videoInput, videoHint)),
      field('Duração (mm:ss — 0 detecta automaticamente)', h('div', { class: 'row' }, durationBox, detect))),
    section('Agendamento',
      toggleRow('Webinar ativo (página pública no ar)', d.active, (v) => (d.active = v)),
      field('Dias da semana', daysBox), field('Horários de início', slotsBox), field('Fuso horário dos horários acima', tz), lateJoin, sessionsBox),
    section('Chat',
      toggleRow('Espectador pode enviar mensagens', d.allowViewerChat, (v) => (d.allowViewerChat = v)),
      field('Espectadores simulados (pico aproximado)', textInput(String(d.viewersBase), (v) => (d.viewersBase = Math.max(1, Number(v) || 1)), { type: 'number', min: '1', style: 'width:130px' })),
      field('Transcrição do vídeo (para comentários coerentes com o que é dito)', trArea),
      h('div', { class: 'row' }, pick, fileIn, trInfo),
      h('div', { class: 'row' }, genCount, aiBtn, copyPrompt),
      aiStatus,
      field('Comentários programados — um por linha: mm:ss | Nome | mensagem', chatArea),
      h('div', { class: 'row' }, chatInfo, h('span', { class: 'grow' }), gen)),
    section('Ofertas automáticas', offersBox, addOffer),
    h('p', { class: 'muted', style: 'margin-top:32px;font-size:12px' }, 'Link público: ' + location.origin + '/w/' + d.id)));
}

render();
