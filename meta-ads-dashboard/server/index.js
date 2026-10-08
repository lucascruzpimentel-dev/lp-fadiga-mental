import express from 'express';
import { safeFetch } from './safe.js';
import { requireAuth, login, logout, session } from './auth.js';
import { mockRows, mockLeads } from './mock.js';
import { whatsappReport } from './whatsapp.js';

const env = process.env;
// O dashboard NÃO chama a API do Meta: lê só o Supabase de ANÚNCIOS (META_*), onde um processo
// externo sincroniza meta_campaigns / meta_adsets / meta_adset_daily e onde ficam os leads.
// O projeto de WhatsApp (WA_*) é separado e é lido apenas em whatsapp.js.
const SB_URL = env.META_SUPABASE_URL;
const SB_KEY = env.META_SUPABASE_SERVICE_ROLE_KEY;

const iso = (d) => d.toISOString().slice(0, 10);
const num = (v) => Number(v) || 0;

async function sb(table, params = {}) {
  const out = [];
  const PAGE = 1000; // limite máximo do PostgREST por requisição
  for (let from = 0; ; from += PAGE) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) [].concat(v).forEach((x) => q.append(k, x));
    const r = await safeFetch(`${SB_URL}/rest/v1/${table}?${q}`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, Range: `${from}-${from + PAGE - 1}` },
    }, table);
    if (!r.ok) throw new Error(`${table}: HTTP ${r.status}`);
    const page = await r.json();
    out.push(...page);
    if (page.length < PAGE) break;
  }
  return out;
}

// Linhas diárias por conjunto (meta_adset_daily) + nomes (meta_campaigns / meta_adsets).
// Gasto, cliques, impressões e receita de meta_adset_daily e meta_campaign_daily são idênticos;
// as "conversões" diferem entre as duas tabelas, então usamos uma só fonte (adset) para tudo somar igual.
async function adRows(since, until, { campaign, adset }) {
  const f = { select: '*', date: [`gte.${since}`, `lte.${until}`], order: 'date.asc' };
  if (adset) f.adset_id = `eq.${adset}`;
  else if (campaign) f.campaign_id = `eq.${campaign}`;
  const [daily, camps, sets] = await Promise.all([
    sb('meta_adset_daily', f),
    sb('meta_campaigns', { select: 'id,name' }),
    sb('meta_adsets', { select: 'id,name' }),
  ]);
  const cName = new Map(camps.map((c) => [c.id, c.name]));
  const sName = new Map(sets.map((a) => [a.id, a.name]));
  return daily.map((r) => ({
    date: r.date, campaign_id: r.campaign_id, campaign_name: cName.get(r.campaign_id) || r.campaign_id,
    adset_id: r.adset_id, adset_name: sName.get(r.adset_id) || r.adset_id,
    spend: num(r.spend), impressions: num(r.impressions), clicks: num(r.clicks),
    conversions: num(r.conversions), revenue: num(r.revenue),
  }));
}

// Dias do período sem nenhuma linha sincronizada (só até a última data existente), agrupados em faixas.
function gaps(rows, since, until) {
  const have = new Set(rows.map((r) => r.date));
  if (!have.size) return [];
  const last = [...have].sort().at(-1);
  const out = [];
  let cur = null;
  for (let d = new Date(since + 'T00:00:00Z'); iso(d) <= (until < last ? until : last); d.setUTCDate(d.getUTCDate() + 1)) {
    const k = iso(d);
    if (have.has(k)) { cur = null; continue; }
    if (cur) cur[1] = k; else out.push((cur = [k, k]));
  }
  return out;
}
const br = (d) => d.slice(8, 10) + '/' + d.slice(5, 7);

