// Visão do dia: o que aconteceu nas mensagens reais, por canal (WhatsApp, Instagram) ou no geral.
// Conta quem escreveu, quem foi respondido, por quem, em quanto tempo e quem ainda espera, e traz junto o que a IA
// já analisou (nota, resolvido, resumo, próxima ação). Mesma estrutura da visão de casos: números do dia, lista com
// filtros e detalhe de cada caso, semana contra semana anterior, gráficos e leitura.
import { useEffect, useMemo, useRef, useState } from 'react';
import { getJson } from './api.js';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { Icon, Avatar, Stat, Secao, Esqueleto, CopiarCampo, Conversa, Gaveta, DeltaChip } from './ui.jsx';
import { CAT, ALERTA, notaClass } from './shared.jsx';
import { BlocoAnaliseIG } from './InstagramCasos.jsx';

const iso = (d) => d.toISOString().slice(0, 10);
const hojeBrt = () => iso(new Date(Date.now() - 3 * 3600e3));
const addDias = (d, n) => iso(new Date(new Date(d + 'T12:00:00Z').getTime() + n * 864e5));
const br = (d) => d.slice(8, 10) + '/' + d.slice(5, 7);
const SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const nomeDia = (d) => `${SEMANA[new Date(d + 'T12:00:00Z').getUTCDay()]}, ${br(d)}`;
const tempo = (min) => (min == null ? '—' : min >= 1440 ? `${Math.round(min / 144) / 10} d` : min >= 60 ? `${Math.round(min / 6) / 10} h` : `${min} min`);
const horaBrt = (isoStr) => { const d = new Date(new Date(isoStr).getTime() - 3 * 3600e3); return `${br(d.toISOString().slice(0, 10))} ${d.toISOString().slice(11, 16)}`; };
const TOM = { atencao: 'border-l-amber-400 bg-amber-50/60', info: 'border-l-sky-400 bg-sky-50/50' };
const CANAL = { whatsapp: { rot: 'WhatsApp', cor: 'bg-emerald-50 text-emerald-700' }, instagram: { rot: 'Instagram', cor: 'bg-pink-50 text-pink-700' } };
const TITULO = { geral: 'Visão geral do dia', whatsapp: 'O dia no WhatsApp', instagram: 'O dia no Instagram' };
const ESTADO = { pessoa: ['Respondido por pessoa', 'bg-emerald-50 text-emerald-700'], automacao: ['Só automação', 'bg-violet-50 text-violet-700'], sem_resposta: ['Sem resposta', 'bg-rose-50 text-rose-700'] };

// Respostas do servidor ficam guardadas por 1 minuto: trocar de canal (Geral, WhatsApp, Instagram) usa a mesma resposta.
const guarda = new Map();
function pedirDia(dia) {
  const g = guarda.get(dia);
  if (g && Date.now() - g.t < 60e3) return g.p;
  const p = getJson(`/api/dia?${new URLSearchParams({ dia })}`);
  p.catch(() => guarda.delete(dia));
  guarda.set(dia, { t: Date.now(), p });
  return p;
}

const FILTROS = [
  ['todos', 'Todos', () => true],
  ['espera', 'Esperando resposta', (c) => c.esperando],
  ['sem', 'Sem nenhuma resposta', (c) => c.estado === 'sem_resposta'],
  ['auto', 'Só automação', (c) => c.estado === 'automacao'],
  ['pessoa', 'Respondidos por pessoa', (c) => c.estado === 'pessoa'],
  ['oport', 'Oportunidades (IA)', (c) => c.ia?.oportunidade && !c.ia?.resolvido],
  ['aberto', 'Não resolvidos (IA)', (c) => c.ia && c.ia.tipo !== 'ig' && !c.ia.resolvido],
  ['alerta', 'Com alerta (IA)', (c) => !!c.ia?.alerta],
  ['baixa', 'Nota baixa (≤ 5)', (c) => c.ia?.nota != null && c.ia.nota <= 5],
];

