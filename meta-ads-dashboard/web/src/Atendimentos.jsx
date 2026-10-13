import { useEffect, useMemo, useState } from 'react';
import { getJson } from './api.js';
import { CAT, ALERTA, notaClass, Evidencias } from './shared.jsx';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';

const iso = (d) => d.toISOString().slice(0, 10);
const hojeBrt = () => iso(new Date(Date.now() - 3 * 3600e3));
const addDias = (d, n) => iso(new Date(new Date(d + 'T12:00:00Z').getTime() + n * 864e5));
const br = (d) => d.slice(8) + '/' + d.slice(5, 7);
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const nomeDia = (d) => `${SEMANA[new Date(d + 'T12:00:00Z').getUTCDay()]} ${br(d)}`;
const TONES = { good: 'border-emerald-300 bg-emerald-50', bad: 'border-red-300 bg-red-50', warn: 'border-amber-300 bg-amber-50', info: 'border-slate-200 bg-white' };
const FILTROS = [
  ['todos', 'Todos', () => true],
  ['oport', 'Oportunidades abertas', (c) => c.oportunidade && !c.resolvido],
  ['aberto', 'Não resolvidos', (c) => !c.resolvido],
  ['alerta', 'Com alerta', (c) => !!c.alerta],
  ['baixa', 'Nota baixa (≤ 5)', (c) => c.nota != null && c.nota <= 5],
];

// Seta de variação contra a semana anterior. "melhor" diz se subir é bom (true) ou ruim (false).
function Delta({ atual, anterior, melhor = true, sufixo = '' }) {
  if (atual == null || anterior == null || anterior === 0) return null;
  const d = +(atual - anterior).toFixed(1);
  if (!d) return <span className="text-xs text-slate-400">= semana anterior</span>;
  const bom = (d > 0) === melhor;
  return <span className={`text-xs font-medium ${bom ? 'text-emerald-600' : 'text-red-600'}`}>{d > 0 ? '▲' : '▼'} {Math.abs(d)}{sufixo} vs semana anterior</span>;
}

function Kpi({ label, value, children, tone }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone || ''}`}>{value}</p>
      <div className="mt-1 min-h-4">{children}</div>
    </div>
  );
}

function Chip({ ativo, onClick, children }) {
  return <button onClick={onClick} className={`rounded-full px-3 py-1 text-sm ${ativo ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{children}</button>;
}

