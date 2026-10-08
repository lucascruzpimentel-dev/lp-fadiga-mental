import { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';

const brl = (n) => (n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const int = (n) => (n ?? 0).toLocaleString('pt-BR');
const iso = (d) => d.toISOString().slice(0, 10);
const shortDate = (s) => s.slice(8) + '/' + s.slice(5, 7);
const PRESETS = [7, 14, 30];
const TONES = { good: 'border-emerald-300 bg-emerald-50', bad: 'border-red-300 bg-red-50', warn: 'border-amber-300 bg-amber-50', info: 'border-slate-200 bg-white' };

function roasClass(r) {
  if (r >= 3) return 'bg-emerald-100 text-emerald-800';
  if (r >= 1) return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-800';
}

function Kpi({ label, value, hint }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function Table({ rows, onSelect, selectedId, nameLabel }) {
  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
          <tr>
            {[nameLabel, 'Investimento', 'Cliques', 'CTR', 'Conversões Meta', 'Leads (formulário)', 'Custo/lead', 'ROAS'].map((h, i) => (
              <th key={h} className={`px-3 py-2 ${i ? 'text-right' : ''}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} onClick={() => onSelect?.(r.id)}
              className={`border-t border-slate-100 ${onSelect ? 'cursor-pointer hover:bg-slate-50' : ''} ${selectedId === r.id ? 'bg-blue-50' : ''}`}>
              <td className="px-3 py-2 font-medium">{r.name}</td>
              <td className="px-3 py-2 text-right">{brl(r.spend)}</td>
              <td className="px-3 py-2 text-right">{int(r.clicks)}</td>
              <td className="px-3 py-2 text-right">{r.ctr}%</td>
              <td className="px-3 py-2 text-right">{int(r.conversions)}</td>
              <td className="px-3 py-2 text-right font-semibold">{int(r.leads)}</td>
              <td className="px-3 py-2 text-right">{brl(r.cpl)}</td>
              <td className="px-3 py-2 text-right"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${roasClass(r.roas)}`}>{r.roas}x</span></td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan="8" className="px-3 py-6 text-center text-slate-400">Sem dados no período.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export default function MetaAds() {
  const [days, setDays] = useState(30);
  const [custom, setCustom] = useState({ since: '', until: '' });
  const [campaign, setCampaign] = useState('');
  const [adset, setAdset] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const range = useMemo(() => {
    if (days === 'custom' && custom.since && custom.until) return custom;
    const n = days === 'custom' ? 30 : days;
    return { since: iso(new Date(Date.now() - (n - 1) * 864e5)), until: iso(new Date()) };
  }, [days, custom]);

  useEffect(() => {
    const p = new URLSearchParams({ ...range, campaign, adset });
    setLoading(true);
    fetch(`/api/report?${p}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Erro ${r.status}`))))
      .then((d) => { setData(d); setError(''); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [range, campaign, adset]);

  const pickCampaign = (id) => { setCampaign(id === campaign ? '' : id); setAdset(''); };
  const k = data?.kpis;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Relatório de Anúncios</h1>
          <p className="text-sm text-slate-500">Meta Ads + leads do formulário (HighLevel)</p>
        </div>
        {data?.source === 'mock' && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Dados de demonstração</span>}
      </header>

      <section className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
        {PRESETS.map((n) => (
          <button key={n} onClick={() => setDays(n)}
            className={`rounded-lg px-3 py-1.5 text-sm ${days === n ? 'bg-blue-600 text-white' : 'bg-slate-100 hover:bg-slate-200'}`}>{n} dias</button>
        ))}
        <button onClick={() => setDays('custom')}
          className={`rounded-lg px-3 py-1.5 text-sm ${days === 'custom' ? 'bg-blue-600 text-white' : 'bg-slate-100 hover:bg-slate-200'}`}>Personalizado</button>
        {days === 'custom' && (
          <>
            <input type="date" value={custom.since} onChange={(e) => setCustom({ ...custom, since: e.target.value })} className="rounded-lg border px-2 py-1 text-sm" />
            <span className="text-slate-400">até</span>
            <input type="date" value={custom.until} onChange={(e) => setCustom({ ...custom, until: e.target.value })} className="rounded-lg border px-2 py-1 text-sm" />
          </>
        )}
        <div className="ml-auto flex flex-wrap gap-2 text-sm">
          {campaign && <button onClick={() => pickCampaign(campaign)} className="rounded-lg bg-blue-50 px-3 py-1.5 text-blue-700">Campanha ✕</button>}
          {adset && <button onClick={() => setAdset('')} className="rounded-lg bg-blue-50 px-3 py-1.5 text-blue-700">Conjunto ✕</button>}
        </div>
      </section>

      {data?.warnings?.map((w) => <p key={w} className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{w}</p>)}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className={loading ? 'opacity-50 transition' : 'transition'}>
        {k && (
          <>
            <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
              <Kpi label="Investimento" value={brl(k.spend)} />
              <Kpi label="Cliques" value={int(k.clicks)} hint={`CTR ${k.ctr}%`} />
              <Kpi label="Conversões Meta" value={int(k.conversions)} />
              <Kpi label="Leads (formulário)" value={int(k.leads)} />
              <Kpi label="Custo por lead" value={brl(k.cpl)} />
              <Kpi label="ROAS" value={`${k.roas}x`} hint="Retorno sobre investimento" />
            </section>

            <section className="mt-6 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <h2 className="mb-2 font-semibold">Investimento × resultados por dia</h2>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={data.daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tickFormatter={shortDate} fontSize={12} />
                  <YAxis yAxisId="l" fontSize={12} tickFormatter={(v) => `R$${v}`} />
                  <YAxis yAxisId="r" orientation="right" fontSize={12} />
                  <Tooltip labelFormatter={shortDate} formatter={(v, n) => (n === 'Investimento' ? brl(v) : v)} />
                  <Legend />
                  <Bar yAxisId="l" dataKey="spend" name="Investimento" fill="#93c5fd" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="r" dataKey="conversions" name="Conversões Meta" stroke="#2563eb" strokeWidth={2} dot={false} />
                  <Line yAxisId="r" dataKey="leads" name="Leads (formulário)" stroke="#16a34a" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </section>

            <section className="mt-6 space-y-2">
              <h2 className="font-semibold">Campanhas <span className="text-sm font-normal text-slate-400">— clique para ver os conjuntos</span></h2>
              <Table rows={data.campaigns} onSelect={pickCampaign} selectedId={campaign} nameLabel="Campanha" />
            </section>

            {campaign && (
              <section className="mt-6 space-y-2">
                <h2 className="font-semibold">Conjuntos de anúncios <span className="text-sm font-normal text-slate-400">— clique para afunilar</span></h2>
                <Table rows={data.adsets} onSelect={(id) => setAdset(id === adset ? '' : id)} selectedId={adset} nameLabel="Conjunto" />
              </section>
            )}

            <section className="mt-6 space-y-2">
              <h2 className="font-semibold">Sugestões</h2>
              <div className="grid gap-2 md:grid-cols-2">
                {data.suggestions.map((s) => <p key={s.text} className={`rounded-lg border px-3 py-2 text-sm ${TONES[s.tone]}`}>{s.text}</p>)}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
