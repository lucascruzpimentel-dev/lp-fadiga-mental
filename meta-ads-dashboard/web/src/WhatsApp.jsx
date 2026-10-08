import { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';

const int = (n) => (n ?? 0).toLocaleString('pt-BR');
const money = (n, cur = 'BRL') => (n == null ? '—' : n.toLocaleString(cur === 'BRL' ? 'pt-BR' : 'en-US', { style: 'currency', currency: cur }));
const iso = (d) => d.toISOString().slice(0, 10);
const shortDate = (s) => s.slice(8, 10) + '/' + s.slice(5, 7);
const PRESETS = [7, 14, 30];
const TONES = { good: 'border-emerald-300 bg-emerald-50', bad: 'border-red-300 bg-red-50', warn: 'border-amber-300 bg-amber-50', info: 'border-slate-200 bg-white' };
const CAT = { suporte_acesso: 'Suporte / acesso', outro: 'Outros', evento: 'Evento', duvida_produto: 'Dúvida sobre produto', compra: 'Compra', pagamento_financeiro: 'Pagamento', reclamacao: 'Reclamação', cancelamento_reembolso: 'Cancelamento / reembolso' };
const catName = (k) => CAT[k] || (k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' '));

function Kpi({ label, value, hint, tone }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone || ''}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

const Section = ({ title, sub, children }) => (
  <section className="mt-6 space-y-2">
    <h2 className="font-semibold">{title} {sub && <span className="text-sm font-normal text-slate-400">— {sub}</span>}</h2>
    {children}
  </section>
);

export default function WhatsApp() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const range = useMemo(() => ({ since: iso(new Date(Date.now() - (days - 1) * 864e5)), until: iso(new Date()) }), [days]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/whatsapp?${new URLSearchParams(range)}`)
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error || `Erro ${r.status}`); return j; })
      .then((d) => { setData(d); setError(''); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [range]);

  const c = data?.custos, v = data?.visao;
  const brl = (n) => (c?.usd_brl && n != null ? ` ≈ ${(n * c.usd_brl).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : '');
  const custoRange = c?.has_price ? `${money(c.totais.custo_min, c.moeda)} – ${money(c.totais.custo_max, c.moeda)}` : '—';

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <header>
        <h1 className="text-2xl font-bold">Atendimento no WhatsApp</h1>
        <p className="text-sm text-slate-500">Custo de templates, visão do atendimento e avaliação dos vendedores</p>
      </header>

      <div className="flex flex-wrap gap-2 rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
        {PRESETS.map((n) => (
          <button key={n} onClick={() => setDays(n)}
            className={`rounded-lg px-3 py-1.5 text-sm ${days === n ? 'bg-blue-600 text-white' : 'bg-slate-100 hover:bg-slate-200'}`}>{n} dias</button>
        ))}
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {data?.warnings?.map((w) => <p key={w} className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{w}</p>)}

      <div className={loading ? 'opacity-50 transition' : 'transition'}>
        {data && (
          <>
            <Section title="Visão geral do atendimento">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
                <Kpi label="Conversas avaliadas" value={int(v.atendimentos)} />
                <Kpi label="Em atendimento" value={int(v.em_atendimento)} hint="não resolvidas" tone="text-amber-600" />
                <Kpi label="Resolvidas" value={int(v.resolvidos)} hint={`${v.pct_resolvidos}%`} tone="text-emerald-600" />
                <Kpi label="Cliente sem resposta" value={int(v.sem_resposta_cliente)} />
                <Kpi label="Oportunidades abertas" value={int(v.oportunidades_abertas)} hint="venda ainda não fechada" />
                <Kpi label="Nota média" value={v.nota_media ?? '—'} hint={`1ª resposta ${v.primeira_resposta_min ?? '—'} min`} />
              </div>
              <div className="mt-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <h3 className="mb-2 text-sm font-medium text-slate-600">Assuntos das conversas</h3>
                <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  {v.categorias.map((k) => (
                    <li key={k.nome} className="flex justify-between border-b border-slate-100 py-1"><span>{catName(k.nome)}</span><b>{int(k.n)}</b></li>
                  ))}
                </ul>
              </div>
            </Section>

            <Section title="Custo de mensagens (templates)" sub="mensagens fora da janela de 24h são cobradas">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Kpi label="Mensagens enviadas" value={int(c.totais.enviadas)} />
                <Kpi label="Dentro da janela 24h" value={int(c.totais.janela)} hint="sem custo de template" tone="text-emerald-600" />
                <Kpi label="Templates (pagos)" value={int(c.totais.templates)} hint={`${c.totais.pct_templates}% do total`} tone="text-amber-600" />
                <Kpi label="Custo estimado" value={custoRange} hint={`de utility (${money(c.precos.utility, c.moeda)}) a marketing (${money(c.precos.marketing, c.moeda)}) por msg${brl(c.totais.custo_max)}`} />
              </div>
              <div className="mt-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={c.diario}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="dia" tickFormatter={shortDate} fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip labelFormatter={shortDate} />
                    <Legend />
                    <Bar dataKey="janela" name="Dentro da janela" stackId="a" fill="#86efac" isAnimationActive={false} />
                    <Bar dataKey="templates" name="Templates (pagos)" stackId="a" fill="#fbbf24" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    {c.has_price && <Line dataKey="custo_max" name={`Custo máx. (${c.moeda})`} stroke="#dc2626" dot={false} />}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Section>

            <Section title="Avaliação dos vendedores" sub="baseada na análise de cada conversa">
              <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
                <table className="w-full min-w-[820px] text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr>{['Vendedor', 'Conversas', 'Nota', 'Resolvidas', '1ª resposta', 'Oport. abertas', 'Erros'].map((h, i) => <th key={h} className={`px-3 py-2 ${i ? 'text-right' : ''}`}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {data.vendedores.map((s) => (
                      <tr key={s.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-medium">{s.nome}</td>
                        <td className="px-3 py-2 text-right">{int(s.conversas)}</td>
                        <td className="px-3 py-2 text-right">{s.nota ?? '—'}</td>
                        <td className="px-3 py-2 text-right">{s.pct_resolvidos}%</td>
                        <td className="px-3 py-2 text-right">{s.primeira_resposta_min != null ? `${s.primeira_resposta_min} min` : '—'}</td>
                        <td className="px-3 py-2 text-right">{s.oportunidades_abertas}</td>
                        <td className="px-3 py-2 text-right">{s.erros}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section title="Como melhorar a abordagem" sub="sugestões a partir do histórico de conversas">
              <div className="grid gap-2 md:grid-cols-2">
                {data.sugestoes.map((s) => <p key={s.text} className={`rounded-lg border px-3 py-2 text-sm ${TONES[s.tone]}`}>{s.text}</p>)}
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                  <h3 className="mb-2 text-sm font-medium text-slate-600">Pontos de melhoria mais frequentes</h3>
                  <ul className="space-y-2 text-sm">
                    {data.temas.map((t) => (
                      <li key={t.tema}><b>{t.tema}</b> <span className="text-slate-400">({int(t.n)}×)</span><br /><span className="text-slate-600">{t.dica}</span></li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                  <h3 className="mb-2 text-sm font-medium text-slate-600">Por vendedor</h3>
                  <ul className="space-y-3 text-sm">
                    {data.vendedores.filter((s) => s.dicas.length).map((s) => (
                      <li key={s.id}><b>{s.nome}</b>
                        <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-600">{s.dicas.map((d) => <li key={d}>{d}</li>)}</ul>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Section>
          </>
        )}
      </div>
    </div>
  );
}