function NavDia({ dia, setDia }) {
  const hoje = hojeBrt();
  const Chip = ({ ativo, onClick, children }) => <button onClick={onClick} className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${ativo ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{children}</button>;
  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      <button onClick={() => setDia(addDias(dia, -1))} className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm hover:bg-slate-200" aria-label="Dia anterior">←</button>
      <input type="date" value={dia} max={hoje} onChange={(e) => e.target.value && setDia(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1 text-sm" />
      <button onClick={() => dia < hoje && setDia(addDias(dia, 1))} disabled={dia >= hoje} className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm hover:bg-slate-200 disabled:opacity-40" aria-label="Próximo dia">→</button>
      <Chip ativo={dia === hoje} onClick={() => setDia(hoje)}>Hoje</Chip>
      <Chip ativo={dia === addDias(hoje, -1)} onClick={() => setDia(addDias(hoje, -1))}>Ontem</Chip>
    </div>
  );
}

// "ontem X · média 7d Y" embaixo do número.
const Ref = ({ ontem, media, fmt = (v) => v }) => (
  <span>{ontem != null && <>ontem <b className="num text-slate-700">{fmt(ontem)}</b></>}{ontem != null && media != null && ' · '}{media != null && <>média 7d <b className="num text-slate-700">{fmt(media)}</b></>}</span>
);

function Kpis({ c, onEspera }) {
  const semIA = c.ia.analisadas === 0;
  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <Stat icon="chat" label="Clientes escreveram" value={c.clientes} hint={<><span className="num">{c.recebidas}</span> mensagens · <span className="num">{c.novas}</span> novas</>}>
        <p className="mt-0.5"><Ref ontem={c.ontem?.clientes} media={c.media_7.clientes} /></p>
      </Stat>
      <Stat icon="users" label="Respondidos por pessoa" value={`${c.pessoa_pct}%`} hint={<><span className="num">{c.por_pessoa}</span> de {c.clientes}</>} tom="emerald">
        <p className="mt-0.5"><Ref ontem={c.ontem?.por_pessoa} media={c.media_7.por_pessoa} /></p>
      </Stat>
      <Stat icon="sparkles" label="Só automação" value={c.so_automacao} hint="receberam apenas o robô" tom="violet" />
      <button type="button" onClick={onEspera} className="text-left" title="Ver a lista de quem espera resposta">
        <Stat icon="alert" label="Esperando agora" value={c.aguardando} hint={`${c.sem_resposta} sem nenhuma resposta`} tom={c.aguardando ? 'rose' : 'sky'} className="h-full ring-rose-200 transition hover:ring-2" />
      </button>
      <Stat icon="clock" label="1ª resposta (pessoa)" value={tempo(c.primeira_resposta_min)} hint={c.ate_1h_pct != null ? `${c.ate_1h_pct}% em até 1 h` : 'ninguém respondeu'} tom="amber">
        <p className="mt-0.5"><Ref ontem={c.ontem?.primeira_resposta_min} media={c.media_7.primeira_resposta_min} fmt={tempo} /></p>
      </Stat>
      <Stat icon="checkCircle" label="Resolvidas (IA)" value={semIA ? '—' : `${c.ia.resolvidas_pct}%`} hint={semIA ? 'IA ainda não analisou' : `${c.ia.resolvidas} de ${c.ia.analisadas} analisadas · ${c.ia.interesse_compra} com interesse de compra`} tom="sky" />
    </section>
  );
}

// Semana contra a semana anterior: mesmos indicadores da visão de casos, agora sobre as mensagens reais.
function Semana({ c, canal }) {
  const a = c.semana.atual, b = c.semana.anterior;
  const comIA = canal !== 'instagram';
  const T = (v) => tempo(Math.round(v));
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      <Stat icon="chat" label="Clientes" value={a.clientes}><DeltaChip atual={a.clientes} anterior={b.clientes} sufixo="vs semana ant." /></Stat>
      <Stat icon="users" label="Respondidos por pessoa" value={`${a.pessoa_pct}%`} tom="emerald"><DeltaChip atual={a.pessoa_pct} anterior={b.pessoa_pct} formato={(v) => `${v} pts`} sufixo="vs semana ant." /></Stat>
      <Stat icon="clock" label="1ª resposta" value={tempo(a.primeira_resposta_min)} tom="amber"><DeltaChip atual={a.primeira_resposta_min} anterior={b.primeira_resposta_min} melhor={false} formato={T} sufixo="vs semana ant." /></Stat>
      <Stat icon="alert" label="Sem nenhuma resposta" value={a.sem_resposta} tom="rose"><DeltaChip atual={a.sem_resposta} anterior={b.sem_resposta} melhor={false} sufixo="vs semana ant." /></Stat>
      {comIA && <Stat icon="checkCircle" label="Resolvidas (IA)" value={a.analisadas ? `${a.resolvidas_pct}%` : '—'} tom="sky"><DeltaChip atual={a.resolvidas_pct} anterior={b.resolvidas_pct} formato={(v) => `${v} pts`} sufixo="vs semana ant." /></Stat>}
      {comIA && <Stat icon="sparkles" label="Nota média (IA)" value={a.nota ?? '—'} tom="violet"><DeltaChip atual={a.nota} anterior={b.nota} sufixo="vs semana ant." /></Stat>}
    </div>
  );
}

