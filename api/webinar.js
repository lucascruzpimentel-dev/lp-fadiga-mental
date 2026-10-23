// API do webinar evergreen (uma única função): POST /api/webinar  { action, ... }
const { login, verify, signViewer, verifyViewer } = require('./_lib/webinar-auth');
const watchLib = require('./_lib/webinar-watch');
const db = require('./_lib/webinar-db');
const { generateChatComments, friendlyError } = require('./_lib/webinar-ai');
const { validateWebinar, validateTranscript, EMAIL } = require('./_lib/webinar-validate');

// Limite simples por IP (best-effort: a memória é por instância da função).
const hits = new Map();
function limited(key, max, windowMs) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > max;
}

function send(res, status, body) {
  res.status(status).json(body);
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return send(res, 405, { error: 'Método não permitido' });

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';

  try {
    switch (body.action) {
      // ---------- público ----------
      case 'get': {
        const w = await db.getWebinar(String(body.id || '').slice(0, 40));
        if (!w) return send(res, 200, { webinar: null });
        const admin = verify(body.token);
        if (!w.active && !admin) return send(res, 200, { webinar: null });
        if (!admin) delete w.transcript; // a transcrição é material interno: não vai para o público
        return send(res, 200, { webinar: w });
      }

      case 'lead': {
        if (limited('lead:' + ip, 10, 10 * 60 * 1000)) return send(res, 429, { error: 'Muitas tentativas. Tente mais tarde.' });
        const name = String(body.name || '').trim().slice(0, 100);
        const email = String(body.email || '').trim().toLowerCase().slice(0, 254);
        if (!name || !EMAIL.test(email)) return send(res, 400, { error: 'Nome ou e-mail inválido' });
        const w = await db.getWebinar(String(body.id || '').slice(0, 40));
        if (!w || !w.active) return send(res, 404, { error: 'Webinar indisponível' });
        await db.insertLead(w.id, name, email);
        return send(res, 200, { ok: true, sig: signViewer(w.id, email) });
      }

      // Batimento de audiência: trechos do vídeo realmente assistidos (união com o que já estava salvo).
      case 'watch': {
        const email = String(body.email || '').trim().toLowerCase();
        if (!EMAIL.test(email) || !verifyViewer(String(body.id || ''), email, body.sig)) return send(res, 401, { error: 'unauthorized' });
        if (limited('watch:' + email, 900, 60 * 60 * 1000)) return send(res, 429, { error: 'Muitas requisições' });
        const w = await db.getWebinar(String(body.id || '').slice(0, 40));
        if (!w) return send(res, 200, { ok: false });
        const duration = Math.round(w.duration || Number(body.duration) || 0);
        const sessionStart = Number(body.sessionStart);
        const now = Date.now();
        if (!(duration >= 60 && duration <= 86400) || !(sessionStart > now - 14 * 86400e3 && sessionStart < now + 10 * 60e3)) {
          return send(res, 400, { error: 'Dados inválidos' });
        }
        const sent = watchLib.mergeIntervals(body.intervals, duration);
        // ninguém assiste mais segundos do que se passaram desde o início da sessão
        if (watchLib.totalSeconds(sent) > (now - sessionStart) / 1000 + 15) return send(res, 400, { error: 'Dados inválidos' });
        const startIso = new Date(sessionStart).toISOString();
        const prev = await db.getWatch(w.id, email, startIso);
        const merged = watchLib.mergeIntervals([...(prev ? prev.intervals : []), ...sent], duration);
        if (!merged.length) return send(res, 200, { ok: true });
        await db.upsertWatch({
          webinar_id: w.id, email, name: String(body.name || '').slice(0, 100), session_start: startIso, duration,
          seconds_watched: Math.round(watchLib.totalSeconds(merged)), first_offset: Math.round(merged[0][0]),
          max_offset: Math.round(merged[merged.length - 1][1]), intervals: merged, last_seen: new Date().toISOString(),
        });
        return send(res, 200, { ok: true });
      }

      // ---------- admin ----------
      case 'login': {
        if (limited('login:' + ip, 8, 15 * 60 * 1000)) return send(res, 429, { error: 'Muitas tentativas. Aguarde alguns minutos.' });
        const token = login(body.password);
        if (!token) return send(res, 401, { error: 'Senha incorreta' });
        return send(res, 200, { token });
      }
    }

    if (!['dashboard', 'save', 'delete', 'leads', 'chat-generate'].includes(body.action)) {
      return send(res, 400, { error: 'Ação inválida' });
    }
    if (!verify(body.token)) return send(res, 401, { error: 'unauthorized' });

    switch (body.action) {
      case 'dashboard': {
        const [webinars, counts, watch] = await Promise.all([
          db.listWebinars(), db.leadCounts(),
          // sem a tabela watch_sessions (schema.sql ainda não rodou), o painel segue funcionando sem audiência
          db.listAllWatch().then((rows) => watchLib.summarize(rows)).catch(() => null),
        ]);
        return send(res, 200, { webinars, counts, watch });
      }
      case 'save': {
        await db.upsertWebinar(validateWebinar(body.webinar));
        return send(res, 200, { ok: true });
      }
      case 'delete': {
        await db.removeWebinar(String(body.id || '').slice(0, 40));
        return send(res, 200, { ok: true });
      }
      case 'leads': {
        const id = String(body.id || '').slice(0, 40);
        const [leads, rows] = await Promise.all([db.listLeads(id), db.listWatch(id).catch(() => null)]);
        const best = rows ? watchLib.bestByEmail(rows) : null;
        return send(res, 200, { leads: leads.map((l) => ({ ...l, watch: best ? best.get(l.email) || null : null })), watchEnabled: rows !== null });
      }
      case 'chat-generate': {
        if (limited('gen:' + ip, 12, 60 * 60 * 1000)) return send(res, 429, { error: 'Muitas gerações seguidas. Tente de novo em alguns minutos.' });
        const segments = validateTranscript(body.transcript);
        const duration = Math.round(Number(body.duration));
        const count = Math.round(Number(body.count));
        if (segments.length < 3) return send(res, 400, { error: 'Importe a transcrição com timestamps antes de gerar.' });
        if (!(duration >= 60 && duration <= 86400)) return send(res, 400, { error: 'Informe a duração do vídeo.' });
        if (!(count >= 5 && count <= 300)) return send(res, 400, { error: 'A quantidade deve ficar entre 5 e 300.' });
        const offers = (Array.isArray(body.offers) ? body.offers : []).map(Number).filter((t) => t >= 0 && t < duration).slice(0, 20);
        try {
          const r = await generateChatComments({
            segments, duration, count, offers,
            title: String(body.title || '').slice(0, 200), host: String(body.host || '').slice(0, 200),
          });
          return send(res, 200, r);
        } catch (e) {
          console.error('[api/webinar] chat-generate', e && e.message);
          const f = friendlyError(e);
          return send(res, f.status, { error: f.message });
        }
      }
    }
  } catch (e) {
    const msg = e && e.message ? e.message : 'Erro';
    // erros de configuração/validação são úteis ao admin; o resto fica genérico para o público
    const safe = /not configured|inválid|deve começar/.test(msg) ? msg : 'Erro interno';
    console.error('[api/webinar]', msg);
    return send(res, /deve começar|inválid/.test(msg) ? 400 : 500, { error: safe });
  }
};
