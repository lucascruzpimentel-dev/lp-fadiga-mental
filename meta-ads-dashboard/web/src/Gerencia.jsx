import { useEffect, useState } from 'react';
import { getJson } from './api.js';
import { notaClass } from './shared.jsx';
import { Icon, Avatar, DeltaChip, Stat, Secao, Segmentado, Meter, Esqueleto, BotaoCopiar } from './ui.jsx';

const brl = (n) => (n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }));
const br = (d) => d.slice(8, 10) + '/' + d.slice(5, 7);
const PERIODOS = [['7', '7 dias'], ['14', '14 dias'], ['30', '30 dias'], ['60', '60 dias'], ['90', '90 dias']];

// Cor da decisão pela urgência.
const urgencia = (u) => (u >= 80 ? { cor: 'bg-rose-500', pilula: 'bg-rose-50 text-rose-700', rot: 'Urgente', borda: 'border-l-rose-500' } : u >= 65 ? { cor: 'bg-amber-500', pilula: 'bg-amber-50 text-amber-700', rot: 'Importante', borda: 'border-l-amber-400' } : { cor: 'bg-sky-500', pilula: 'bg-sky-50 text-sky-700', rot: 'Acompanhar', borda: 'border-l-sky-400' });

function Decisao({ d, i, onAbrir }) {
  const u = urgencia(d.urg);
  return (
    <li className={`card card-hover break-avoid fade-up border-l-4 p-5 ${u.borda}`}>
      <div className="flex flex-wrap items-start gap-3">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${u.cor}`}>{i + 1}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold leading-snug">{d.titulo}</h3>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${u.pilula}`}>{u.rot}</span>
            {d.em_jogo > 0 && <span className="num rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-semibold text-white">{brl(d.em_jogo)} em jogo</span>}
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-600"><span className="font-semibold text-slate-800">Por quê: </span>{d.porque}</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-800"><span className="font-semibold">O que fazer: </span>{d.acao}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {d.quem.map((q) => <span key={q} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"><Icon name="users" className="h-3.5 w-3.5" />{q}</span>)}
            {d.vendedor_id && <button onClick={() => onAbrir(d.vendedor_id)} className="no-print ml-auto text-xs font-semibold text-indigo-600 hover:underline">Ver o relatório →</button>}
          </div>
        </div>
      </div>
    </li>
  );
}

function Placar({ linhas, onAbrir }) {
  const maxR = Math.max(1, ...linhas.map((l) => l.receita)), maxP = Math.max(1, ...linhas.map((l) => l.valor_parado));
  return (
    <div className="card break-avoid overflow-x-auto">
      <table className="w-full min-w-[820px] text-sm">
        <thead><tr className="border-b border-slate-100 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">
          {['Vendedor', 'Carga', 'Vendas', 'Receita', 'Conversão', 'Nota', '1ª resp.', 'Parado'].map((c, k) => <th key={c} className={`px-4 py-3 ${k ? 'text-right' : ''}`}>{c}</th>)}
        </tr></thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.id} onClick={() => l.id !== 'sem-responsavel' && onAbrir(l.id)} className={`border-b border-slate-50 transition last:border-0 hover:bg-slate-50/70 ${l.id !== 'sem-responsavel' ? 'cursor-pointer' : ''}`}>
              <td className="px-4 py-3"><div className="flex items-center gap-2.5"><Avatar nome={l.nome} className="h-8 w-8 text-xs" /><span className="font-semibold">{l.nome}</span></div></td>
              <td className="px-4 py-3"><div className="ml-auto flex w-32 items-center justify-end gap-2"><Meter pct={l.carga_pct} cor={l.carga_pct >= 50 ? '#f43f5e' : '#6366f1'} className="w-16" /><span className="num w-12 text-right text-slate-600">{l.carga_pct}%</span></div><p className="num text-right text-[11px] text-slate-400">{l.conversas} conversas</p></td>
              <td className="num px-4 py-3 text-right">{l.vendas}</td>
              <td className="px-4 py-3"><div className="ml-auto flex w-40 items-center justify-end gap-2"><Meter pct={(l.receita / maxR) * 100} cor="#10b981" className="w-20" /><span className="num w-20 text-right font-semibold">{brl(l.receita)}</span></div></td>
              <td className="num px-4 py-3 text-right">{l.conversao != null ? `${l.conversao}%` : '—'}<p className="text-[11px] text-slate-400">{l.comerciais} comerciais</p></td>
              <td className="px-4 py-3 text-right">{l.nota != null ? <span className={`num rounded-lg px-2 py-0.5 text-xs font-bold ${notaClass(l.nota)}`}>{l.nota}</span> : '—'}</td>
              <td className="num px-4 py-3 text-right text-slate-600">{l.primeira_resposta_min != null ? `${l.primeira_resposta_min} min` : '—'}</td>
              <td className="px-4 py-3"><div className="ml-auto flex w-40 items-center justify-end gap-2"><Meter pct={(l.valor_parado / maxP) * 100} cor="#f59e0b" className="w-20" /><span className="num w-20 text-right">{brl(l.valor_parado)}</span></div>{l.parado_qtd > 0 && <p className="num text-right text-[11px] text-slate-400">{l.parado_qtd} oportunidades</p>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const FAMILIA = { 'Evento (porta de entrada)': 'bg-sky-50 text-sky-700', 'Formação (alto ticket)': 'bg-violet-50 text-violet-700', 'Programa premium': 'bg-amber-50 text-amber-700', 'Serviço individual': 'bg-emerald-50 text-emerald-700', 'Programa': 'bg-emerald-50 text-emerald-700', 'Pós-venda': 'bg-slate-100 text-slate-600', 'Prospecção': 'bg-slate-100 text-slate-600' };

function ProdutoCard({ p }) {
  return (
    <div className="card card-hover break-avoid space-y-3 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-bold leading-snug">{p.nome}</h3>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${FAMILIA[p.familia] || 'bg-slate-100 text-slate-600'}`}>{p.familia}</span>
      </div>
      <p className="text-sm leading-relaxed text-slate-500">{p.descricao}</p>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-xs"><span className="w-20 text-slate-500">Conversas</span><Meter pct={p.conversas_pct} cor="#0ea5e9" className="flex-1" /><span className="num w-10 text-right font-semibold">{p.conversas_pct}%</span></div>
        <div className="flex items-center gap-2 text-xs"><span className="w-20 text-slate-500">Receita</span><Meter pct={p.receita_pct} cor="#10b981" className="flex-1" /><span className="num w-10 text-right font-semibold">{p.receita_pct}%</span></div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[['Vendas', `${p.vendas} · ${brl(p.receita)}`], ['Em aberto', `${p.ativas} ativas · ${brl(p.valor_aberto)}`], ['Interesse sem fechar', p.interesse_aberto]].map(([l, v]) => (
          <div key={l} className="rounded-xl bg-slate-50 px-2 py-2"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{l}</p><p className="num mt-0.5 text-xs font-semibold">{v}</p></div>
        ))}
      </div>
      {p.temas.length > 0 && <div className="flex flex-wrap items-center gap-1.5 text-xs"><span className="text-slate-400">O cliente pergunta:</span>{p.temas.map((t) => <span key={t.tema} className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">{t.tema} {t.pct}%</span>)}</div>}
      <p className="text-xs text-slate-500"><span className="font-semibold text-slate-700">Próximo passo: </span>{p.proximo}</p>
    </div>
  );
}

function Produtos({ produtos, leitura, meta, duplicadas }) {
  return (
    <div className="space-y-5">
      {leitura.length > 0 && (
        <div className="space-y-2">
          <h3 className="flex items-center gap-2 font-semibold"><Icon name="bulb" className="h-5 w-5 text-amber-500" /> Leitura de contexto</h3>
          <ul className="space-y-2">
            {leitura.map((l, i) => (
              <li key={i} className={`card break-avoid flex gap-3 border-l-4 p-4 text-sm leading-relaxed ${l.tom === 'atencao' ? 'border-l-amber-400' : 'border-l-sky-400'}`}>
                <Icon name={l.tom === 'atencao' ? 'alert' : 'chart'} className={`mt-0.5 h-5 w-5 shrink-0 ${l.tom === 'atencao' ? 'text-amber-500' : 'text-sky-500'}`} />
                <p>{l.texto}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">{[...produtos].filter((p) => p.id !== 'pos_venda').sort((a, b) => b.nivel - a.nivel || b.receita - a.receita).map((p) => <ProdutoCard key={p.id} p={p} />)}</div>
      <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">Os produtos são inferidos dos nomes de funil e etapa do HighLevel e do que a conversa cita ({meta.sem_produto} de {meta.total_conversas} conversas não citam produto). “Conversas” é a fatia do esforço do time e “Receita” é a fatia do dinheiro: quando as barras destoam, o esforço está no lugar errado.{duplicadas?.n > 0 ? ` “Oportunidades Gerais” reúne as vendas de todos os produtos: ${duplicadas.n} ${duplicadas.n === 1 ? 'venda aparece' : 'vendas aparecem'} também no funil do produto (${brl(duplicadas.valor)}) e foram contadas uma vez só.` : ''}</p>
    </div>
  );
}

function Pauta({ p }) {
  const texto = `1:1 com ${p.nome}\nElogio: ${p.elogio ? `${p.elogio.titulo}. ${p.elogio.evidencia}` : '—'}\n${p.focos.map((f, i) => `Foco ${i + 1}: ${f.titulo}. ${f.evidencia} ${f.acao}`).join('\n')}\nMeta: ${p.meta}`;
  return (
    <details className="card group break-avoid overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center gap-3 p-4 transition hover:bg-slate-50">
        <Avatar nome={p.nome} className="h-9 w-9 text-sm" />
        <span className="font-semibold">{p.nome}</span>
        {p.nota != null && <span className={`num rounded-lg px-2 py-0.5 text-xs font-bold ${notaClass(p.nota)}`}>nota {p.nota}</span>}
        <Icon name="chevron" className="ml-auto h-4 w-4 text-slate-400 transition group-open:rotate-180" />
      </summary>
      <div className="space-y-4 border-t border-slate-100 bg-slate-50/60 p-4 text-sm">
        {p.elogio && <div className="rounded-xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-200"><p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Comece elogiando</p><p className="mt-0.5 font-semibold text-emerald-900">{p.elogio.titulo}</p><p className="text-emerald-800">{p.elogio.evidencia}</p></div>}
        {p.focos.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Pontos para conversar</p>
            {p.focos.map((f, i) => (
              <div key={f.titulo} className="rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200"><p className="font-semibold">{i + 1}. {f.titulo}</p><p className="text-slate-500">{f.evidencia}</p><p className="mt-1"><span className="font-semibold">Combinado: </span>{f.acao}</p></div>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between rounded-xl bg-indigo-50 px-4 py-3 ring-1 ring-indigo-200"><p className="text-indigo-900"><span className="font-semibold">Meta até o próximo 1:1: </span>{p.meta}</p><BotaoCopiar texto={texto} rotulo="Copiar pauta" /></div>
      </div>
    </details>
  );
}

export default function Gerencia({ onAbrir }) {
  const [dias, setDias] = useState('30');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    setLoading(true);
    getJson(`/api/gerencia?dias=${dias}`).then((d) => { setData(d); setErro(''); }).catch((e) => setErro(e.message)).finally(() => setLoading(false));
  }, [dias]);

  const n = data?.numeros;
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 pb-10 pt-4">
      <header className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Painel do gerente</h1>
          <p className="text-sm text-slate-500">O que decidir esta semana, com os números que justificam</p>
        </div>
        <div className="flex items-center gap-3">
          {data?.mock && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Dados de demonstração</span>}
          <Segmentado opcoes={PERIODOS} valor={dias} onChange={setDias} />
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700"><Icon name="printer" className="h-4 w-4" /> Exportar PDF</button>
        </div>
      </header>
      {erro && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{erro}</p>}
      {!data && loading && <div className="space-y-4"><Esqueleto className="h-56" /><Esqueleto className="h-40" /><Esqueleto className="h-40" /></div>}

      {data && (
        <div className={`space-y-10 transition ${loading ? 'opacity-60' : ''}`}>
          <section className="fade-up relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-xl shadow-indigo-900/10 md:p-8">
            <span className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-indigo-500/25 blur-3xl" />
            <p className="relative text-xs font-semibold uppercase tracking-widest text-indigo-300">Resumo · {br(data.de)} a {br(data.ate)}</p>
            <p className="relative mt-2 max-w-3xl text-lg leading-relaxed">{data.resumo}</p>
            <div className="relative mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
              {[['Receita', brl(n.receita), n.receita, n.receita_ant, brl], ['Vendas', n.vendas, n.vendas, n.vendas_ant], ['Conversão', n.conversao != null ? `${n.conversao}%` : '—', n.conversao, n.conversao_ant, (v) => `${v} pts`], ['Pipeline ativo', brl(n.pipeline_ativo)], ['Parado +14 dias', brl(n.parado)]].map(([l, v, a, b, f]) => (
                <div key={l} className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-300">{l}</p>
                  <p className="num mt-0.5 text-xl font-bold">{v}</p>
                  {a != null && b != null && <div className="mt-1"><DeltaChip atual={a} anterior={b} formato={f} sufixo="" /></div>}
                </div>
              ))}
            </div>
          </section>

          {(data.cobertura_inicio && data.cobertura_inicio > data.de) && (
            <p className="flex gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900"><Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" /> As conversas só foram analisadas a partir de {br(data.cobertura_inicio)}. A conversão considera as vendas desse dia em diante, para a conta fechar.</p>
          )}
          {!data.vendas_disponiveis && <p className="flex gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900"><Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" /> As oportunidades do HighLevel ainda não foram sincronizadas. Sem elas não há vendas, receita nem dinheiro parado.</p>}

          <section className="space-y-4">
            <Secao icone="bulb" titulo="Decisões desta semana" dica="Em ordem de urgência. Cada uma diz por que, o que fazer e com quem." />
            {data.decisoes.length ? <ol className="space-y-3">{data.decisoes.map((d, i) => <Decisao key={d.id} d={d} i={i} onAbrir={onAbrir} />)}</ol> : <p className="card p-6 text-center text-sm text-slate-400">Nenhuma decisão urgente. Os números estão dentro do esperado.</p>}
          </section>

          <section className="space-y-4">
            <Secao icone="users" titulo="Placar do time" dica="Carga de trabalho, resultado e dinheiro parado de cada um. Clique numa linha para abrir o relatório." />
            <Placar linhas={data.placar} onAbrir={onAbrir} />
            <p className="text-xs text-slate-500">Conversão = vendas ÷ conversas comerciais (compra, dúvida de produto, pagamento ou interesse de compra). Suporte e eventos não entram, para não punir quem atende mais disso.</p>
          </section>

          <section className="space-y-4">
            <Secao icone="ticket" titulo="Produtos" dica="O que cada produto é, onde o time gasta as conversas e de onde vem o dinheiro" />
            <Produtos produtos={data.produtos} leitura={data.produtos_leitura || []} meta={data.produtos_meta || { sem_produto: 0, total_conversas: 0 }} duplicadas={data.duplicadas} />
          </section>

          <section className="space-y-4">
            <Secao icone="chat" titulo="Pauta dos 1:1" dica="O que conversar com cada vendedor: elogio, pontos de melhoria com evidência e uma meta" />
            <div className="space-y-2">{data.pauta.map((p) => <Pauta key={p.id} p={p} />)}</div>
          </section>
        </div>
      )}
    </div>
  );
}
