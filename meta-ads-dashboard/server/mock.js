// Dados de demonstração (usados sem credenciais ou se a API falhar)
const C = [
  { id: '1001', name: '[Fadiga Mental] Captação Pais', k: 1 },
  { id: '1002', name: '[Congresso] Liderança Parental', k: 1.4 },
  { id: '1003', name: '[Pós] Neurociência no Esporte', k: 0.8 },
];
const A = [['a1', 'Interesses - Pais de atletas'], ['a2', 'Lookalike 1%'], ['a3', 'Remarketing 30d']];
const rnd = (s) => { const x = Math.sin(s) * 10000; return x - Math.floor(x); };
const day = (d) => d.toISOString().slice(0, 10);

export function mockRows(since, until) {
  const rows = [];
  for (let d = new Date(since + 'T00:00'); d <= new Date(until + 'T00:00'); d.setDate(d.getDate() + 1)) {
    C.forEach((c, ci) => A.forEach(([aid, an], ai) => {
      const seed = d.getTime() / 864e5 + ci * 7 + ai * 3;
      const spend = +((40 + rnd(seed) * 60) * c.k * (1 + ai * 0.2)).toFixed(2);
      const clicks = Math.round(spend * (3 + rnd(seed + 1) * 3));
      rows.push({
        date: day(d), campaign_id: c.id, campaign_name: c.name,
        adset_id: `${c.id}-${aid}`, adset_name: an, spend,
        impressions: clicks * 40, clicks,
        conversions: Math.round(spend / (6 + rnd(seed + 2) * 8)),
        revenue: Math.round(spend * (1.5 + rnd(seed + 3) * 3)),
      });
    }));
  }
  return rows;
}

export function mockLeads(rows) {
  const out = [];
  for (const r of rows) {
    const n = Math.round(r.conversions * 0.8);
    for (let i = 0; i < n; i++) out.push({ utm_campaign: r.campaign_id, utm_term: r.adset_id, date: r.date });
  }
  return out;
}
