import { useEffect, useState } from 'react';
import { getJson } from './api.js';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { CAT, ALERTA, notaClass, Evidencias } from './shared.jsx';
import { Icon, Gauge, Avatar, DeltaChip, Segmentado, Secao, Esqueleto, corNota, CopiarCampo, Conversa } from './ui.jsx';

const br = (d) => d.slice(8) + '/' + d.slice(5, 7);
const PERIODOS = [['7', '7 dias'], ['14', '14 dias'], ['30', '30 dias'], ['60', '60 dias'], ['90', '90 dias']];
const NOMES_COMP = { qualidade: 'Qualidade do atendimento', agilidade: 'Agilidade na resposta', resolucao: 'Resolução' };
const brl = (n) => (n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }));

// As três partes da nota, cada uma com sua barra.
export function Componentes({ comp, criterio, escuro = false }) {
  return (
    <div className="space-y-2.5">
      {Object.entries(NOMES_COMP).map(([k, label]) => (
        <div key={k} title={criterio.regras[k]}>
          <div className={`flex justify-between text-xs ${escuro ? 'text-slate-300' : 'text-slate-600'}`}>
            <span>{label} <span className={escuro ? 'text-slate-500' : 'text-slate-400'}>· {Math.round(criterio.pesos[k] * 100)}%</span></span>
            <span className={`num font-semibold ${escuro ? 'text-white' : 'text-slate-900'}`}>{comp[k] ?? '—'}</span>
          </div>
          <div className="meter mt-1" style={escuro ? { background: 'rgb(255 255 255 / .14)' } : undefined}><i style={{ width: `${(comp[k] ?? 0) * 10}%`, background: corNota(comp[k]) }} /></div>
        </div>
      ))}
    </div>
  );
}

function Criterio({ c }) {
  return (
    <details className="card group p-5 text-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">
        <span className="flex items-center gap-2"><Icon name="bulb" className="h-5 w-5 text-amber-500" /> Como a nota é calculada</span>
        <Icon name="chevron" className="h-4 w-4 text-slate-400 transition group-open:rotate-180" />
      </summary>
      <ul className="mt-4 space-y-2 text-slate-600">
        {Object.entries(NOMES_COMP).map(([k, label]) => <li key={k}><span className="font-semibold text-slate-900">{label} ({Math.round(c.pesos[k] * 100)}%):</span> {c.regras[k]}</li>)}
      </ul>
      <p className="mt-3 text-slate-600"><span className="font-semibold text-slate-900">Quem recebe a nota de cada conversa:</span> {c.atribuicao}</p>
      <p className="mt-2 text-slate-400">Quem tem menos de {c.amostra_minima} conversas no período aparece marcado como amostra pequena.</p>
    </details>
  );
}

