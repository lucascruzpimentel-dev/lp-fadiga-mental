// Rastreia quais trechos do vídeo o espectador realmente assistiu e envia batimentos ao servidor.
// "Assistindo" = o vídeo está tocando na posição do ao vivo. O estado fica no localStorage por sessão,
// então recarregar a página não perde o que já foi assistido; o servidor também une os trechos.
import { lsGet, lsSet } from '/webinar-evergreen/assets/core.js';

const HEARTBEAT_MS = 15000;
const MAX_GAP = 2; // segundos entre ticks para considerar o mesmo trecho

function merge(list) {
  const sorted = list.map((p) => [p[0], p[1]]).sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const p of sorted) {
    const last = out[out.length - 1];
    if (last && p[0] <= last[1] + 1) last[1] = Math.max(last[1], p[1]);
    else out.push(p);
  }
  return out.slice(-300);
}

export function createTracker({ webinarId, viewer, duration, enabled }) {
  let startAt = null;
  let done = []; // trechos fechados
  let cur = null; // trecho em andamento [início, fim]
  let dirty = false;
  let lastSent = 0;
  const key = () => `evergreen:watch:${webinarId}:${startAt}`;
  const all = () => merge(cur ? [...done, cur] : done);

  function persist() {
    lsSet(key(), JSON.stringify(all()));
  }

  function send(beacon) {
    const intervals = all().map(([a, b]) => [Math.round(a * 10) / 10, Math.round(b * 10) / 10]);
    if (!enabled || startAt == null || !intervals.length) return;
    const payload = JSON.stringify({
      action: 'watch', id: webinarId, name: viewer.name, email: viewer.email, sig: viewer.sig,
      sessionStart: startAt, duration, intervals,
    });
    lastSent = Date.now();
    dirty = false;
    persist();
    try {
      if (beacon && navigator.sendBeacon) navigator.sendBeacon('/api/webinar', new Blob([payload], { type: 'application/json' }));
      else fetch('/api/webinar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(() => {});
    } catch (e) { /* a audiência nunca pode atrapalhar a transmissão */ }
  }

  return {
    /** Informa a sessão atual; ao mudar, envia o que havia e recomeça (retoma o que estiver salvo). */
    setSession(newStart) {
      if (newStart === startAt) return;
      if (startAt != null && dirty) send(false);
      startAt = newStart;
      done = []; cur = null; dirty = false;
      try { done = merge(JSON.parse(lsGet(key()) || '[]')); } catch (e) { done = []; }
    },
    /** Chamado a cada tick: `offset` em segundos do ao vivo e se o vídeo está realmente tocando. */
    tick(offset, playing) {
      if (!enabled || startAt == null) return;
      if (playing) {
        if (!cur) cur = [offset, offset];
        else if (offset - cur[1] <= MAX_GAP && offset >= cur[0]) cur[1] = offset;
        else { done.push(cur); cur = [offset, offset]; }
        dirty = true;
      } else if (cur) { done.push(cur); cur = null; }
      if (dirty && Date.now() - lastSent >= HEARTBEAT_MS) send(false);
    },
    flush(beacon) { if (dirty || cur) send(Boolean(beacon)); },
  };
}