async function supabaseLeads(since, until) {
  const out = [];
  const PAGE = 1000; // limite máximo do PostgREST por requisição
  for (let from = 0; ; from += PAGE) {
    const q = new URLSearchParams({
      select: 'utm_campaign,utm_term,utm_content,created_time',
      order: 'created_time.asc',
    });
    q.append('created_time', `gte.${since}T00:00:00`);
    q.append('created_time', `lte.${until}T23:59:59`);
    const r = await safeFetch(`${SB_URL}/rest/v1/leads?${q}`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, Range: `${from}-${from + PAGE - 1}` },
    }, 'leads');
    if (!r.ok) throw new Error(`leads: HTTP ${r.status}`);
    const page = await r.json();
    out.push(...page);
    if (page.length < PAGE) break;
  }
  return out.map((l) => ({ ...l, date: (l.created_time || '').slice(0, 10) }));
}

const group = (rows, keyFn, init) => {
  const m = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    const g = m.get(k) || init(r);
    g.spend += r.spend; g.impressions += r.impressions; g.clicks += r.clicks;
    g.conversions += r.conversions; g.revenue += r.revenue;
    m.set(k, g);
  }
  return [...m.values()];
};
const finish = (g) => ({
  ...g, spend: +g.spend.toFixed(2),
  ctr: g.impressions ? +(g.clicks / g.impressions * 100).toFixed(2) : 0,
  cpl: g.leads ? +(g.spend / g.leads).toFixed(2) : null,
  roas: g.spend ? +(g.revenue / g.spend).toFixed(2) : 0,
});

function suggestions(camps) {
  const out = [];
  const withSpend = camps.filter((c) => c.spend > 50);
  const best = [...withSpend].filter((c) => c.cpl).sort((a, b) => a.cpl - b.cpl)[0];
  const worst = [...withSpend].filter((c) => c.cpl).sort((a, b) => b.cpl - a.cpl)[0];
  if (best) out.push({ tone: 'good', text: `"${best.name}" tem o menor custo por lead (R$ ${best.cpl}). Avalie aumentar o orçamento gradualmente (até 20% por vez).` });
  if (worst && worst !== best) out.push({ tone: 'bad', text: `"${worst.name}" está com o custo por lead mais alto (R$ ${worst.cpl}). Revise criativos e público ou reduza o investimento.` });
  const noLeads = withSpend.filter((c) => c.leads === 0);
  if (noLeads.length) out.push({ tone: 'warn', text: `${noLeads.length} campanha(s) gastaram sem gerar leads no formulário: ${noLeads.map((c) => c.name).join(', ')}. Verifique se as UTMs estão chegando.` });
  if (!out.length) out.push({ tone: 'info', text: 'Sem dados suficientes no período para sugerir ajustes.' });
  return out;
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '2kb' }));

// Mesma origem (frontend e API juntos): sem CORS. Tudo que devolve dados exige sessão.
app.post('/api/login', login);
app.post('/api/logout', logout);
app.get('/api/session', session);
app.use('/api/report', requireAuth);
app.use('/api/whatsapp', requireAuth);

app.get('/api/whatsapp', async (req, res) => {
  const until = req.query.until || iso(new Date());
  const since = req.query.since || iso(new Date(Date.now() - 6 * 864e5));
  try { res.json(await whatsappReport(since, until)); }
  catch (e) { res.status(502).json({ error: e.message }); }
});