function Conversa({ id }) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState('');
  useEffect(() => {
    setD(null); setErro('');
    getJson(`/api/atendimentos/conversa?${new URLSearchParams({ id })}`).then(setD).catch((e) => setErro(e.message));
  }, [id]);
  if (erro) return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>;
  if (!d) return <p className="text-sm text-slate-400">Carregando conversa…</p>;
  if (!d.texto_disponivel) return <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">O texto das mensagens não está gravado no banco. Use o resumo acima.</p>;
  return (
    <div className="space-y-2">
      {d.mensagens.map((m, i) => (
        <div key={i} className={`flex ${m.de === 'cliente' ? 'justify-start' : 'justify-end'}`}>
          <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${m.de === 'cliente' ? 'bg-slate-100' : m.de === 'automação' ? 'bg-violet-100' : 'bg-blue-100'}`}>
            <p className="text-xs text-slate-500">{m.quem} · {m.quando}</p>
            <p className="whitespace-pre-wrap">{m.texto || <em className="text-slate-400">(mídia ou mensagem sem texto)</em>}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function Lista({ titulo, itens, cor }) {
  if (!itens?.length) return null;
  return (
    <div>
      <p className={`text-xs font-semibold uppercase ${cor}`}>{titulo}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">{itens.map((t) => <li key={t}>{t}</li>)}</ul>
    </div>
  );
}

function Detalhe({ c, onClose }) {
  const [ver, setVer] = useState(false);
  useEffect(() => setVer(false), [c.id]);
  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-slate-900/40" onClick={onClose}>
      <aside className="h-full w-full max-w-lg space-y-4 overflow-y-auto bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{c.contato}</h2>
            {c.telefone && <p className="text-sm text-slate-600">{c.telefone}</p>}
            <p className="text-sm text-slate-500">{c.hora} · {CAT[c.categoria] || c.categoria} · {c.vendedores.join(', ') || 'sem atendente humano'}</p>
          </div>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100" aria-label="Fechar">✕</button>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <span className={`rounded-full px-2 py-0.5 font-semibold ${notaClass(c.nota)}`}>Nota {c.nota ?? '—'}</span>
          <span className={`rounded-full px-2 py-0.5 font-semibold ${c.resolvido ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{c.resolvido ? 'Resolvido' : 'Em aberto'}</span>
          {c.oportunidade && <span className="rounded-full bg-blue-100 px-2 py-0.5 font-semibold text-blue-800">Oportunidade de venda</span>}
          {c.alerta && <span className="rounded-full bg-red-100 px-2 py-0.5 font-semibold text-red-800">{ALERTA[c.alerta] || c.alerta}</span>}
          {c.primeira_resposta_min != null && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">1ª resposta {c.primeira_resposta_min} min</span>}
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{c.mensagens} mensagens</span>
        </div>

        <div><p className="text-xs font-semibold uppercase text-slate-500">Resumo</p><p className="mt-1 text-sm">{c.resumo}</p></div>
        <div><p className="text-xs font-semibold uppercase text-slate-500">Motivo do contato</p><p className="mt-1 text-sm">{c.motivo || '—'}</p></div>
        {c.proxima_acao && <div className="rounded-lg border border-blue-200 bg-blue-50 p-3"><p className="text-xs font-semibold uppercase text-blue-700">Próxima ação</p><p className="mt-1 text-sm">{c.proxima_acao}</p></div>}
        {(c.evidencias.length > 0 || c.melhorias.length > 0) && <div><p className="mb-1 text-xs font-semibold uppercase text-red-700">Onde errou e como melhorar</p><Evidencias itens={c.evidencias} /></div>}
        <Lista titulo="Pontos fortes" itens={c.fortes} cor="text-emerald-700" />
        <Lista titulo="Pontos de melhoria" itens={c.melhorias} cor="text-amber-700" />

        <div className="border-t pt-4">
          {ver ? <Conversa id={c.id} /> : <button onClick={() => setVer(true)} className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm hover:bg-slate-200">Ver a conversa completa</button>}
        </div>
      </aside>
    </div>
  );
}

export default function Atendimentos() {
  const [dia, setDia] = useState(hojeBrt());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [aberto, setAberto] = useState(null);
  const [cob, setCob] = useState(null); // cobertura: quantos clientes escreveram de verdade, contado nas mensagens

  useEffect(() => {
    setCob(null);
    getJson(`/api/dia?${new URLSearchParams({ dia })}`).then((d) => setCob(d?.canais?.whatsapp || null)).catch(() => {});
    setLoading(true);
    getJson(`/api/atendimentos?${new URLSearchParams({ dia })}`)
      .then((d) => { setData(d); setErro(''); })
      .catch((e) => setErro(e.message))
      .finally(() => setLoading(false));
  }, [dia]);

  const f = FILTROS.find(([k]) => k === filtro)[2];
  const casos = useMemo(() => (data?.casos || []).filter(f), [data, filtro]);
  const k = data?.kpis_dia, s = data?.semana;
  const hoje = hojeBrt();

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Casos analisados pela IA · WhatsApp</h1>
          <p className="text-sm text-slate-500">Resumo, nota e próxima ação de cada conversa. A IA analisa uma conversa 2 h depois que ela para, então o dia de hoje só fecha amanhã. Para o movimento real do dia, use a visão "Dia".</p>
        </div>
        {data?.mock && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Dados de demonstração</span>}
      </header>

      <section className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
        <button onClick={() => setDia(addDias(dia, -1))} className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm hover:bg-slate-200" aria-label="Dia anterior">←</button>
        <input type="date" value={dia} max={hoje} onChange={(e) => e.target.value && setDia(e.target.value)} className="rounded-lg border px-2 py-1 text-sm" />
        <button onClick={() => dia < hoje && setDia(addDias(dia, 1))} disabled={dia >= hoje} className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm hover:bg-slate-200 disabled:opacity-40" aria-label="Próximo dia">→</button>
        <Chip ativo={dia === hoje} onClick={() => setDia(hoje)}>Hoje</Chip>
        <Chip ativo={dia === addDias(hoje, -1)} onClick={() => setDia(addDias(hoje, -1))}>Ontem</Chip>
        <span className="ml-auto text-sm font-medium text-slate-600">{nomeDia(dia)}</span>
      </section>

      {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      {cob && cob.clientes > 0 && <p className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">Neste dia, <b className="num">{cob.clientes}</b> clientes escreveram no WhatsApp e a IA já analisou <b className="num">{cob.ia.analisadas}</b> conversas{data?.kpis_dia ? <> (<b className="num">{data.kpis_dia.conversas}</b> começaram neste dia e aparecem abaixo)</> : null}.</p>}
      {data?.falhas > 0 && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{data.falhas} conversa(s) deste dia tiveram falha na análise automática e não aparecem na lista.</p>}

      <div className={loading ? 'opacity-50 transition' : 'transition'}>
        {data && (
          <>
            <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
              <Kpi label="Conversas no dia" value={k.conversas} />
              <Kpi label="Resolvidas" value={`${k.resolvidas_pct}%`} tone="text-emerald-600" />
              <Kpi label="Oportunidades (IA)" value={k.oportunidades_abertas} tone="text-blue-600" />
              <Kpi label="Sem retorno" value={k.sem_resposta} tone="text-amber-600" />
              <Kpi label="Nota média" value={k.nota ?? '—'} />
              <Kpi label="1ª resposta" value={k.primeira_resposta_min != null ? `${k.primeira_resposta_min} min` : '—'} />
            </section>

            <section className="mt-6 space-y-2">
              <h2 className="font-semibold">Casos do dia <span className="text-sm font-normal text-slate-400">— clique para ver o caso</span></h2>
              <div className="flex flex-wrap gap-2">
                {FILTROS.map(([id, label, fn]) => <Chip key={id} ativo={filtro === id} onClick={() => setFiltro(id)}>{label} ({data.casos.filter(fn).length})</Chip>)}
              </div>
              <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr><th className="px-3 py-2">Hora</th><th className="px-3 py-2">Cliente</th><th className="px-3 py-2">Assunto</th><th className="px-3 py-2">Atendente</th><th className="px-3 py-2">Situação</th><th className="px-3 py-2 text-right">Nota</th></tr>
                  </thead>
                  <tbody>
                    {casos.map((c) => (
                      <tr key={c.chave || c.id} onClick={() => setAberto(c)} className="cursor-pointer border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-500">{c.hora}</td>
                        <td className="px-3 py-2"><p className="font-medium">{c.contato}</p>{c.telefone && <p className="text-xs text-slate-500">{c.telefone}</p>}</td>
                        <td className="px-3 py-2">{CAT[c.categoria] || c.categoria}<p className="max-w-xs truncate text-xs text-slate-400">{c.motivo}</p></td>
                        <td className="px-3 py-2">{c.vendedores.join(', ') || <span className="text-slate-400">—</span>}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1 text-xs">
                            <span className={`rounded-full px-2 py-0.5 font-semibold ${c.resolvido ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{c.resolvido ? 'Resolvido' : 'Em aberto'}</span>
                            {c.oportunidade && !c.resolvido && <span className="rounded-full bg-blue-100 px-2 py-0.5 font-semibold text-blue-800">Oportunidade</span>}
                            {c.alerta && <span className="rounded-full bg-red-100 px-2 py-0.5 font-semibold text-red-800">{ALERTA[c.alerta] || c.alerta}</span>}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${notaClass(c.nota)}`}>{c.nota ?? '—'}</span></td>
                      </tr>
                    ))}
                    {!casos.length && <tr><td colSpan="6" className="px-3 py-6 text-center text-slate-400">Nenhum caso neste filtro.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mt-6 space-y-2">
              <h2 className="font-semibold">Semana <span className="text-sm font-normal text-slate-400">— últimos 7 dias contra os 7 anteriores</span></h2>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
                <Kpi label="Conversas" value={s.atual.conversas}><Delta atual={s.atual.conversas} anterior={s.anterior.conversas} /></Kpi>
                <Kpi label="Resolvidas" value={`${s.atual.resolvidas_pct}%`}><Delta atual={s.atual.resolvidas_pct} anterior={s.anterior.resolvidas_pct} sufixo=" pts" /></Kpi>
                <Kpi label="Nota média" value={s.atual.nota ?? '—'}><Delta atual={s.atual.nota} anterior={s.anterior.nota} /></Kpi>
                <Kpi label="1ª resposta" value={s.atual.primeira_resposta_min != null ? `${s.atual.primeira_resposta_min} min` : '—'}><Delta atual={s.atual.primeira_resposta_min} anterior={s.anterior.primeira_resposta_min} melhor={false} sufixo=" min" /></Kpi>
                <Kpi label="Sem retorno" value={s.atual.sem_resposta}><Delta atual={s.atual.sem_resposta} anterior={s.anterior.sem_resposta} melhor={false} /></Kpi>
                <Kpi label="Oportunidades abertas" value={s.atual.oportunidades_abertas}><Delta atual={s.atual.oportunidades_abertas} anterior={s.anterior.oportunidades_abertas} melhor={false} /></Kpi>
              </div>
              <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <ResponsiveContainer width="100%" height={240}>
                  <ComposedChart data={data.dias}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="dia" tickFormatter={br} fontSize={12} />
                    <YAxis yAxisId="l" fontSize={12} allowDecimals={false} />
                    <YAxis yAxisId="r" orientation="right" fontSize={12} domain={[0, 10]} />
                    <Tooltip labelFormatter={nomeDia} />
                    <Legend />
                    <Bar yAxisId="l" dataKey="conversas" name="Conversas" fill="#93c5fd" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    <Bar yAxisId="l" dataKey="sem_resposta" name="Sem retorno" fill="#fcd34d" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    <Line yAxisId="r" dataKey="nota" name="Nota média" stroke="#16a34a" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="mt-6 space-y-2">
              <h2 className="font-semibold">Insights</h2>
              <div className="grid gap-2 md:grid-cols-2">
                {data.insights.map((i) => <p key={i.text} className={`rounded-lg border px-3 py-2 text-sm ${TONES[i.tone]}`}>{i.text}</p>)}
              </div>
            </section>
          </>
        )}
      </div>
      {aberto && <Detalhe c={aberto} onClose={() => setAberto(null)} />}
    </div>
  );
}