// Um caso de conversa: contato com botões de copiar, e ao abrir o resumo, a prova, a próxima ação e a conversa.
export function CasoLinha({ c, tipo }) {
  const [aberto, setAberto] = useState(false);
  const contato = [c.contato, c.telefone, c.email].filter(Boolean).join(' · ');
  return (
    <div className="card break-avoid overflow-hidden" style={{ borderLeft: `4px solid ${corNota(c.nota)}` }}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pr-3">
        <button onClick={() => setAberto(!aberto)} aria-expanded={aberto} className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left transition hover:bg-slate-50">
          <span className={`num rounded-lg px-2 py-0.5 text-xs font-bold ${notaClass(c.nota)}`}>{c.nota ?? '—'}</span>
          <span className="font-semibold">{c.contato}</span>
          <span className="text-sm text-slate-400">{br(c.dia)} · {c.hora} · {CAT[c.categoria] || c.categoria}</span>
          {c.alerta && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">{ALERTA[c.alerta] || c.alerta}</span>}
          {c.oportunidade && !c.resolvido && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">Interesse de compra</span>}
        </button>
        <div className="flex flex-wrap items-center gap-1.5">
          {c.telefone && <CopiarCampo texto={c.telefone} rotulo={c.telefone} icone="phone" />}
          {c.email && <CopiarCampo texto={c.email} rotulo="E-mail" icone="mail" />}
          <button onClick={() => setAberto(!aberto)} aria-label="Abrir caso" className="no-print rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><Icon name="chevron" className={`h-4 w-4 transition ${aberto ? 'rotate-180' : ''}`} /></button>
        </div>
      </div>
      {aberto && (
        <div className="space-y-4 border-t border-slate-100 bg-slate-50/60 px-4 py-4 text-sm">
          <div className="flex flex-wrap items-center gap-2 text-slate-600">
            <span className="font-semibold text-slate-900">{c.contato}</span>
            {c.telefone && <span className="num">{c.telefone}</span>}
            {c.email ? <span>{c.email}</span> : <span className="text-slate-400">sem e-mail cadastrado</span>}
            <CopiarCampo texto={contato} rotulo="Copiar contato" className="ml-auto" />
          </div>
          <p><span className="font-semibold">Resumo: </span>{c.resumo}</p>
          {tipo === 'revisar' && <Evidencias itens={c.evidencias} />}
          {tipo === 'revisar' && !c.evidencias.length && c.melhorias.length > 0 && <ul className="list-disc pl-5 text-slate-700">{c.melhorias.map((m) => <li key={m}>{m}</li>)}</ul>}
          {tipo === 'bom' && c.fortes.length > 0 && <ul className="list-disc pl-5 text-emerald-800">{c.fortes.map((m) => <li key={m}>{m}</li>)}</ul>}
          {c.proxima_acao && <p className="rounded-xl bg-indigo-50 px-3 py-2 text-indigo-900"><span className="font-semibold">Próxima ação: </span>{c.proxima_acao}</p>}
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400"><Icon name="whatsapp" className="h-4 w-4" /> Conversa</p>
            <Conversa id={c.id} />
          </div>
        </div>
      )}
    </div>
  );
}

export function CasosVendedor({ v }) {
  const porId = new Map(v.casos.map((c) => [c.chave, c]));
  const revisar = v.revisar.map((id) => porId.get(id)).filter(Boolean);
  const bons = v.bons.map((id) => porId.get(id)).filter(Boolean);
  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <Secao id="casos" icone="alert" titulo="Casos para revisar juntos" dica="Clique num caso para ver o resumo e o que fazer diferente" />
        <div className="space-y-2">
          {revisar.length ? revisar.map((c) => <CasoLinha key={c.chave} c={c} tipo="revisar" />) : <p className="card p-6 text-center text-sm text-slate-400">Nenhum caso crítico no período.</p>}
        </div>
      </section>

      {bons.length > 0 && (
        <section className="space-y-3">
          <Secao icone="checkCircle" titulo="Bons exemplos para reforçar" dica="Conversas bem conduzidas, úteis para mostrar ao time" />
          <div className="space-y-2">{bons.map((c) => <CasoLinha key={c.chave} c={c} tipo="bom" />)}</div>
        </section>
      )}

      <section className="space-y-3">
        <Secao icone="trend" titulo="Nota por dia" />
        <div className="card break-avoid p-4">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={v.evolucao} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <defs><linearGradient id="gNota" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity=".35" /><stop offset="100%" stopColor="#6366f1" stopOpacity="0" /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="dia" tickFormatter={br} fontSize={12} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 10]} fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip labelFormatter={br} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 8px 24px -12px rgb(15 23 42 / .3)' }} />
              <Area dataKey="nota" name="Nota" stroke="#6366f1" strokeWidth={2.5} fill="url(#gNota)" dot={false} isAnimationActive={false} connectNulls />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}