app.get('/api/report', async (req, res) => {
  const until = req.query.until || iso(new Date());
  const since = req.query.since || iso(new Date(Date.now() - 29 * 864e5));
  const campaign = req.query.campaign || '';
  const adset = req.query.adset || '';
  const warnings = [];
  let source = 'live';

  let rows, leads;
  try {
    if (env.MOCK === '1' || !(SB_URL && SB_KEY)) throw new Error('mock');
    rows = await adRows(since, until, { campaign, adset });
    try { leads = await supabaseLeads(since, until); }
    catch (e) { warnings.push(`Leads do formulário indisponíveis (${e.message}).`); leads = []; }
    if (!campaign && !adset) {
      const g = gaps(rows, since, until);
      if (g.length) warnings.push(`Sem dados de anúncios sincronizados no Supabase em ${g.map(([a, b]) => (a === b ? br(a) : `${br(a)} a ${br(b)}`)).join(', ')}. Os números desses dias aparecem zerados até a sincronização ser refeita.`);
    }
  } catch (e) {
    // Demonstração só sem credenciais ou com MOCK=1. Com credenciais e falha, mostra o erro (nunca números inventados).
    if (e.message !== 'mock') return res.status(502).json({ error: `Supabase indisponível: ${e.message}` });
    source = 'mock';
    rows = mockRows(since, until).filter((r) => (!campaign || r.campaign_id === campaign) && (!adset || r.adset_id === adset));
    leads = mockLeads(rows);
  }
  const dataUntil = rows.map((r) => r.date).sort().at(-1) || null;

  // Match leads → campanha/conjunto. Na prática utm_campaign vem como ID OU como nome
  // (às vezes "nome da campanha + nome do conjunto") e utm_term como ID do conjunto OU texto.
  // Ordem: utm_term = ID de conjunto → utm_campaign = ID → nome exato → nome é prefixo (mais longo vence).
  const norm = (v) => (v || '').toString().trim().toLowerCase();
  const campById = new Map(), campByName = new Map(), setToCamp = new Map();
  for (const r of rows) {
    campById.set(r.campaign_id, r.campaign_id);
    campByName.set(norm(r.campaign_name), r.campaign_id);
    setToCamp.set(r.adset_id, r.campaign_id);
  }
  const names = [...campByName.keys()].filter(Boolean).sort((x, y) => y.length - x.length);
  const matchLead = (l) => {
    const term = (l.utm_term || '').toString().trim();
    if (setToCamp.has(term)) return { camp: setToCamp.get(term), set: term };
    const uc = (l.utm_campaign || '').toString().trim();
    if (campById.has(uc)) return { camp: uc };
    const n = norm(uc);
    if (campByName.has(n)) return { camp: campByName.get(n) };
    const pref = names.find((nm) => n.startsWith(nm));
    return pref ? { camp: campByName.get(pref) } : null;
  };
  const campLeads = {}, setLeads = {}, dayLeads = {};
  let unmatched = 0;
  for (const l of leads) {
    const m = matchLead(l);
    if (!m) { unmatched++; continue; }
    if (adset && m.set !== adset) continue;
    campLeads[m.camp] = (campLeads[m.camp] || 0) + 1;
    dayLeads[l.date] = (dayLeads[l.date] || 0) + 1;
    if (m.set) setLeads[m.set] = (setLeads[m.set] || 0) + 1;
  }
  if (!campaign && !adset && unmatched) warnings.push(`${unmatched} lead(s) do formulário não foram associados a nenhuma campanha com gasto no período.`);

  const zero = (r) => ({ spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0, ...r });
  const campaigns = group(rows, (r) => r.campaign_id, (r) => zero({ id: r.campaign_id, name: r.campaign_name }))
    .map((g) => finish({ ...g, leads: campLeads[g.id] || 0 })).sort((a, b) => b.spend - a.spend);
  const adsets = group(rows, (r) => r.adset_id, (r) => zero({ id: r.adset_id, name: r.adset_name, campaign_id: r.campaign_id, campaign_name: r.campaign_name }))
    .map((g) => finish({ ...g, leads: setLeads[g.id] || 0 })).sort((a, b) => b.spend - a.spend);

  const daily = group(rows, (r) => r.date, (r) => zero({ date: r.date }))
    .map((g) => ({ date: g.date, spend: +g.spend.toFixed(2), conversions: g.conversions, leads: dayLeads[g.date] || 0 }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const total = finish({
    ...zero({}), leads: Object.values(campLeads).reduce((s, n) => s + n, 0),
    ...campaigns.reduce((t, c) => ({
      spend: t.spend + c.spend, impressions: t.impressions + c.impressions, clicks: t.clicks + c.clicks,
      conversions: t.conversions + c.conversions, revenue: t.revenue + c.revenue,
    }), zero({})),
  });

  res.json({ source, since, until, data_until: dataUntil, warnings, kpis: total, daily, campaigns, adsets, suggestions: suggestions(campaigns) });
});

const port = env.PORT || 8787;
if (!env.VERCEL) app.listen(port, () => console.log(`API em http://localhost:${port}`));
export default app;
