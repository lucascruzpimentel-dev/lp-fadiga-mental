// Webinar evergreen — lógica compartilhada entre painel e sala (ES module, sem dependências).

// ---------- utilidades ----------
export const newId = () => Math.random().toString(36).slice(2, 10);

export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${m}:${sec}` : `${m}:${sec}`;
}

/** Aceita "90", "1:30" ou "1:02:03" e devolve segundos (NaN se inválido). */
export function parseClock(input) {
  const parts = String(input).trim().split(':');
  if (parts.length > 3 || parts.some((p) => !/^\d+$/.test(p.trim()))) return NaN;
  return parts.reduce((acc, p) => acc * 60 + Number(p), 0);
}

/** Elemento DOM seguro: texto sempre via textContent, nunca innerHTML. */
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

// ---------- modelo ----------
export function blankWebinar() {
  return {
    id: newId(),
    title: 'Novo webinar',
    host: '',
    videoUrl: '',
    duration: 0,
    active: false,
    days: [0, 1, 2, 3, 4, 5, 6],
    slots: ['10:00', '15:00', '20:00'],
    timezone: 'America/Sao_Paulo',
    allowLateJoin: true,
    allowViewerChat: true,
    viewersBase: 180,
    chat: [],
    offers: [],
  };
}

export const normalize = (w) => Object.assign(blankWebinar(), w);

// ---------- agenda com fuso horário ----------
function slotToMinutes(slot) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(slot).trim());
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  return hh > 23 || mm > 59 ? null : hh * 60 + mm;
}

export const isValidSlot = (s) => slotToMinutes(s) !== null;

function partsInZone(epoch, timeZone) {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
  });
  const g = {};
  for (const p of f.formatToParts(epoch)) if (p.type !== 'literal') g[p.type] = Number(p.value);
  return { y: g.year, m: g.month, d: g.day, h: g.hour, min: g.minute, s: g.second };
}

function zoneOffsetMs(epoch, timeZone) {
  const p = partsInZone(epoch, timeZone);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - Math.floor(epoch / 1000) * 1000;
}

/** Horário de parede em `timeZone` -> epoch ms. */
export function zonedToEpoch(y, m, d, hh, mm, timeZone) {
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const first = guess - zoneOffsetMs(guess, timeZone);
  return guess - zoneOffsetMs(first, timeZone); // corrige viradas de horário de verão
}

/**
 * Próximas sessões do cronograma, em ordem. Inclui a sessão em andamento
 * (iniciada há menos de `durationSec`) quando `sched.allowLateJoin`.
 */
export function upcomingSessions(sched, durationSec, now = Date.now(), count = 6) {
  const minutes = sched.slots.map(slotToMinutes).filter((m) => m !== null).sort((a, b) => a - b);
  if (!minutes.length || !sched.days.length) return [];
  const today = partsInZone(now, sched.timezone);
  const out = [];
  for (let k = -1; k < 15 && out.length < count; k++) {
    const date = new Date(Date.UTC(today.y, today.m - 1, today.d + k));
    if (!sched.days.includes(date.getUTCDay())) continue;
    for (const m of minutes) {
      const startAt = zonedToEpoch(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), Math.floor(m / 60), m % 60, sched.timezone);
      if (startAt > now) out.push({ startAt, inProgress: false });
      else if (sched.allowLateJoin && now < startAt + durationSec * 1000) out.push({ startAt, inProgress: true });
    }
  }
  return out.slice(0, count);
}

/** Contagem de espectadores plausível e determinística para o instante `offset`. */
export function fakeViewerCount(base, offset) {
  const wave = Math.sin(offset / 41) * 0.06 + Math.sin(offset / 13) * 0.03;
  const ramp = Math.min(1, offset / 300);
  return Math.max(1, Math.round(base * (0.55 + 0.45 * ramp) * (1 + wave)));
}

// ---------- chat falso ----------
const NAMES = ['Mariana S.', 'Rafael Lima', 'Camila Torres', 'João Pedro', 'Fernanda C.', 'Lucas Almeida', 'Beatriz Rocha', 'Thiago M.', 'Juliana Prado', 'Gustavo H.', 'Patrícia N.', 'André Souza', 'Larissa F.', 'Bruno Carvalho', 'Aline Duarte', 'Felipe R.', 'Carla Mendes', 'Diego Barros', 'Renata Alves', 'Marcos V.', 'Tatiane G.', 'Vinícius P.', 'Isabela Costa', 'Rodrigo T.'];
const ARRIVALS = ['Boa noite, pessoal! 👋', 'Cheguei! Já começou?', 'Olá de Belo Horizonte!', 'Presente 🙋‍♀️', 'Direto de Curitiba, bora!', 'Oi gente, tudo bem?', 'Em Recife já é de noite aqui rs'];
const REACTIONS = ['Muito bom isso!', 'Anotando tudo aqui 📝', 'Faz muito sentido', 'Isso mudou minha visão', 'Esse ponto é ouro', 'Concordo 100%', 'Nossa, nunca tinha pensado assim', '🔥🔥🔥', 'Qualidade de áudio perfeita', 'Alguém mais aplicando isso já?', 'Salvei esse trecho!', 'Que aula!', 'Explicação clara demais', 'Isso eu preciso testar amanhã'];
const QUESTIONS = ['Vai ter replay?', 'Dá pra aplicar isso começando do zero?', 'Qual o investimento inicial?', 'Funciona pra quem trabalha sozinho?', 'Vai falar do passo a passo depois?', 'E se eu não tiver experiência?', 'Tem algum bônus?'];
const OFFER_REACTIONS = ['Quero entrar! Como faço?', 'Já garanti a minha vaga 🙌', 'Acabei de comprar!', 'Valeu a pena esperar até o final', 'Link funcionando aqui, tá certo!', 'Garantido ✅'];

const pick = (arr, r) => arr[Math.floor(r * arr.length) % arr.length];

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Comentários espalhados pela duração; mais densos no começo e depois das ofertas. */
export function generateChat(duration, offerTimes, total) {
  const r = rng(duration * 7 + total);
  const dur = Math.max(60, duration);
  const out = [];
  for (let i = 0; i < total; i++) {
    const t = r();
    let at, text;
    if (t < 0.18) {
      at = r() * Math.min(120, dur * 0.1);
      text = pick(ARRIVALS, r());
    } else if (t < 0.5 || !offerTimes.length) {
      at = Math.min(120, dur * 0.1) + r() * dur * 0.85;
      text = pick(r() < 0.75 ? REACTIONS : QUESTIONS, r());
    } else {
      at = pick(offerTimes, r()) + 8 + r() * 180;
      text = pick(OFFER_REACTIONS, r());
    }
    out.push({ id: newId(), at: Math.min(Math.floor(at), Math.max(0, Math.floor(dur) - 1)), author: pick(NAMES, r()), text });
  }
  return out.sort((a, b) => a.at - b.at);
}

/** Formato por linha: `mm:ss | Nome | mensagem` */
export function parseChatText(raw) {
  const lines = [];
  const errors = [];
  raw.split('\n').forEach((row, i) => {
    if (!row.trim()) return;
    const [time, author, ...rest] = row.split('|');
    const at = parseClock(time || '');
    const text = rest.join('|').trim();
    if (Number.isNaN(at) || !author || !author.trim() || !text) return errors.push(i + 1);
    lines.push({ id: newId(), at, author: author.trim(), text });
  });
  return { lines: lines.sort((a, b) => a.at - b.at), errors };
}

export const chatToText = (chat) => chat.map((l) => `${formatClock(l.at)} | ${l.author} | ${l.text}`).join('\n');

// ---------- API ----------
export async function api(action, payload = {}) {
  const res = await fetch('/api/webinar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.assign({ action }, payload)),
  });
  let data = {};
  try { data = await res.json(); } catch (e) { /* corpo vazio */ }
  if (!res.ok) {
    const err = new Error(data.error || 'Erro ' + res.status);
    err.status = res.status;
    throw err;
  }
  return data;
}

// ---------- armazenamento local ----------
export const TOKEN_KEY = 'evergreen:admin-token';
export function lsGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
export function lsSet(key, value) {
  try { value == null ? localStorage.removeItem(key) : localStorage.setItem(key, value); } catch (e) { /* ignora */ }
}
