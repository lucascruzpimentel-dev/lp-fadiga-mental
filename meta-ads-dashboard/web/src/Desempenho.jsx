import { useEffect, useMemo, useState } from 'react';
import { getJson } from './api.js';
import { ResponsiveContainer, ComposedChart, Bar, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { CasosVendedor, Componentes } from './Equipe.jsx';
import { notaClass } from './shared.jsx';
import { Icon, Gauge, Avatar, DeltaChip, Stat, Secao, Segmentado, Meter, Esqueleto, BotaoCopiar, CopiarCampo, Gaveta, Conversa } from './ui.jsx';

const iso = (d) => d.toISOString().slice(0, 10);
const hojeBrt = () => iso(new Date(Date.now() - 3 * 3600e3));
const addDias = (d, n) => iso(new Date(new Date(d + 'T12:00:00Z').getTime() + n * 864e5));
const br = (d) => d.slice(8, 10) + '/' + d.slice(5, 7);
const brl = (n) => (n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }));
const PRESETS = [
  ['hoje', 'Hoje', () => [hojeBrt(), hojeBrt()]],
  ['7', '7 dias', () => [addDias(hojeBrt(), -6), hojeBrt()]],
  ['30', '30 dias', () => [addDias(hojeBrt(), -29), hojeBrt()]],
  ['mes', 'Este mês', () => [hojeBrt().slice(0, 7) + '-01', hojeBrt()]],
];
const METRICAS = [
  { k: 'receita', label: 'Receita', fmt: brl, tipo: 'barra', vendas: true, cor: '#6366f1' },
  { k: 'vendas', label: 'Vendas', fmt: (v) => v, tipo: 'barra', vendas: true, cor: '#10b981' },
  { k: 'conversao', label: 'Conversão', fmt: (v) => (v == null ? '—' : `${v}%`), tipo: 'linha', vendas: true, cor: '#f59e0b' },
  { k: 'conversas', label: 'Conversas', fmt: (v) => v, tipo: 'barra', cor: '#0ea5e9' },
  { k: 'nota', label: 'Nota', fmt: (v) => v ?? '—', tipo: 'linha', cor: '#8b5cf6' },
];
const nomePeriodo = (p, agrupar) => (agrupar === 'mes' ? `${p.slice(5, 7)}/${p.slice(0, 4)}` : agrupar === 'semana' ? `sem. ${br(p)}` : br(p));
const ANCORAS = [['resumo', 'Resumo'], ['evolucao', 'Evolução'], ['relatorio', 'Relatório'], ['produtos', 'Produtos'], ['casos', 'Conversas']];

// ---------- Relatório ----------

const TOM = {
  critico: { cor: 'bg-rose-500', pilula: 'bg-rose-50 text-rose-700', rotulo: 'Crítico' },
  atencao: { cor: 'bg-amber-500', pilula: 'bg-amber-50 text-amber-700', rotulo: 'Atenção' },
};

// Compara a pessoa com o time numa régua: o ponto cheio é a pessoa, o vazado é o time.
function Termometro({ c }) {
  if (c.valor == null || c.time == null) return null;
  const bom = c.melhor === 'alto' ? c.valor >= c.time : c.valor <= c.time;
  const igual = c.valor === c.time;
  const topo = Math.max(c.valor, c.time, 0.0001) * 1.25;
  const a = (c.valor / topo) * 100, b = (c.time / topo) * 100;
  const cor = igual ? '#94a3b8' : bom ? '#10b981' : '#f43f5e';
  const dif = +(c.valor - c.time).toFixed(1);
  return (
    <div className="card card-hover break-avoid p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{c.label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="num text-[1.65rem] font-bold leading-none">{c.valor}{c.unidade}</span>
        <span className="text-xs text-slate-400">time {c.time}{c.unidade}</span>
      </div>
      <div className="relative mt-4 h-6">
        <div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-slate-100" />
        <div className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full" style={{ left: `${Math.min(a, b)}%`, width: `${Math.abs(a - b)}%`, background: cor, opacity: 0.45 }} />
        <span className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-400 bg-white" style={{ left: `${b}%` }} title="Time" />
        <span className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full ring-4 ring-white" style={{ left: `${a}%`, background: cor }} title="Pessoa" />
      </div>
      <p className="mt-2 text-xs font-semibold" style={{ color: cor }}>{igual ? 'Igual ao time' : `${bom ? 'Melhor' : 'Pior'} que o time (${dif > 0 ? '+' : ''}${dif}${c.unidade})`}</p>
    </div>
  );
}

