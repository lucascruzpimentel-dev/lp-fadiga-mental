import { useEffect, useMemo, useState } from 'react';
import { getJson } from './api.js';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';

const int = (n) => (n ?? 0).toLocaleString('pt-BR');
const money = (n, cur = 'BRL') => (n == null ? '—' : n.toLocaleString(cur === 'BRL' ? 'pt-BR' : 'en-US', { style: 'currency', currency: cur }));
const iso = (d) => d.toISOString().slice(0, 10);
const shortDate = (s) => s.slice(8, 10) + '/' + s.slice(5, 7);
const PRESETS = [7, 14, 30];
const TONES = { good: 'border-emerald-300 bg-emerald-50', bad: 'border-red-300 bg-red-50', warn: 'border-amber-300 bg-amber-50', info: 'border-slate-200 bg-white' };
const CAT = { suporte_acesso: 'Suporte / acesso', outro: 'Outros', evento: 'Evento', duvida_produto: 'Dúvida sobre produto', compra: 'Compra', pagamento_financeiro: 'Pagamento', reclamacao: 'Reclamação', cancelamento_reembolso: 'Cancelamento / reembolso' };
const CATEG = { UTILITY: 'Utility', MARKETING: 'Marketing', AUTHENTICATION: 'Autenticação', SERVICE: 'Service (atendimento)' };
const TIPO = { REGULAR: 'cobrada', FREE_CUSTOMER_SERVICE: 'grátis · janela de atendimento', FREE_ENTRY_POINT: 'grátis · entrada por anúncio' };
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
    getJson(`/api/whatsapp?${new URLSearchParams(range)}`)
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

            {c.fonte === 'meta' ? (
              <Section title="Custo de mensagens" sub="volume real por categoria, informado pela Meta">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <Kpi label="Mensagens (Meta)" value={int(c.meta.totais.volume)} />
                  <Kpi label="Cobradas" value={int(c.meta.totais.cobradas)} tone="text-amber-600" />
                  <Kpi label="Gratuitas" value={int(c.meta.totais.gratis)} hint="atendimento dentro da janela" tone="text-emerald-600" />
                  <Kpi label="Custo" value={money(c.meta.totais.custo, c.moeda)} hint={`${brl(c.meta.totais.custo).replace(' ≈ ', '≈ ')}`.trim() || 'pelos preços da tabela da Meta'} />
                </div>
                <div className="mt-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                  <ResponsiveContainer width="100%" height={260}>
                    <ComposedChart data={c.meta.diario}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="dia" tickFormatter={shortDate} fontSize={12} />
                      <YAxis yAxisId="l" fontSize={12} />
                      <YAxis yAxisId="r" orientation="right" fontSize={12} tickFormatter={(v) => `R$${v}`} />
                      <Tooltip labelFormatter={shortDate} formatter={(v, n) => (n.startsWith('Custo') ? money(v, c.moeda) : v)} />
                      <Legend />
                      <Bar yAxisId="l" dataKey="gratis" name="Gratuitas" stackId="a" fill="#86efac" isAnimationActive={false} />
                      <Bar yAxisId="l" dataKey="utility" name="Utility" stackId="a" fill="#93c5fd" isAnimationActive={false} />
                      <Bar yAxisId="l" dataKey="service_cobrada" name="Service cobrada" stackId="a" fill="#fcd34d" isAnimationActive={false} />
                      <Bar yAxisId="l" dataKey="marketing" name="Marketing" stackId="a" fill="#f87171" isAnimationActive={false} />
                      <Line yAxisId="r" dataKey="custo" name={`Custo (${c.moeda})`} stroke="#334155" dot={false} isAnimationActive={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                      <tr>{['Categoria', 'Tipo', 'Mensagens', 'Preço por msg', 'Custo'].map((h, i) => <th key={h} className={`px-3 py-2 ${i > 1 ? 'text-right' : ''}`}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {c.meta.detalhe.map((t) => (
                        <tr key={`${t.categoria}${t.tipo}`} className="border-t border-slate-100">
                          <td className="px-3 py-2 font-medium">{CATEG[t.categoria] || t.categoria}</td>
                          <td className="px-3 py-2 text-slate-500">{TIPO[t.tipo] || t.tipo}</td>
                          <td className="px-3 py-2 text-right">{int(t.volume)}</td>
                          <td className="px-3 py-2 text-right">{t.cobrada ? money(t.preco, c.moeda) : '—'}</td>
                          <td className="px-3 py-2 text-right font-semibold">{t.cobrada ? money(t.custo, c.moeda) : 'grátis'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-500">
                  Custo = mensagens cobradas × preço da tabela da Meta para o Brasil. Mensagens "Service cobrada" usam o preço de Service da tabela; confira na fatura da Meta.
                </p>
              </Section>
            ) : (
            <Section title="Custo de mensagens (estimativa)" sub="a Meta ainda não está sincronizada; valor entre utility e marketing">
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
            )}

            {data.templates && (
              <Section title="Templates do WhatsApp" sub="lista sincronizada da Meta">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <Kpi label="Templates" value={int(data.templates.total)} />
                  <Kpi label="Aprovados" value={int(data.templates.por_status.APPROVED || 0)} tone="text-emerald-600" />
                  <Kpi label="Utility" value={int(data.templates.aprovados_por_categoria.UTILITY || 0)} hint="aprovados" />
                  <Kpi label="Marketing" value={int(data.templates.aprovados_por_categoria.MARKETING || 0)} hint="aprovados" />
                </div>
                <details className="mt-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                  <summary className="cursor-pointer text-sm font-medium text-slate-600">Ver os {int(data.templates.aprovados.length)} templates aprovados</summary>
                  <ul className="mt-3 max-h-80 divide-y divide-slate-100 overflow-y-auto text-sm">
                    {data.templates.aprovados.map((t) => (
                      <li key={`${t.nome}${t.idioma}`} className="flex items-center justify-between gap-3 py-1.5">
                        <span className="break-all">{t.nome}</span>
                        <span className="flex shrink-0 gap-2 text-xs">
                          <span className={`rounded-full px-2 py-0.5 ${t.categoria === 'MARKETING' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>{CATEG[t.categoria] || t.categoria}</span>
                          <span className="text-slate-400">{t.idioma}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              </Section>
            )}

            <Section title="Avaliação dos vendedores" sub="baseada na análise de cada conversa">
              <p className={`rounded-lg px-3 py-2 text-sm ${data.cobertura.whatsapp.pct < 50 ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
                Cobertura da avaliação: <b>{data.cobertura.whatsapp.analisadas.toLocaleString('pt-BR')} de {data.cobertura.whatsapp.conversas.toLocaleString('pt-BR')}</b> conversas de WhatsApp ({data.cobertura.whatsapp.pct}%)
                e <b>{data.cobertura.instagram.analisadas.toLocaleString('pt-BR')} de {data.cobertura.instagram.conversas.toLocaleString('pt-BR')}</b> de Instagram ({data.cobertura.instagram.pct}%).
                {data.cobertura.whatsapp.pct < 50 && ' As notas e percentuais abaixo valem só para as conversas analisadas, não para todo o atendimento.'}
              </p>
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

            <Section title="Mensagens por vendedor" sub="contagem direta das mensagens enviadas, sem depender da análise">
              <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr>{['Vendedor', 'Enviadas', 'Manuais', 'Automáticas', 'WhatsApp', 'Instagram', 'Conversas'].map((h, i) => <th key={h} className={`px-3 py-2 ${i ? 'text-right' : ''}`}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {data.mensagens_por_vendedor.map((m) => (
                      <tr key={m.id} className="border-t border-slate-100">
                        <td className={`px-3 py-2 font-medium ${m.id === '_sem' ? 'text-slate-500' : ''}`}>{m.nome}</td>
                        <td className="px-3 py-2 text-right font-semibold">{int(m.total)}</td>
                        <td className="px-3 py-2 text-right">{int(m.manuais)}</td>
                        <td className="px-3 py-2 text-right">{int(m.automaticas)}</td>
                        <td className="px-3 py-2 text-right">{int(m.whatsapp)}</td>
                        <td className="px-3 py-2 text-right">{int(m.instagram)}</td>
                        <td className="px-3 py-2 text-right">{int(m.conversas)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-500">
                <b>Manuais</b> são mensagens escritas por uma pessoa; <b>automáticas</b> saem de fluxos e ficam no usuário que criou o fluxo.
                A linha "Sem usuário registrado" reúne mensagens sem responsável identificado (por exemplo, enviadas direto pelo aplicativo do Instagram ou do celular).
              </p>
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
