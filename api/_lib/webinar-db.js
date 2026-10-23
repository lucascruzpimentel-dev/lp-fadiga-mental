// Acesso ao Supabase (PostgREST) só pelo servidor, com a service_role key.
function config() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error('SUPABASE_URL is not configured');
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  return { url: url.replace(/\/$/, ''), key };
}

async function rest(path, { method = 'GET', body, prefer } = {}) {
  const { url, key } = config();
  const res = await fetch(url + '/rest/v1/' + path, {
    method,
    headers: Object.assign(
      { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      prefer ? { Prefer: prefer } : {}
    ),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error('Supabase ' + method + ' ' + path.split('?')[0] + ' failed [' + res.status + ']: ' + t.slice(0, 200));
  }
  if (res.status === 204) return undefined;
  const text = await res.text();
  return text ? JSON.parse(text) : undefined;
}

const enc = encodeURIComponent;

async function listWebinars() {
  const rows = await rest('webinars?select=id,data&order=updated_at.desc');
  return rows.map((r) => Object.assign({}, r.data, { id: r.id }));
}

async function getWebinar(id) {
  const rows = await rest('webinars?select=id,data&id=eq.' + enc(id) + '&limit=1');
  return rows[0] ? Object.assign({}, rows[0].data, { id: rows[0].id }) : null;
}

async function upsertWebinar(w) {
  await rest('webinars?on_conflict=id', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: { id: w.id, data: w, updated_at: new Date().toISOString() },
  });
}

async function removeWebinar(id) {
  await rest('webinars?id=eq.' + enc(id), { method: 'DELETE', prefer: 'return=minimal' });
}

async function insertLead(webinarId, name, email) {
  await rest('leads', { method: 'POST', prefer: 'return=minimal', body: { webinar_id: webinarId, name, email } });
}

async function listLeads(webinarId) {
  const rows = await rest(
    'leads?select=name,email,created_at&webinar_id=eq.' + enc(webinarId) + '&order=created_at.desc&limit=10000'
  );
  return rows.map((r) => ({ name: r.name, email: r.email, at: Date.parse(r.created_at) }));
}

async function leadCounts() {
  const rows = await rest('leads?select=webinar_id&limit=100000');
  const out = {};
  for (const r of rows) out[r.webinar_id] = (out[r.webinar_id] || 0) + 1;
  return out;
}

async function getWatch(webinarId, email, sessionStartIso) {
  const rows = await rest(
    'watch_sessions?select=intervals,first_seen&webinar_id=eq.' + enc(webinarId) + '&email=eq.' + enc(email) +
      '&session_start=eq.' + enc(sessionStartIso) + '&limit=1'
  );
  return rows[0] || null;
}

async function upsertWatch(row) {
  await rest('watch_sessions?on_conflict=webinar_id,email,session_start', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: row,
  });
}

async function listWatch(webinarId) {
  return rest(
    'watch_sessions?select=email,seconds_watched,duration,first_offset,max_offset,session_start,last_seen&webinar_id=eq.' +
      enc(webinarId) + '&limit=20000'
  );
}

async function listAllWatch() {
  return rest('watch_sessions?select=webinar_id,email,seconds_watched,duration,first_offset,max_offset,session_start,last_seen&limit=200000');
}

module.exports = {
  getWatch, upsertWatch, listWatch, listAllWatch, listWebinars, getWebinar, upsertWebinar, removeWebinar, insertLead, listLeads, leadCounts };
