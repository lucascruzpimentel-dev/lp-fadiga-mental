// Validação/saneamento do webinar vindo do painel (lista branca de campos, limites e URLs http/https).
const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v, min, max, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const httpUrl = (v) => {
  const s = str(v, 2000).trim();
  return s === '' || /^https?:\/\//i.test(s) ? s : null;
};

function validateWebinar(w) {
  if (!w || typeof w !== 'object') throw new Error('Dados inválidos');
  if (typeof w.id !== 'string' || !/^[a-z0-9-]{1,40}$/i.test(w.id)) throw new Error('ID inválido');

  const videoUrl = httpUrl(w.videoUrl);
  if (videoUrl === null) throw new Error('A URL do vídeo deve começar com http:// ou https://');

  const offers = (Array.isArray(w.offers) ? w.offers : []).slice(0, 50).map((o) => {
    const url = httpUrl(o && o.url);
    if (url === null) throw new Error('O link da oferta deve começar com http:// ou https://');
    return {
      id: str(o.id, 40),
      at: num(o.at, 0, 86400, 0),
      title: str(o.title, 200),
      description: str(o.description, 1000),
      cta: str(o.cta, 100),
      url,
      price: str(o.price, 100),
    };
  });

  const chat = (Array.isArray(w.chat) ? w.chat : []).slice(0, 3000).map((l) => ({
    id: str(l && l.id, 40),
    at: num(l && l.at, 0, 86400, 0),
    author: str(l && l.author, 100),
    text: str(l && l.text, 500),
  }));

  return {
    id: w.id,
    title: str(w.title, 200),
    host: str(w.host, 200),
    videoUrl,
    duration: Math.round(num(w.duration, 0, 86400, 0)),
    active: w.active === true,
    days: [...new Set((Array.isArray(w.days) ? w.days : []).map(Number).filter((d) => d >= 0 && d <= 6))],
    slots: (Array.isArray(w.slots) ? w.slots : []).filter((s) => /^\d{2}:\d{2}$/.test(s)).slice(0, 48),
    timezone: validTz(w.timezone) ? w.timezone : 'America/Sao_Paulo',
    allowLateJoin: w.allowLateJoin !== false,
    allowViewerChat: w.allowViewerChat !== false,
    viewersBase: Math.round(num(w.viewersBase, 1, 100000, 180)),
    chat,
    offers,
  };
}

function validTz(tz) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return typeof tz === 'string';
  } catch (e) {
    return false;
  }
}

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

module.exports = { validateWebinar, EMAIL };
