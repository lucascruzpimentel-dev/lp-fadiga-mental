// Audiência: trechos assistidos (intervalos em segundos do vídeo), união, percentuais e resumos.

const MAX_INTERVALS = 400;

/** Une intervalos [a,b] (segundos), limitados a [0, max]. */
function mergeIntervals(list, max) {
  const clean = [];
  for (const p of Array.isArray(list) ? list : []) {
    if (!Array.isArray(p)) continue;
    let a = Number(p[0]);
    let b = Number(p[1]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    a = Math.max(0, a);
    b = Math.min(max, b);
    if (b > a) clean.push([a, b]);
  }
  clean.sort((x, y) => x[0] - y[0]);
  const out = [];
  for (const p of clean) {
    const last = out[out.length - 1];
    if (last && p[0] <= last[1] + 1) last[1] = Math.max(last[1], p[1]); // lacunas de até 1 s contam como contínuas
    else out.push([p[0], p[1]]);
  }
  return out.slice(0, MAX_INTERVALS).map(([a, b]) => [Math.round(a * 10) / 10, Math.round(b * 10) / 10]);
}

const totalSeconds = (iv) => iv.reduce((n, [a, b]) => n + (b - a), 0);

const pctOf = (seconds, duration) => (duration > 0 ? Math.min(100, Math.round((100 * seconds) / duration)) : 0);

/** Melhor sessão por e-mail: Map<email, {pct, seconds, firstOffset, maxOffset, sessionStart, lastSeen, sessions}> */
function bestByEmail(rows) {
  const map = new Map();
  for (const r of rows) {
    const cur = map.get(r.email);
    const seconds = Number(r.seconds_watched) || 0;
    if (!cur) map.set(r.email, { seconds, duration: r.duration, firstOffset: r.first_offset, maxOffset: r.max_offset, sessionStart: r.session_start, lastSeen: r.last_seen, sessions: 1 });
    else {
      cur.sessions += 1;
      if (r.last_seen > cur.lastSeen) cur.lastSeen = r.last_seen;
      if (seconds > cur.seconds) Object.assign(cur, { seconds, duration: r.duration, firstOffset: r.first_offset, maxOffset: r.max_offset, sessionStart: r.session_start });
    }
  }
  for (const v of map.values()) v.pct = pctOf(v.seconds, v.duration);
  return map;
}

/** Resumo por webinar: quem assistiu ao menos 1 min, média, >=50% e >=90%. */
function summarize(rows) {
  const byWebinar = {};
  for (const [id, group] of Object.entries(rows.reduce((g, r) => ((g[r.webinar_id] = g[r.webinar_id] || []).push(r), g), {}))) {
    const people = [...bestByEmail(group).values()].filter((p) => p.seconds >= 60);
    byWebinar[id] = {
      viewers: people.length,
      avg: people.length ? Math.round(people.reduce((n, p) => n + p.pct, 0) / people.length) : 0,
      ge50: people.filter((p) => p.pct >= 50).length,
      ge90: people.filter((p) => p.pct >= 90).length,
    };
  }
  return byWebinar;
}

module.exports = { mergeIntervals, totalSeconds, pctOf, bestByEmail, summarize, MAX_INTERVALS };
