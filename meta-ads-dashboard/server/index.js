import express from 'express';
import cors from 'cors';
import { mockRows, mockLeads } from './mock.js';

const env = process.env;
const META_TOKEN = env.META_ACCESS_TOKEN;
const ACCOUNT = env.META_AD_ACCOUNT_ID;
// Projeto Supabase de ANÚNCIOS/leads (META_*). O projeto de WhatsApp (WA_*) é separado e não é usado aqui.
const SB_URL = env.META_SUPABASE_URL;
const SB_KEY = env.META_SUPABASE_SERVICE_ROLE_KEY;
const GRAPH = 'https://graph.facebook.com/v21.0';
const LEAD_TYPES = ['lead', 'offsite_conversion.fb_pixel_lead', 'onsite_conversion.lead_grouped'];

const iso = (d) => d.toISOString().slice(0, 10);
const num = (v) => Number(v) || 0;

async function graph(path, params) {
  const url = new URL(`${GRAPH}/${path}`);
  Object.entries({ ...params, access_token: META_TOKEN }).forEach(([k, v]) => url.searchParams.set(k, v));
  const rows = [];
  let next = url.toString();
  while (next) {
    const r = await fetch(next);
    const j = await r.json();
    if (j.error) throw new Error(`Meta: ${j.error.message}`);
    rows.push(...(j.data || []));
    next = j.paging?.next;
  }
  return rows;
}

async function metaRows(since, until, { campaign, adset }) {
  const filtering = [];
  if (campaign) filtering.push({ field: 'campaign.id', operator: 'EQUAL', value: campaign });
  if (adset) filtering.push({ field: 'adset.id', operator: 'EQUAL', value: adset });
  const data = await graph(`${ACCOUNT}/insights`, {
    level: 'adset', time_increment: 1, limit: 500,
    time_range: JSON.stringify({ since, until }),
    fields: 'campaign_id,campaign_name,adset_id,adset_name,spend,impressions,clicks,actions,action_values',
    ...(filtering.length && { filtering: JSON.stringify(filtering) }),
  });
  const sum = (arr, types) => (arr || []).filter((a) => types.includes(a.action_type)).reduce((s, a) => s + num(a.value), 0);
  return data.map((r) => ({
    date: r.date_start, campaign_id: r.campaign_id, campaign_name: r.campaign_name,
    adset_id: r.adset_id, adset_name: r.adset_name,
    spend: num(r.spend), impressions: num(r.impressions), clicks: num(r.clicks),
    conversions: sum(r.actions, LEAD_TYPES),
    revenue: sum(r.action_values, ['purchase', 'offsite_conversion.fb_pixel_purchase']),
  }));
}

async function supabaseLeads(since, until) {
  const q = new URLSearchParams({
    select: 'utm_campaign,utm_term,utm_content,created_time',
    created_time: `gte.${since}T00:00:00`, limit: '10000',
  });
  q.append('created_time', `lte.${until}T23:59:59`);
  const r = await fetch(`${SB_URL}/rest/v1/leads?${q}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}`);
  return (await r.json()).map((l) => ({ ...l, date: (l.created_time || '').slice(0, 10) }));
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
app.use(cors());

app.get('/api/health', (_q, res) => res.json({ meta: !!META_TOKEN && !!ACCOUNT, supabase: !!SB_URL && !!SB_KEY }));

app.get('/api/report', async (req, res) => {
  const until = req.query.until || iso(new Date());
  const since = req.query.since || iso(new Date(Date.now() - 29 * 864e5));
  const campaign = req.query.campaign || '';
  const adset = req.query.adset || '';
  const warnings = [];
  let source = 'live';

  let rows;
  try {
    if (env.MOCK === '1' || !META_TOKEN || !ACCOUNT) throw new Error('mock');
    rows = await metaRows(since, until, { campaign, adset });
  } catch (e) {
    if (e.message !== 'mock') warnings.push(`Meta Ads indisponível (${e.message}); mostrando dados de demonstração.`);
    source = 'mock';
    rows = mockRows(since, until).filter((r) => (!campaign || r.campaign_id === campaign) && (!adset || r.adset_id === adset));
  }

  let leads;
  try {
    if (source === 'mock' && !(SB_URL && SB_KEY)) leads = mockLeads(rows);
    else if (!(SB_URL && SB_KEY)) throw new Error('credenciais ausentes');
    else leads = await supabaseLeads(since, until);
  } catch (e) {
    warnings.push(`Leads do formulário indisponíveis (${e.message}).`);
    leads = source === 'mock' ? mockLeads(rows) : [];
  }

  // Match leads → campanha/conjunto: ID exato (utm_campaign / utm_term); fallback por nome.
  const byName = new Map(rows.map((r) => [r.campaign_name?.toLowerCase(), r.campaign_id]));
  const cKey = (l) => (l.utm_campaign && (byName.get(l.utm_campaign.toLowerCase()) || l.utm_campaign)) || '';
  const campLeads = {}, setLeads = {}, dayLeads = {};
  const ids = new Set(rows.map((r) => r.campaign_id)), setIds = new Set(rows.map((r) => r.adset_id));
  for (const l of leads) {
    const c = cKey(l);
    if (!ids.has(c)) continue;
    if (adset && l.utm_term !== adset) continue;
    campLeads[c] = (campLeads[c] || 0) + 1;
    dayLeads[l.date] = (dayLeads[l.date] || 0) + 1;
    if (l.utm_term && setIds.has(l.utm_term)) setLeads[l.utm_term] = (setLeads[l.utm_term] || 0) + 1;
  }

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

  res.json({ source, since, until, warnings, kpis: total, daily, campaigns, adsets, suggestions: suggestions(campaigns) });
});

const port = env.PORT || 8787;
if (!env.VERCEL) app.listen(port, () => console.log(`API em http://localhost:${port}`));
export default app;