function Prioridade({ p, aberto, onToggle }) {
  const t = TOM[p.tom];
  return (
    <li className="relative pl-12">
      <span className={`absolute left-0 top-3 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white shadow ${t.cor}`}>{p.ordem}</span>
      <div className="card break-avoid overflow-hidden">
        <button onClick={onToggle} aria-expanded={aberto} className="flex w-full items-start gap-3 p-4 text-left transition hover:bg-slate-50">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-semibold leading-snug">{p.titulo}</h4>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${t.pilula}`}>{t.rotulo}</span>
            </div>
            <p className="mt-1 text-sm text-slate-500">{p.evidencia}</p>
          </div>
          <Icon name="chevron" className={`no-print mt-1 h-4 w-4 shrink-0 text-slate-400 transition ${aberto ? 'rotate-180' : ''}`} />
        </button>
        {aberto && (
          <div className="grid gap-4 border-t border-slate-100 bg-slate-50/60 p-4 text-sm md:grid-cols-2">
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400"><Icon name="checkCircle" className="h-4 w-4 text-emerald-500" /> O que fazer</p>
              <p className="leading-relaxed text-slate-700">{p.acao}</p>
            </div>
            {p.roteiro && (
              <div>
                <p className="mb-1.5 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-slate-400">
                  <span className="flex items-center gap-1.5"><Icon name="whatsapp" className="h-4 w-4 text-indigo-500" /> O que dizer</span>
                  <BotaoCopiar texto={p.roteiro} rotulo="Copiar fala" />
                </p>
                <p className="rounded-2xl rounded-tl-sm bg-white px-4 py-3 italic leading-relaxed text-slate-700 shadow-sm ring-1 ring-slate-200">“{p.roteiro}”</p>
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function Prioridades({ plano, imprimindo }) {
  const [aberto, setAberto] = useState(1);
  return (
    <ol className="relative space-y-3 before:absolute before:bottom-6 before:left-4 before:top-8 before:w-px before:bg-slate-200 before:content-['']">
      {plano.map((p) => <Prioridade key={p.ordem} p={p} aberto={imprimindo || aberto === p.ordem} onToggle={() => setAberto(aberto === p.ordem ? 0 : p.ordem)} />)}
    </ol>
  );
}

function Tabela({ cab, linhas, vazio, alinhar = [] }) {
  return (
    <div className="card break-avoid overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead><tr className="border-b border-slate-100 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">{cab.map((c, k) => <th key={c} className={`px-4 py-3 ${k ? 'text-right' : ''}`}>{c}</th>)}</tr></thead>
        <tbody>
          {linhas.map((l, n) => <tr key={n} className="border-b border-slate-50 transition last:border-0 hover:bg-slate-50/70">{l.map((c, k) => <td key={k} className={`px-4 py-3 ${k ? 'text-right' : 'font-medium'}`}>{c}</td>)}</tr>)}
          {!linhas.length && <tr><td colSpan={cab.length} className="px-4 py-8 text-center text-slate-400">{vazio}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

const Celula = ({ pct, cor, texto }) => (
  <div className="ml-auto flex w-40 items-center justify-end gap-2"><Meter pct={pct} cor={cor} className="w-20" /><span className="num w-20 text-right">{texto}</span></div>
);

const idade = (d) => (d <= 7 ? 'bg-emerald-50 text-emerald-700' : d <= 30 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700');

function Produtos({ r, quem }) {
  const c = r.carteira;
  const [sel, setSel] = useState(null);
  const [visao, setVisao] = useState('quentes');
  const [busca, setBusca] = useState('');
  const [achados, setAchados] = useState(null);
  useEffect(() => {
    if (busca.trim().length < 2) { setAchados(null); return undefined; }
    const t = setTimeout(() => { getJson(`/api/oportunidades?${new URLSearchParams({ vendedor: quem, q: busca })}`).then((d) => setAchados(d.resultados)).catch(() => setAchados([])); }, 350);
    return () => clearTimeout(t);
  }, [busca, quem]);
  const lista = achados ?? ((visao === 'quentes' ? r.quentes : r.maiores) || []);
  const maxR = Math.max(1, ...r.funis.map((f) => f.receita)), maxV = Math.max(1, ...r.funis.map((f) => f.valor_aberto));
  return (
    <section className="space-y-4">
      <Secao id="produtos" icone="folder" titulo="Produtos e oportunidades" dica="O que está sendo trabalhado e onde está o dinheiro parado" />
      {c.cobertura?.total && <p className="flex gap-2 rounded-xl bg-slate-100 px-4 py-3 text-xs text-slate-600"><Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /> O HighLevel tem {c.cobertura.total.toLocaleString('pt-BR')} oportunidades abertas e {c.cobertura.sincronizadas.toLocaleString('pt-BR')} estão sincronizadas aqui (as mais recentes de cada vendedor e as dos contatos que conversaram). “Onde agir primeiro” considera só essas, e as listas antigas ficam de fora.</p>}
      {c.abertas > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat icon="folder" label="Em aberto" value={c.abertas} tom="sky" hint="oportunidades no total" />
          <Stat icon="trend" label="Ativas" value={c.ativas} tom="emerald" hint="mexidas nos últimos 30 dias" />
          <Stat icon="ticket" label="Com valor" value={c.com_valor} tom="violet" hint="têm um valor definido" />
          <Stat icon="money" label="Valor em aberto" value={brl(c.valor_aberto)} tom="amber" hint={c.paradas ? `${c.paradas} paradas há +14 dias` : 'nenhuma parada'} />
        </div>
      )}
      {(r.produtos || []).length > 0 && (
        <div className="space-y-2">
          <h3 className="flex items-center gap-2 font-semibold"><Icon name="ticket" className="h-5 w-5 text-indigo-500" /> Produtos que está trabalhando <span className="text-sm font-normal text-slate-400">— conversas, carteira e vendas de cada produto</span></h3>
          <Tabela cab={['Produto', 'Conversas', 'Em aberto (ativas)', 'Valor em aberto', 'Vendas', 'Receita']}
            linhas={r.produtos.map((p) => [<div key="n" title={p.descricao}><p className="font-semibold">{p.nome}</p><p className="text-[11px] font-normal text-slate-400">{p.familia}{p.temas?.[0] ? ` · pergunta mais: ${p.temas[0].tema.toLowerCase()}` : ''}</p></div>, <span key="c" className="num">{p.conversas}</span>, <span key="a" className="num">{p.abertas} ({p.ativas})</span>, <span key="v" className="num">{brl(p.valor_aberto)}</span>, <span key="vd" className="num">{p.vendas}</span>, <span key="r" className="num font-semibold">{brl(p.receita)}</span>])}
            vazio="" />
          <p className="text-xs text-slate-500">Produto inferido pelos nomes de funil e etapa do HighLevel e pelo que a conversa cita. Passe o mouse no nome para ver a descrição.</p>
        </div>
      )}

      <Tabela cab={['Funil (origem da oportunidade)', 'Vendas', 'Receita', 'Em aberto', 'Ativas', 'Valor em aberto']}
        linhas={r.funis.map((f) => [f.funil, <span key="g" className="num">{f.ganhas}</span>, <Celula key="r" pct={(f.receita / maxR) * 100} cor="#10b981" texto={brl(f.receita)} />, <span key="a" className="num">{f.abertas}</span>, <span key="t" className="num">{f.ativas}</span>, <Celula key="v" pct={(f.valor_aberto / maxV) * 100} cor="#6366f1" texto={brl(f.valor_aberto)} />])}
        vazio="Sem oportunidades do HighLevel para esta pessoa." />

      {(r.quentes.length > 0 || (r.maiores || []).length > 0) && (
        <div className="space-y-3 pt-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 font-semibold"><Icon name="sparkles" className="h-5 w-5 text-amber-500" /> Onde agir primeiro <span className="text-sm font-normal text-slate-400">— {lista.length} oportunidades, clique para ver o resumo e o que fazer</span></h3>
            <Segmentado opcoes={[['quentes', 'Mais quentes'], ['maiores', 'Maiores valores']]} valor={visao} onChange={(v) => { setBusca(''); setVisao(v); }} />
          </div>
          <div className="relative">
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar um contato (nome, telefone ou e-mail) na carteira" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm outline-none transition focus:border-indigo-400" />
            {achados && <p className="mt-1 text-xs text-slate-500">{achados.length ? `${achados.length} resultado(s) para “${busca}”` : `Nenhuma oportunidade de “${busca}” nesta carteira.`}</p>}
          </div>
          {!achados && <p className="text-xs text-slate-500">{visao === 'quentes' ? 'Ordenadas por sinais de compra: conversa recente com interesse, etapa avançada, valor e movimentação. Uma oportunidade pequena com cliente pronto para fechar vem antes de uma grande parada.' : 'Ordenadas só pelo valor da oportunidade.'}</p>}
          <div className="grid gap-3 md:grid-cols-2">
            {lista.map((q) => (
              <button key={q.id} onClick={() => setSel(q)} className="card card-hover break-avoid flex items-center gap-3 p-4 text-left">
                <Avatar nome={q.contato || '?'} className="h-11 w-11 text-sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{q.contato || '—'}</p>
                  <p className="truncate text-xs text-slate-500">{q.funil || '—'}{q.etapa ? ` · ${q.etapa}` : ''}</p>
                  {q.telefone && <p className="num mt-1 text-xs text-slate-500">{q.telefone}</p>}
                  <div className="mt-1 flex flex-wrap gap-1">
                    {q.produto && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">{q.produto}</span>}
                    {q.outras > 0 && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">+{q.outras} {q.outras === 1 ? 'outra oportunidade' : 'outras oportunidades'}</span>}
                    {q.possivel_ganho && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">Possível venda já feita</span>}
                    {visao === 'quentes' && (q.motivos || []).slice(0, 2).map((m) => <span key={m} className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">{m}</span>)}
                  </div>
                </div>
                <div className="text-right">
                  <p className="num text-lg font-bold">{q.valor > 0 ? brl(q.valor) : '—'}</p>
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${idade(q.parada_dias)}`}>{q.parada_dias >= 999 ? 'sem movimento' : q.parada_dias === 0 ? 'mexida hoje' : `parada há ${q.parada_dias}d`}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <Gaveta aberta={!!sel} onClose={() => setSel(null)}>
        {sel && (
          <div className="space-y-6 p-6 pt-4">
            <div className="flex items-center gap-4 pr-12">
              <Avatar nome={sel.contato || '?'} className="h-14 w-14 text-lg" />
              <div className="min-w-0">
                <h3 className="truncate text-xl font-bold">{sel.contato || 'Sem nome'}</h3>
                <p className="text-sm text-slate-500">{sel.funil || '—'}{sel.etapa ? ` · ${sel.etapa}` : ''}</p>
              </div>
            </div>
            {sel.sem_oportunidade && <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 ring-1 ring-amber-200"><Icon name="alert" className="h-5 w-5" /> Este contato tem conversa de compra recente, mas não há oportunidade aberta no HighLevel para ele.</p>}
            {(sel.motivos || []).length > 0 && <div className="flex flex-wrap gap-1.5">{sel.motivos.map((m) => <span key={m} className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">{m}</span>)}</div>}
            {sel.possivel_ganho && <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200"><Icon name="checkCircle" className="h-5 w-5" /> A conversa indica que o pagamento foi feito. Essa oportunidade provavelmente deveria estar como ganha.</p>}
            <div className="flex flex-wrap items-center gap-2">
              <span className="num rounded-xl bg-slate-900 px-3 py-1.5 text-lg font-bold text-white">{brl(sel.valor)}</span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${idade(sel.parada_dias)}`}>{sel.parada_dias >= 999 ? 'sem movimento' : sel.parada_dias === 0 ? 'mexida hoje' : `parada há ${sel.parada_dias} dias`}</span>
              {sel.criada_dias != null && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">criada há {sel.criada_dias} dias</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              {sel.telefone && <CopiarCampo texto={sel.telefone} rotulo={sel.telefone} icone="phone" />}
              {sel.email && <CopiarCampo texto={sel.email} rotulo={sel.email} icone="mail" />}
              {sel.telefone && <a href={`https://wa.me/${sel.telefone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-emerald-600"><Icon name="whatsapp" className="h-3.5 w-3.5" /> Abrir no WhatsApp</a>}
            </div>
            {sel.produto && <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Produto</p><p className="mt-0.5 font-semibold">{sel.produto} <span className="text-xs font-normal text-slate-500">· {sel.produto_familia}</span></p><p className="mt-1 text-sm leading-relaxed text-slate-600">{sel.produto_descricao}</p></div>}
            <div>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">Resumo</p>
              <p className="text-sm leading-relaxed text-slate-700">{sel.resumo}</p>
            </div>
            <div className="rounded-2xl bg-indigo-50 p-4 ring-1 ring-indigo-200">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-indigo-600"><Icon name="checkCircle" className="h-4 w-4" /> O que fazer</p>
              <p className="text-sm leading-relaxed text-indigo-950">{sel.acao}</p>
            </div>
            {sel.roteiro && (
              <div>
                <p className="mb-1.5 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-slate-400"><span className="flex items-center gap-1.5"><Icon name="whatsapp" className="h-4 w-4 text-indigo-500" /> O que dizer</span><BotaoCopiar texto={sel.roteiro} rotulo="Copiar fala" /></p>
                <p className="rounded-2xl rounded-tl-sm bg-slate-50 px-4 py-3 text-sm italic leading-relaxed text-slate-700 ring-1 ring-slate-200">“{sel.roteiro}”</p>
              </div>
            )}
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400"><Icon name="chat" className="h-4 w-4" /> Conversa mais recente</p>
              {sel.conversation_id ? <Conversa id={sel.conversation_id} /> : <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500">Sem conversa analisada com este contato nos últimos dias.</p>}
            </div>
          </div>
        )}
      </Gaveta>

      <div className="space-y-3 pt-2">
        <h3 className="flex items-center gap-2 font-semibold"><Icon name="chat" className="h-5 w-5 text-sky-500" /> Conversas por assunto</h3>
        <Tabela cab={['Assunto', 'Conversas', 'Nota', 'Resolvidas', 'Interesse sem fechar']}
          linhas={r.categorias.map((k) => [k.nome, <span key="c" className="num">{k.conversas}</span>, <span key="n" className={`num rounded-lg px-2 py-0.5 text-xs font-bold ${notaClass(k.nota)}`}>{k.nota ?? '—'}</span>, <Celula key="r" pct={k.resolvidas_pct} cor={k.resolvidas_pct >= 50 ? '#10b981' : k.resolvidas_pct >= 30 ? '#f59e0b' : '#f43f5e'} texto={`${k.resolvidas_pct}%`} />, <span key="o" className="num">{k.oportunidades}</span>])}
          vazio="Sem conversas no período." />
      </div>
    </section>
  );
}

function Relatorio({ r, nome, imprimindo, quem }) {
  return (
    <section className="space-y-10">
      <div className="space-y-4">
        <Secao id="relatorio" icone="sparkles" titulo="Relatório geral" dica={`Diagnóstico de ${nome}, com o que corrigir e como abordar`} />
        <div className="card relative overflow-hidden p-5">
          <span className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-indigo-500 to-violet-500" />
          <p className="pl-3 text-[15px] leading-relaxed text-slate-700">{r.resumo}</p>
        </div>
      </div>

      {r.comparativo.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold">Como está contra o time <span className="text-sm font-normal text-slate-400">— ponto cheio é {nome}, ponto vazado é o time</span></h3>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{r.comparativo.map((k) => <Termometro key={k.id} c={k} />)}</div>
        </div>
      )}

      <div className="space-y-3">
        <h3 className="font-semibold">O que corrigir primeiro</h3>
        {r.plano.length ? <Prioridades plano={r.plano} imprimindo={imprimindo} /> : <p className="card p-6 text-center text-sm text-slate-400">Nenhum ponto de atenção relevante no período.</p>}
        {r.outros.length > 0 && (
          <details className="card group p-4 text-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">
              Outros {r.outros.length} pontos de atenção
              <Icon name="chevron" className="h-4 w-4 text-slate-400 transition group-open:rotate-180" />
            </summary>
            <ul className="mt-4 space-y-4">
              {r.outros.map((o) => (
                <li key={o.titulo} className="border-l-2 border-amber-300 pl-3">
                  <p className="font-semibold">{o.titulo}</p>
                  <p className="text-slate-500">{o.evidencia}</p>
                  <p className="mt-1 text-slate-700"><span className="font-semibold">O que fazer: </span>{o.acao}</p>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {r.fortes.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold">O que já funciona</h3>
          <ul className="grid gap-3 md:grid-cols-2">
            {r.fortes.map((f) => (
              <li key={f.id} className="card break-avoid flex gap-3 border-l-4 border-l-emerald-400 p-4">
                <Icon name="checkCircle" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                <div><p className="font-semibold">{f.titulo}</p><p className="text-sm text-slate-500">{f.evidencia}</p></div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Produtos r={r} quem={quem} />
    </section>
  );
}

// ---------- Página ----------

function Tooltipe({ active, payload, label, m, agrupar }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-lg">
      <p className="text-xs text-slate-400">{nomePeriodo(label, agrupar)}</p>
      <p className="num font-bold">{m.fmt(payload[0].value)} <span className="text-xs font-normal text-slate-500">{m.label}</span></p>
    </div>
  );
}

export default function Desempenho({ quem, setQuem }) {
  const [preset, setPreset] = useState('30');
  const [custom, setCustom] = useState({ de: '', ate: '' });
  const [agrupar, setAgrupar] = useState('dia');
  const [metrica, setMetrica] = useState('receita');
  const [data, setData] = useState(null);
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [ativa, setAtiva] = useState('resumo');
  const [imprimindo, setImprimindo] = useState(false);

  const [de, ate] = useMemo(() => {
    if (preset === 'custom' && custom.de && custom.ate) return [custom.de, custom.ate];
    return (PRESETS.find(([k]) => k === preset) || PRESETS[2])[2]();
  }, [preset, custom]);

  useEffect(() => {
    setLoading(true);
    getJson(`/api/desempenho?${new URLSearchParams({ vendedor: quem, de, ate, agrupar })}`)
      .then((d) => { setData(d); setErro(''); if (d.vendedores.length) setLista(d.vendedores); })
      .catch((e) => setErro(e.message))
      .finally(() => setLoading(false));
  }, [quem, de, ate, agrupar]);

  // Abre tudo ao imprimir e destaca a seção visível no menu.
  useEffect(() => {
    const antes = () => setImprimindo(true), depois = () => setImprimindo(false);
    window.addEventListener('beforeprint', antes); window.addEventListener('afterprint', depois);
    return () => { window.removeEventListener('beforeprint', antes); window.removeEventListener('afterprint', depois); };
  }, []);
  useEffect(() => {
    if (!data) return undefined;
    const f = () => {
      let atual = 'resumo';
      for (const [id] of ANCORAS) { const el = document.getElementById(id); if (el && el.getBoundingClientRect().top <= 230) atual = id; }
      setAtiva(atual);
    };
    f();
    window.addEventListener('scroll', f, { passive: true });
    return () => window.removeEventListener('scroll', f);
  }, [data]);

  const vendasOk = data?.vendas_disponiveis;
  const opcoes = METRICAS.filter((m) => vendasOk || !m.vendas);
  const m = opcoes.find((x) => x.k === metrica) || opcoes[0];
  const t = data?.totais, a = data?.anterior, av = data?.avaliacao;
  const ehTime = quem === 'time';

  return (
    <div className="space-y-8">
      <div className="no-print z-[9] -mx-4 md:sticky md:top-[46px] border-b border-slate-200/70 bg-white/85 px-4 py-3 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-3">
          <label className="sr-only" htmlFor="quem">Avaliar</label>
          <div className="relative">
            <select id="quem" value={quem} onChange={(e) => setQuem(e.target.value)} className="appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-9 text-sm font-semibold shadow-sm transition hover:border-indigo-300">
              <option value="time">Time todo</option>
              {lista.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
            </select>
            <Icon name="chevron" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
          <Segmentado opcoes={[...PRESETS.map(([k, l]) => [k, l]), ['custom', 'Personalizado']]} valor={preset} onChange={setPreset} />
          {preset === 'custom' && (
            <div className="flex items-center gap-2 text-sm">
              <input type="date" value={custom.de} onChange={(e) => setCustom({ ...custom, de: e.target.value })} className="rounded-lg border border-slate-200 px-2 py-1.5" />
              <span className="text-slate-400">até</span>
              <input type="date" value={custom.ate} max={hojeBrt()} onChange={(e) => setCustom({ ...custom, ate: e.target.value })} className="rounded-lg border border-slate-200 px-2 py-1.5" />
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            {data?.mock && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Dados de demonstração</span>}
            <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700">
              <Icon name="printer" className="h-4 w-4" /> Exportar PDF
            </button>
          </div>
        </div>
        <nav className="-mb-1 mt-3 flex gap-1 overflow-x-auto" aria-label="Seções do relatório">
          {ANCORAS.map(([id, rot]) => (
            <a key={id} href={`#${id}`} className={`whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium transition ${ativa === id ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>{rot}</a>
          ))}
        </nav>
      </div>

      {erro && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{erro}</p>}
      {data && !vendasOk && <p className="flex gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900"><Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" /> As oportunidades do HighLevel ainda não foram sincronizadas (a tabela ghl_oportunidades não existe ou está vazia). Por isso receita, vendas e conversão não aparecem. O resto usa os dados reais do atendimento.</p>}

      {!data && loading && <div className="space-y-4"><Esqueleto className="h-56" /><div className="grid grid-cols-2 gap-4 lg:grid-cols-4"><Esqueleto className="h-32" /><Esqueleto className="h-32" /><Esqueleto className="h-32" /><Esqueleto className="h-32" /></div><Esqueleto className="h-72" /></div>}

      {data && (
        <div className={`space-y-10 transition ${loading ? 'opacity-60' : ''}`}>
          <section id="resumo" className="fade-up relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-xl shadow-indigo-900/10 md:p-8">
            <span className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-indigo-500/25 blur-3xl" />
            <span className="pointer-events-none absolute -bottom-20 left-1/3 h-56 w-56 rounded-full bg-fuchsia-500/15 blur-3xl" />
            <div className="relative grid items-center gap-8 lg:grid-cols-[1.2fr_1fr]">
              <div className="flex flex-wrap items-center gap-5">
                <Gauge value={av.nota} size={128} escuro />
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    {ehTime ? <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10"><Icon name="users" className="h-6 w-6" /></span> : <Avatar nome={av.nome} />}
                    <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">{av.nome}</h1>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{av.conversas} conversas · {br(data.de)} a {br(data.ate)}{av.amostra_pequena && <span className="ml-2 rounded-full bg-amber-400/20 px-2 py-0.5 text-xs font-semibold text-amber-200">amostra pequena</span>}</p>
                  <div className="mt-2"><DeltaChip atual={av.nota} anterior={av.variacao != null ? +(av.nota - av.variacao).toFixed(1) : null} /></div>
                </div>
              </div>
              <div className="space-y-4">
                <Componentes comp={av.componentes} criterio={data.criterio} escuro />
                {vendasOk && (
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {[['Receita', brl(t.receita)], ['Vendas', t.vendas], ['Conversão', t.conversao != null ? `${t.conversao}%` : '—']].map(([l, v]) => (
                      <div key={l} className="rounded-xl bg-white/10 px-3 py-2 backdrop-blur"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-300">{l}</p><p className="num text-lg font-bold">{v}</p></div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {vendasOk && <Stat className="fade-up d1" icon="money" label="Receita" value={brl(t.receita)} tom="indigo"><DeltaChip atual={t.receita} anterior={a.receita} formato={brl} /></Stat>}
              {vendasOk && <Stat className="fade-up d2" icon="cart" label="Vendas" value={t.vendas} tom="emerald"><DeltaChip atual={t.vendas} anterior={a.vendas} /></Stat>}
              {vendasOk && <Stat className="fade-up d3" icon="percent" label="Conversão" value={t.conversao != null ? `${t.conversao}%` : '—'} tom="amber"><DeltaChip atual={t.conversao} anterior={a.conversao} formato={(v) => `${v} pts`} /></Stat>}
              {vendasOk && <Stat className="fade-up d4" icon="ticket" label="Ticket médio" value={brl(t.ticket)} tom="violet"><DeltaChip atual={t.ticket} anterior={a.ticket} formato={brl} /></Stat>}
              <Stat className="fade-up d1" icon="chat" label="Conversas" value={t.conversas} tom="sky"><DeltaChip atual={t.conversas} anterior={a.conversas} /></Stat>
              <Stat className="fade-up d2" icon="clock" label="1ª resposta" value={av.medido.primeira_resposta_min != null ? `${av.medido.primeira_resposta_min} min` : '—'} tom="rose" hint="em horário comercial" />
              <Stat className="fade-up d3" icon="checkCircle" label="Resolvidas" value={`${av.medido.resolvidas_pct}%`} tom="emerald" hint="das conversas do período" />
              <Stat className="fade-up d4" icon="folder" label="Em aberto" value={av.abertas ? av.abertas.ativas : av.medido.oportunidades_abertas} tom="sky" hint={av.abertas ? `ativas, de ${av.abertas.abertas} no total` : 'oportunidades (IA)'} />
            </div>

            {vendasOk && (
              <div className="grid gap-3 md:grid-cols-3">
                {[['hoje', 'Vendeu hoje'], ['semana', 'Vendeu na semana'], ['mes', 'Vendeu no mês']].map(([k, l]) => (
                  <div key={k} className="card card-hover relative overflow-hidden p-4">
                    <span className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-emerald-400 to-teal-500" />
                    <p className="pl-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{l}</p>
                    <p className="num mt-1 pl-2 text-2xl font-bold">{brl(data.resumo[k].receita)}</p>
                    <p className="pl-2 text-sm text-slate-500">{data.resumo[k].vendas} {data.resumo[k].vendas === 1 ? 'venda' : 'vendas'} · conversão {data.resumo[k].conversao ?? '—'}%</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <Secao id="evolucao" icone="chart" titulo="Evolução" dica={`${m.label} de ${br(data.de)} a ${br(data.ate)}`}
              direita={<Segmentado opcoes={[['dia', 'Dia'], ['semana', 'Semana'], ['mes', 'Mês']]} valor={agrupar} onChange={setAgrupar} />} />
            <div className="card break-avoid p-4 md:p-5">
              <Segmentado opcoes={opcoes.map((o) => [o.k, o.label])} valor={m.k} onChange={setMetrica} className="mb-4" />
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={data.serie} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gMetrica" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={m.cor} stopOpacity={m.tipo === 'barra' ? 1 : 0.35} /><stop offset="100%" stopColor={m.cor} stopOpacity={m.tipo === 'barra' ? 0.55 : 0} /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="periodo" tickFormatter={(p) => nomePeriodo(p, agrupar)} fontSize={12} tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={m.k === 'receita' ? (v) => `R$${v >= 1000 ? `${Math.round(v / 100) / 10}k` : v}` : undefined} domain={m.k === 'nota' ? [0, 10] : undefined} allowDecimals={m.k === 'conversao' || m.k === 'nota'} />
                  <Tooltip content={<Tooltipe m={m} agrupar={agrupar} />} cursor={{ fill: 'rgb(99 102 241 / .06)' }} />
                  {m.tipo === 'barra'
                    ? <Bar dataKey={m.k} fill="url(#gMetrica)" radius={[6, 6, 0, 0]} isAnimationActive={false} maxBarSize={44} />
                    : <Area dataKey={m.k} stroke={m.cor} strokeWidth={2.5} fill="url(#gMetrica)" dot={data.serie.length < 40} isAnimationActive={false} connectNulls />}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </section>

          {data.relatorio && <Relatorio r={data.relatorio} nome={av.nome} imprimindo={imprimindo} quem={quem} />}

          <CasosVendedor v={av} />
        </div>
      )}
    </div>
  );
}