// Lado a lado dos canais, para a visão geral.
function Comparativo({ canais }) {
  const linhas = [
    ['Clientes que escreveram', (c) => c.clientes],
    ['Mensagens recebidas', (c) => c.recebidas],
    ['Respondidos por pessoa', (c) => `${c.por_pessoa} (${c.pessoa_pct}%)`],
    ['Só automação', (c) => c.so_automacao],
    ['Sem nenhuma resposta', (c) => c.sem_resposta],
    ['Esperando agora', (c) => c.aguardando],
    ['1ª resposta de pessoa (mediana)', (c) => tempo(c.primeira_resposta_min)],
    ['Mensagens enviadas por pessoa', (c) => c.enviadas],
    ['Mensagens de automação', (c) => c.automacao],
    ['Analisadas pela IA', (c) => c.ia.analisadas],
    ['Resolvidas (IA)', (c) => (c.ia.analisadas ? `${c.ia.resolvidas} (${c.ia.resolvidas_pct}%)` : '—')],
  ];
  return (
    <div className="card break-avoid overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead><tr className="border-b border-slate-100 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">
          <th className="px-4 py-3">Indicador</th><th className="px-4 py-3 text-right text-emerald-700">WhatsApp</th><th className="px-4 py-3 text-right text-pink-700">Instagram</th><th className="px-4 py-3 text-right">Total</th>
        </tr></thead>
        <tbody>
          {linhas.map(([rot, f]) => (
            <tr key={rot} className="border-b border-slate-50 last:border-0">
              <td className="px-4 py-2.5 font-medium text-slate-700">{rot}</td>
              <td className="num px-4 py-2.5 text-right">{f(canais.whatsapp)}</td>
              <td className="num px-4 py-2.5 text-right">{f(canais.instagram)}</td>
              <td className="num px-4 py-2.5 text-right font-semibold">{f(canais.geral)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Atendentes({ linhas }) {
  if (!linhas.length) return <p className="card px-4 py-6 text-center text-sm text-slate-500">Ninguém da equipe enviou mensagem neste dia.</p>;
  return (
    <div className="card break-avoid overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead><tr className="border-b border-slate-100 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">
          {['Quem', 'Clientes respondidos', 'Mensagens enviadas', '1ª resposta (mediana)'].map((c, k) => <th key={c} className={`px-4 py-3 ${k ? 'text-right' : ''}`}>{c}</th>)}
        </tr></thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.id} className="border-b border-slate-50 last:border-0">
              <td className="px-4 py-3"><div className="flex items-center gap-2.5"><Avatar nome={l.nome} className="h-8 w-8 text-xs" /><span className="font-semibold">{l.nome}</span></div></td>
              <td className="num px-4 py-3 text-right">{l.conversas}</td>
              <td className="num px-4 py-3 text-right">{l.mensagens}</td>
              <td className="num px-4 py-3 text-right text-slate-600">{tempo(l.primeira_resposta_min)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400">"Clientes respondidos" conta quem deu a primeira resposta humana ao cliente no dia. Mensagens do celular sem identificação entram como "Sem identificação".</p>
    </div>
  );
}

// Detalhe de um caso: contato com copiar, situação, o que a IA disse (se já analisou) e a conversa.
function Detalhe({ c, onClose }) {
  const contato = [c.contato, c.telefone, c.email].filter(Boolean).join(' · ');
  const ia = c.ia;
  return (
    <Gaveta aberta onClose={onClose}>
      <div className="space-y-5 p-5 pt-4">
        <div className="flex items-center gap-3 pr-12">
          <Avatar nome={c.contato.replace('@', '')} className="h-12 w-12 text-base" />
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold leading-tight">{c.contato}</h2>
            <p className="text-sm text-slate-500">{c.hora} · {CANAL[c.canal]?.rot}{c.atendente ? ` · ${c.atendente}` : ' · sem atendente identificado'}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {c.telefone && <CopiarCampo texto={c.telefone} rotulo={c.telefone} icone="phone" />}
          {c.email && <CopiarCampo texto={c.email} rotulo="e-mail" icone="mail" />}
          <CopiarCampo texto={contato} rotulo="copiar contato" />
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs">
          <span className={`rounded-full px-2.5 py-1 font-semibold ${ESTADO[c.estado][1]}`}>{ESTADO[c.estado][0]}</span>
          {c.esperando && <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">Esperando há {tempo(c.espera_min)}</span>}
          {c.primeira_resposta_min != null && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">1ª resposta em {tempo(c.primeira_resposta_min)}</span>}
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{c.mensagens_cliente} do cliente · {c.enviadas} da equipe · {c.automacao} automáticas</span>
        </div>

        {ia?.tipo === 'ig' ? <BlocoAnaliseIG ia={ia} /> : ia ? (
          <div className="space-y-3 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400"><Icon name="sparkles" className="h-4 w-4" /> Análise da IA</p>
            <div className="flex flex-wrap gap-1.5 text-xs">
              <span className={`rounded-full px-2.5 py-1 font-semibold ${notaClass(ia.nota)}`}>Nota {ia.nota ?? '—'}</span>
              <span className={`rounded-full px-2.5 py-1 font-semibold ${ia.resolvido ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{ia.resolvido ? 'Resolvido' : 'Em aberto'}</span>
              {ia.categoria && <span className="rounded-full bg-slate-200/70 px-2.5 py-1 text-slate-700">{CAT[ia.categoria] || ia.categoria}</span>}
              {ia.oportunidade && <span className="rounded-full bg-indigo-50 px-2.5 py-1 font-semibold text-indigo-700">Oportunidade de venda</span>}
              {ia.alerta && <span className="rounded-full bg-rose-50 px-2.5 py-1 font-semibold text-rose-700">{ALERTA[ia.alerta] || ia.alerta}</span>}
            </div>
            {ia.resumo && <p className="text-sm leading-relaxed text-slate-700">{ia.resumo}</p>}
            {ia.motivo && <p className="text-sm text-slate-600"><span className="font-semibold text-slate-800">Motivo do contato: </span>{ia.motivo}</p>}
            {ia.proxima_acao && <p className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-900"><span className="font-semibold">Próxima ação: </span>{ia.proxima_acao}</p>}
            {ia.melhorias?.length > 0 && <div><p className="mb-1 text-xs font-bold uppercase tracking-wide text-amber-700">Pontos de melhoria</p><ul className="list-disc space-y-0.5 pl-5 text-sm text-slate-700">{ia.melhorias.map((t) => <li key={t}>{t}</li>)}</ul></div>}
            {ia.fortes?.length > 0 && <div><p className="mb-1 text-xs font-bold uppercase tracking-wide text-emerald-700">Pontos fortes</p><ul className="list-disc space-y-0.5 pl-5 text-sm text-slate-700">{ia.fortes.map((t) => <li key={t}>{t}</li>)}</ul></div>}
          </div>
        ) : (
          <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-600 ring-1 ring-slate-200">A IA ainda não analisou esta conversa. Ela analisa cada conversa 2 h depois da última mensagem.</p>
        )}

        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400"><Icon name="chat" className="h-4 w-4" /> Conversa</p>
          <Conversa id={c.id} />
        </div>
      </div>
    </Gaveta>
  );
}

function Casos({ casos, mostrarCanal, filtro, setFiltro, onAbrir }) {
  const f = FILTROS.find(([k]) => k === filtro)[2];
  const lista = useMemo(() => casos.filter(f), [casos, filtro]);
  const [tudo, setTudo] = useState(false);
  useEffect(() => setTudo(false), [filtro]);
  const mostrar = tudo ? lista : lista.slice(0, 40);
  return (
    <div className="space-y-3">
      <div className="no-print flex flex-wrap gap-2">
        {FILTROS.map(([id, rot, fn]) => {
          const n = casos.filter(fn).length;
          return <button key={id} onClick={() => setFiltro(id)} disabled={id !== 'todos' && !n} className={`rounded-full px-3 py-1 text-sm transition disabled:opacity-40 ${filtro === id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{rot} <span className="num font-semibold">{n}</span></button>;
        })}
      </div>
      <div className="card break-avoid overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead><tr className="border-b border-slate-100 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">
            <th className="px-4 py-3">Hora</th><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Última mensagem do cliente</th><th className="px-4 py-3">Atendente</th><th className="px-4 py-3">Situação</th><th className="px-4 py-3 text-right">Nota IA</th>
          </tr></thead>
          <tbody>
            {mostrar.map((c) => (
              <tr key={c.id} onClick={() => onAbrir(c)} className="cursor-pointer border-b border-slate-50 align-top transition last:border-0 hover:bg-slate-50/70">
                <td className="num px-4 py-3 text-slate-500">{c.hora}</td>
                <td className="px-4 py-3">
                  <p className="font-semibold">{c.contato}</p>
                  <p className="flex flex-wrap items-center gap-x-2 text-xs text-slate-400">{c.telefone}{mostrarCanal && <span className={`rounded-full px-1.5 py-0.5 font-semibold ${CANAL[c.canal]?.cor}`}>{CANAL[c.canal]?.rot}</span>}</p>
                </td>
                <td className="max-w-xs px-4 py-3"><p className="line-clamp-2 text-slate-600">{c.ultima_msg || '—'}</p>{c.ia?.categoria && <p className="mt-0.5 text-xs text-slate-400">{CAT[c.ia.categoria] || c.ia.categoria}</p>}</td>
                <td className="px-4 py-3 text-slate-600">{c.atendente || <span className="text-slate-400">—</span>}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1 text-xs">
                    <span className={`rounded-full px-2 py-0.5 font-semibold ${ESTADO[c.estado][1]}`}>{ESTADO[c.estado][0]}</span>
                    {c.esperando && <span className="num rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">espera {tempo(c.espera_min)}</span>}
                    {c.ia && c.ia.tipo !== 'ig' && <span className={`rounded-full px-2 py-0.5 font-semibold ${c.ia.resolvido ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{c.ia.resolvido ? 'Resolvido' : 'Em aberto'}</span>}
                    {c.ia?.tipo === 'ig' && <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-700">{c.ia.etapa_rot}</span>}
                    {c.ia?.oportunidade && !c.ia.resolvido && <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-700">Oportunidade</span>}
                    {c.ia?.alerta && <span className="rounded-full bg-rose-50 px-2 py-0.5 font-semibold text-rose-700">{ALERTA[c.ia.alerta] || c.ia.alerta}</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">{c.ia?.nota != null ? <span className={`num rounded-full px-2 py-0.5 text-xs font-semibold ${notaClass(c.ia.nota)}`}>{c.ia.nota}</span> : <span className="text-slate-300">—</span>}</td>
              </tr>
            ))}
            {!mostrar.length && <tr><td colSpan="6" className="px-4 py-8 text-center text-slate-400">Nenhum caso neste filtro.</td></tr>}
          </tbody>
        </table>
        {lista.length > 40 && <button onClick={() => setTudo(!tudo)} className="no-print w-full border-t border-slate-100 py-2.5 text-sm font-semibold text-indigo-600 hover:bg-indigo-50">{tudo ? 'Mostrar menos' : `Ver todos (${lista.length})`}</button>}
      </div>
    </div>
  );
}

export default function Dia({ canal = 'geral' }) {
  const [dia, setDia] = useState(hojeBrt());
  const [d, setD] = useState(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState('todos');
  const [aberto, setAberto] = useState(null);
  const tabela = useRef(null);
  useEffect(() => {
    let vivo = true;
    setCarregando(true); setErro('');
    pedirDia(dia).then((x) => vivo && setD(x)).catch((e) => vivo && setErro(e.message)).finally(() => vivo && setCarregando(false));
    return () => { vivo = false; };
  }, [dia]);
  useEffect(() => setFiltro('todos'), [canal, dia]);
  const c = d?.canais?.[canal];
  const casos = useMemo(() => {
    if (!d?.disponivel) return [];
    const l = canal === 'geral' ? [...d.canais.whatsapp.casos, ...d.canais.instagram.casos] : d.canais[canal].casos;
    return canal === 'geral' ? l.sort((a, b) => (b.esperando - a.esperando) || ((b.espera_min || 0) - (a.espera_min || 0)) || b.hora.localeCompare(a.hora)) : l;
  }, [d, canal]);
  const irParaEspera = () => { setFiltro('espera'); tabela.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 pb-12 pt-4">
      <Secao icone="chart" titulo={TITULO[canal]} dica={`${nomeDia(dia)} · contado direto nas mensagens, sem depender da IA`} direita={<NavDia dia={dia} setDia={setDia} />} />

      {erro && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">Não consegui carregar: {erro}</p>}
      {!d && !erro && <div className="space-y-4"><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <Esqueleto key={i} className="h-28" />)}</div><Esqueleto className="h-48" /><Esqueleto className="h-64" /></div>}
      {d && !d.disponivel && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{d.motivo}</p>}

      {c && (
        <div className={carregando ? 'space-y-8 opacity-60 transition' : 'space-y-8 transition'}>
          {d.parcial && <p className="rounded-xl bg-sky-50 px-4 py-2.5 text-sm text-sky-800">Dia em andamento: dados até {horaBrt(d.dados_ate).slice(6)}. Os números crescem ao longo do dia.</p>}

          <Kpis c={c} onEspera={irParaEspera} />

          <section className="space-y-3">
            <Secao icone="bulb" titulo="O que os números dizem" />
            <ul className="space-y-2">{(c.insights || []).map((x, i) => <li key={i} className={`rounded-xl border-l-4 px-4 py-3 text-sm leading-relaxed text-slate-700 ${TOM[x.tom] || TOM.info}`}>{x.texto}</li>)}</ul>
          </section>

          <section ref={tabela} className="scroll-mt-20 space-y-3">
            <Secao icone="folder" titulo="Casos do dia" dica="Todo cliente que escreveu, com a análise da IA quando já existe. Clique para ver o caso e a conversa." />
            <Casos casos={casos} mostrarCanal={canal === 'geral'} filtro={filtro} setFiltro={setFiltro} onAbrir={setAberto} />
          </section>

          {canal === 'geral' && <section className="space-y-3"><Secao icone="folder" titulo="WhatsApp e Instagram lado a lado" /><Comparativo canais={d.canais} /></section>}

          <section className="space-y-3">
            <Secao icone="trend" titulo="Semana" dica="Últimos 7 dias contra os 7 anteriores" />
            <Semana c={c} canal={canal} />
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              <Secao icone="clock" titulo="Por hora do dia" dica="Quando os clientes escrevem e quando a equipe responde" />
              <div className="card break-avoid p-4"><div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={c.por_hora} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="hora" tick={{ fontSize: 10 }} interval={2} /><YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip /><Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="recebidas" name="Recebidas" fill="#6366f1" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    <Line dataKey="respostas" name="Enviadas por pessoa" stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div></div>
            </div>
            <div className="space-y-3">
              <Secao icone="chart" titulo="Últimos 8 dias" dica="Clientes que escreveram e quantos foram respondidos por pessoa" />
              <div className="card break-avoid p-4"><div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={c.serie.map((x) => ({ ...x, dia: br(x.dia) }))} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="dia" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip /><Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="clientes" name="Clientes" fill="#c7d2fe" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    <Bar dataKey="por_pessoa" name="Respondidos por pessoa" fill="#10b981" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    <Line dataKey="sem_resposta" name="Sem resposta" stroke="#f43f5e" strokeWidth={2} dot={false} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div></div>
            </div>
          </section>

          <section className="space-y-3"><Secao icone="users" titulo="Quem respondeu" /><Atendentes linhas={c.atendentes} /></section>

          {c.lista_lentas?.length > 0 && (
            <section className="space-y-3">
              <Secao icone="clock" titulo="Respostas que demoraram mais de 1 hora" dica="Respondidas, mas tarde. Serve para conversar sobre cobertura de horário." />
              <div className="card break-avoid divide-y divide-slate-100 text-sm">
                {c.lista_lentas.map((l) => (
                  <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                    <span className="font-semibold">{l.contato}{canal === 'geral' && <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${CANAL[l.canal]?.cor}`}>{CANAL[l.canal]?.rot}</span>}</span>
                    <span className="text-slate-500">{l.dono || 'sem identificação'} · <span className="num font-semibold text-slate-800">{tempo(l.minutos)}</span></span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
      {aberto && <Detalhe c={aberto} onClose={() => setAberto(null)} />}
    </div>
  );
}