export default function Equipe({ onAbrir }) {
  const [dias, setDias] = useState('30');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    setLoading(true);
    getJson(`/api/equipe?dias=${dias}`).then((d) => { setData(d); setErro(''); }).catch((e) => setErro(e.message)).finally(() => setLoading(false));
  }, [dias]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <header className="fade-up flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Equipe de atendimento</h1>
          <p className="text-sm text-slate-500">A nota geral, a nota de cada pessoa e onde cada um pode melhorar</p>
        </div>
        <div className="flex items-center gap-3">
          {data?.mock && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Dados de demonstração</span>}
          <Segmentado opcoes={PERIODOS} valor={dias} onChange={setDias} />
        </div>
      </header>
      {erro && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{erro}</p>}

      {!data && loading && <div className="space-y-4"><Esqueleto className="h-44" /><div className="grid gap-4 md:grid-cols-3"><Esqueleto className="h-56" /><Esqueleto className="h-56" /><Esqueleto className="h-56" /></div></div>}

      {data && (
        <div className={`space-y-6 transition ${loading ? 'opacity-60' : ''}`}>
          <section className="fade-up overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 p-6 text-white shadow-xl shadow-slate-900/10">
            <div className="flex flex-wrap items-center gap-6">
              <Gauge value={data.geral.nota} size={120} escuro />
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-indigo-300">Nota geral do atendimento</p>
                <p className="mt-1 text-sm text-slate-300">{br(data.de)} a {br(data.ate)} · {data.geral.conversas} conversas{data.geral.so_automacao > 0 && ` · ${data.geral.so_automacao} só por automação`}</p>
                <div className="mt-2"><DeltaChip atual={data.geral.nota} anterior={data.geral.variacao != null ? +(data.geral.nota - data.geral.variacao).toFixed(1) : null} /></div>
                {data.vendas_disponiveis && <p className="num mt-3 text-lg font-semibold">{brl(data.geral.vendas.receita)} <span className="text-sm font-normal text-slate-300">· {data.geral.vendas.vendas} {data.geral.vendas.vendas === 1 ? 'venda' : 'vendas'} · conversão {data.geral.vendas.conversao ?? '—'}%</span></p>}
                <button onClick={() => onAbrir('time')} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold backdrop-blur transition hover:bg-white/20">Ver o time por período <span aria-hidden>→</span></button>
              </div>
              <div className="ml-auto w-full max-w-sm"><Componentes comp={data.geral.componentes} criterio={data.criterio} escuro /></div>
            </div>
          </section>

          <section className="space-y-3">
            <Secao icone="users" titulo="Vendedores" dica="Clique para abrir o relatório individual" />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {data.vendedores.map((p, i) => (
                <button key={p.id} onClick={() => onAbrir(p.id)} className={`card card-hover fade-up d${Math.min(i + 1, 4)} space-y-4 p-5 text-left`}>
                  <div className="flex items-center gap-3">
                    <Avatar nome={p.nome} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{p.nome}</p>
                      <p className="text-xs text-slate-500">{p.conversas} conversas{p.amostra_pequena && ' · amostra pequena'}</p>
                    </div>
                    <Gauge value={p.nota} size={64} />
                  </div>
                  <Componentes comp={p.componentes} criterio={data.criterio} />
                  {data.vendas_disponiveis && <p className="num rounded-xl bg-slate-50 px-3 py-2 text-sm"><span className="font-semibold">{brl(p.vendas.receita)}</span> <span className="text-slate-500">· {p.vendas.vendas} {p.vendas.vendas === 1 ? 'venda' : 'vendas'} · {p.vendas.conversao ?? '—'}% de conversão</span></p>}
                  {p.padroes[0] && <p className="flex items-start gap-1.5 text-xs text-amber-800"><Icon name="alert" className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Ponto a melhorar: {p.padroes[0].tema}</p>}
                </button>
              ))}
            </div>
          </section>
          <Criterio c={data.criterio} />
        </div>
      )}
    </div>
  );
}
