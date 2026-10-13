// Aba Instagram: social selling medido como funil de prospecção (abordar, ser respondido, qualificar, agendar reunião, vender).
// O topo responde de cara: quantas pessoas foram contactadas, quantas interagiram, quantas obtiveram resposta e quantas estão em aberto.
import { useEffect, useRef, useState } from 'react';
import { getJson } from './api.js';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { Icon, Avatar, Stat, Secao, Esqueleto, CopiarCampo, Conversa } from './ui.jsx';
import { SeletorPeriodo, usePeriodo, consulta, br, nomeDia } from './periodo.jsx';

const PERMITIDOS = ['hoje', 'ontem', '7', '14', '30', '60', '90', 'custom'];
const brl = (n) => (n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }));
const tempo = (min) => (min == null ? '—' : min >= 1440 ? `${Math.round(min / 144) / 10} dias` : min >= 60 ? `${Math.round(min / 6) / 10} h` : `${min} min`);
const TOM = { atencao: 'border-l-amber-400 bg-amber-50/60', info: 'border-l-sky-400 bg-sky-50/50' };

// Respostas do servidor ficam guardadas por 1 minuto: voltar a um período já visto é instantâneo.
const guarda = new Map();
function pedir(q) {
  const g = guarda.get(q);
  if (g && Date.now() - g.t < 60e3) return g.p;
  const p = getJson(`/api/instagram?${q}`);
  p.catch(() => guarda.delete(q));
  guarda.set(q, { t: Date.now(), p });
  return p;
}

// Funil de verdade: cada etapa é um trapézio que se estreita até a etapa seguinte. A largura usa escala suavizada
// (raiz), senão 613 contra 8 faria as últimas etapas sumirem; os números e as taxas são sempre os reais.
const COR_FUNIL = [['#6366f1', '#7c83f3'], ['#7c83f3', '#8f7cf0'], ['#8f7cf0', '#a672ee'], ['#a672ee', '#34b78f'], ['#34b78f', '#10a37a'], ['#10a37a', '#0b8a68']];
const largura = (n, max) => Math.max(22, Math.round(100 * Math.pow(Math.max(n, 0) / max, 0.42)));

function Funil({ etapas }) {
  const max = Math.max(1, etapas[0]?.n || 1);
  const w = etapas.map((e) => largura(e.n, max));
  return (
    <div className="card break-avoid p-4 sm:p-5">
      <div className="space-y-1">
        {etapas.map((e, i) => {
          const topo = w[i], base = i < etapas.length - 1 ? w[i + 1] : Math.max(14, w[i] - 8);
          const a = (100 - topo) / 2, b = (100 - base) / 2;
          const [c1, c2] = COR_FUNIL[i] || COR_FUNIL[COR_FUNIL.length - 1];
          const queda = e.pct_anterior != null && e.pct_anterior < 15;
          return (
            <div key={e.id} title={e.dica} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto] items-center gap-x-3 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_7.5rem]">
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight text-slate-800">{e.rot}</p>
                <p className="text-xs text-slate-400">{e.pct_total}% do total</p>
              </div>
              <div className="relative h-[60px]">
                <div className="absolute inset-0" style={{ clipPath: `polygon(${a}% 0, ${100 - a}% 0, ${100 - b}% 100%, ${b}% 100%)`, background: `linear-gradient(180deg, ${c1}, ${c2})` }} />
                <span className="num absolute inset-0 flex items-center justify-center text-xl font-bold text-white drop-shadow-sm">{e.n}</span>
              </div>
              <div className="text-right">
                {e.pct_anterior != null
                  ? <span className={`num inline-block rounded-full px-2.5 py-1 text-xs font-bold ${queda ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>↓ {e.pct_anterior}%</span>
                  : <span className="text-xs text-slate-400">ponto de partida</span>}
              </div>
            </div>
          );
        })}
      </div>
      <p className="pt-3 text-xs text-slate-400">A taxa ao lado de cada etapa é quanto passou da etapa de cima (vermelho: menos de 15%). A largura é suavizada para as etapas finais continuarem visíveis; os números são os reais. Qualificado e em condução vêm da conversa (o cliente falou de produto ou serviço, e a troca de mensagens). Reunião e venda vêm do estágio da oportunidade no HighLevel.</p>
    </div>
  );
}

// Faixa escura do topo: período, os quatro números que respondem "o que aconteceu com as pessoas" e a barra de resposta.
function Topo({ d, periodo, setPeriodo, carregando, onAberto }) {
  const g = d?.geral;
  const total = g ? Math.max(1, g.interagiram) : 1;
  const Num = ({ rotulo, valor, linha1, linha2, cor, onClick }) => {
    const Tag = onClick ? 'button' : 'div';
    return (
      <Tag type={onClick ? 'button' : undefined} onClick={onClick} className={`rounded-2xl bg-white/[0.06] p-4 text-left ring-1 ring-white/10 transition ${onClick ? 'hover:bg-white/10 hover:ring-white/25' : ''}`}>
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-300"><span className={`h-2 w-2 rounded-full ${cor}`} />{rotulo}</p>
        <p className="num mt-2 text-4xl font-bold leading-none tracking-tight sm:text-[2.6rem]">{valor}</p>
        <p className="mt-2 text-sm text-slate-300">{linha1}</p>
        {linha2 && <p className="text-xs text-slate-400">{linha2}</p>}
      </Tag>
    );
  };
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-5 text-white shadow-xl ring-1 ring-white/5 sm:p-7">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-pink-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -left-16 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-indigo-500 shadow-lg"><Icon name="chat" className="h-5 w-5 text-white" /></span>
          <div>
            <h2 className="text-xl font-bold leading-tight tracking-tight">Instagram · Social selling</h2>
            <p className="text-sm text-slate-300">{d ? (d.de === d.ate ? nomeDia(d.de) : `${br(d.de)} a ${br(d.ate)} · ${d.dias} dias`) : 'Carregando…'} · pessoas que a equipe procurou e como elas reagiram</p>
          </div>
        </div>
        <SeletorPeriodo periodo={periodo} setPeriodo={setPeriodo} permitidos={PERMITIDOS} escuro />
      </div>

      {!g ? (
        <div className="relative mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-white/10" />)}</div>
      ) : (
        <div className={`relative mt-6 transition ${carregando ? 'opacity-60' : ''}`}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Num rotulo="Pessoas contactadas" valor={g.contactadas} cor="bg-indigo-400" linha1={d.de === d.ate ? 'no dia' : `${g.abordagens_por_dia} por dia`} linha2={`+ ${g.chamaram_primeiro} chamaram primeiro`} />
            <Num rotulo="Interagiram" valor={g.interagiram} cor="bg-sky-400" linha1={`${g.interagiram_pct}% das ${g.conversas} pessoas`} linha2={`${g.sem_resposta_do_cliente} contactadas ainda não responderam`} />
            <Num rotulo="Obtiveram resposta" valor={g.obtiveram_resposta} cor="bg-emerald-400" linha1={`${g.obtiveram_pct}% de quem interagiu`} linha2="uma pessoa da equipe respondeu" />
            <Num rotulo="Em aberto" valor={g.em_aberto} cor="bg-rose-400" linha1="esperando a equipe agora" linha2={g.em_aberto_24h ? `${g.em_aberto_24h} há mais de 24 h · ver lista →` : 'ver lista →'} onClick={g.em_aberto ? onAberto : undefined} />
          </div>
          {g.interagiram > 0 && (
            <div className="mt-5">
              <div className="mb-1.5 flex items-center justify-between text-xs text-slate-300"><span>De quem interagiu ({g.interagiram})</span><span><b className="num text-emerald-300">{g.obtiveram_resposta}</b> receberam resposta · <b className="num text-rose-300">{g.interagiram - g.obtiveram_resposta}</b> nunca receberam</span></div>
              <div className="flex h-3 overflow-hidden rounded-full bg-white/10">
                <div className="bg-emerald-400 transition-all" style={{ width: `${(g.obtiveram_resposta / total) * 100}%` }} />
                <div className="bg-rose-400/80 transition-all" style={{ width: `${((g.interagiram - g.obtiveram_resposta) / total) * 100}%` }} />
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// Um lead que precisa de ação: contato com botões de copiar e, ao abrir, a conversa completa.
function LeadLinha({ c, tipo }) {
  const [aberto, setAberto] = useState(false);
  const contato = [c.contato, c.telefone, c.email].filter(Boolean).join(' · ');
  return (
    <div className="card break-avoid overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pr-3">
        <button onClick={() => setAberto(!aberto)} aria-expanded={aberto} className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left transition hover:bg-slate-50">
          <span className="font-semibold">{c.contato}</span>
          {c.perfil && <span className="text-xs font-medium text-slate-400">@{c.perfil}</span>}
          {c.etapa && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">{c.etapa}</span>}
          {tipo === 'vacuo' && c.parado_dias != null && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">{c.parado_dias === 0 ? 'mais de 24 h' : `${c.parado_dias} dia${c.parado_dias > 1 ? 's' : ''}`} sem retorno</span>}
          {tipo === 'qual' && c.parado_dias != null && <span className="text-xs text-slate-400">{c.parado_dias === 0 ? 'última mensagem hoje' : `última mensagem há ${c.parado_dias} dia${c.parado_dias === 1 ? '' : 's'}`}</span>}
          {c.valor > 0 && <span className="num text-xs font-semibold text-slate-600">{brl(c.valor)}</span>}
          <span className="text-xs text-slate-400">{c.dono}</span>
        </button>
        <div className="flex flex-wrap items-center gap-1.5">
          {c.telefone && <CopiarCampo texto={c.telefone} rotulo={c.telefone} icone="phone" />}
          {c.email && <CopiarCampo texto={c.email} rotulo="e-mail" icone="mail" />}
          <CopiarCampo texto={contato} rotulo="contato" />
        </div>
      </div>
      {c.ultima_msg && !aberto && (
        <p className="border-t border-slate-100 px-4 py-2 text-sm text-slate-500">
          <span className="font-semibold text-slate-600">{c.ultima_de === 'cliente' ? 'Cliente: ' : 'Equipe: '}</span>{c.ultima_msg}
        </p>
      )}
      {aberto && (
        <div className="space-y-3 border-t border-slate-100 bg-slate-50/60 p-4">
          {c.tipo && <p className="text-sm text-slate-700"><span className="font-semibold">Situação: </span>{c.tipo}.</p>}
          {c.mensagens_cliente > 0 && <p className="text-sm text-slate-500">O cliente mandou {c.mensagens_cliente} mensagem(ns) no período.</p>}
          {c.id ? (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400"><Icon name="chat" className="h-4 w-4" /> Conversa no Instagram</p>
              <Conversa id={c.id} />
            </div>
          ) : <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">Não há DM deste contato no período.</p>}
        </div>
      )}
    </div>
  );
}

function Lista({ itens, tipo, vazio }) {
  const [tudo, setTudo] = useState(false);
  if (!itens.length) return <p className="card px-4 py-6 text-center text-sm text-slate-500">{vazio}</p>;
  const mostrar = tudo ? itens : itens.slice(0, 8);
  return (
    <div className="space-y-2">
      {mostrar.map((c, i) => <LeadLinha key={`${c.id || c.opp_id}-${i}`} c={c} tipo={tipo} />)}
      {itens.length > 8 && <button onClick={() => setTudo(!tudo)} className="no-print w-full rounded-xl py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50">{tudo ? 'Mostrar menos' : `Ver todos (${itens.length})`}</button>}
    </div>
  );
}

function Vendedores({ linhas }) {
  return (
    <div className="card break-avoid overflow-x-auto">
      <table className="w-full min-w-[860px] text-sm">
        <thead><tr className="border-b border-slate-100 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">
          {['Quem', 'Contactadas', 'Interagiram', 'Receberam resposta', 'Em aberto', 'Qualificados', 'Reuniões', 'Vendas', 'Retorno'].map((c, k) => <th key={c} className={`px-4 py-3 ${k ? 'text-right' : ''}`}>{c}</th>)}
        </tr></thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.id} className="border-b border-slate-50 last:border-0">
              <td className="px-4 py-3"><div className="flex items-center gap-2.5"><Avatar nome={l.nome} className="h-8 w-8 text-xs" /><span className="font-semibold">{l.nome}</span></div></td>
              <td className="num px-4 py-3 text-right">{l.contactadas}</td>
              <td className="num px-4 py-3 text-right">{l.interagiram}</td>
              <td className="num px-4 py-3 text-right">{l.obtiveram_resposta}</td>
              <td className={`num px-4 py-3 text-right ${l.em_aberto >= 10 ? 'font-semibold text-rose-600' : ''}`}>{l.em_aberto}</td>
              <td className="num px-4 py-3 text-right">{l.qualificados}</td>
              <td className="num px-4 py-3 text-right font-semibold">{l.reunioes}</td>
              <td className="num px-4 py-3 text-right">{l.vendas}</td>
              <td className="num px-4 py-3 text-right text-slate-600">{tempo(l.mediana_retorno_min)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400">"Sem responsável" são contatos que ainda não foram atribuídos a ninguém no HighLevel e sem identificação na mensagem (o celular não informa quem escreveu).</p>
    </div>
  );
}

export default function Instagram() {
  const [periodo, setPeriodo] = usePeriodo(PERMITIDOS);
  const [d, setD] = useState(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const vacuo = useRef(null);
  useEffect(() => {
    let vivo = true;
    setCarregando(true); setErro('');
    pedir(consulta(periodo)).then((x) => vivo && setD(x)).catch((e) => vivo && setErro(e.message)).finally(() => vivo && setCarregando(false));
    return () => { vivo = false; };
  }, [periodo]);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 pb-12 pt-4">
      <Topo d={d?.disponivel ? d : null} periodo={periodo} setPeriodo={setPeriodo} carregando={carregando} onAberto={() => vacuo.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />

      {erro && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">Não consegui carregar: {erro}</p>}
      {!d && !erro && <div className="space-y-4"><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Esqueleto key={i} className="h-28" />)}</div><Esqueleto className="h-64" /></div>}
      {d && !d.disponivel && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{d.motivo || 'Sem dados de Instagram.'}</p>}

      {d?.disponivel && (
        <div className={carregando ? 'space-y-8 opacity-60 transition' : 'space-y-8 transition'}>
          {d.geral.conversas === 0 && <p className="rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-800">Nenhuma conversa de Instagram neste período.</p>}

          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat icon="users" label="Qualificados" value={d.geral.qualificados} hint={`${d.geral.em_conducao ?? 0} em condução (troca frequente)`} tom="violet" />
            <Stat icon="clock" label="Reuniões agendadas" value={d.geral.reunioes} hint={d.geral.qualificados ? `${Math.round((d.geral.reunioes / d.geral.qualificados) * 100)}% dos qualificados` : 'meta do canal'} tom="emerald" />
            <Stat icon="money" label="Vendas" value={d.geral.vendas} hint="estágio no CRM" tom="amber" />
            <Stat icon="chat" label="Retorno da equipe" value={tempo(d.geral.mediana_retorno_min)} hint={d.geral.retorno_1h_pct != null ? `${d.geral.retorno_1h_pct}% em até 1 h (8h às 21h)` : 'sem dados'} tom="sky" />
          </section>

          <section className="space-y-3">
            <Secao icone="bulb" titulo="O que os números dizem" />
            <ul className="space-y-2">
              {d.insights.map((x, i) => <li key={i} className={`rounded-xl border-l-4 px-4 py-3 text-sm leading-relaxed text-slate-700 ${TOM[x.tom] || TOM.info}`}>{x.texto}</li>)}
            </ul>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3"><Secao icone="trend" titulo="Funil do social selling" dica={`${br(d.de)} a ${br(d.ate)}`} /><Funil etapas={d.etapas} /></div>
            <div className="space-y-3">
              <Secao icone="chart" titulo={d.por_hora ? 'Abordagens por hora' : 'Abordagens por dia'} dica={`Retorno mediano ${tempo(d.geral.mediana_retorno_min)} · ${d.geral.retorno_1h_pct ?? '—'}% em até 1 h`} />
              <div className="card break-avoid p-4"><div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  {d.por_hora ? (
                    <BarChart data={d.por_hora} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="hora" tick={{ fontSize: 10 }} interval={2} /><YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip /><Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="abordagens" name="Abordagens iniciadas" fill="#6366f1" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                      <Bar dataKey="respostas" name="Mensagens recebidas" fill="#10b981" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    </BarChart>
                  ) : (
                    <AreaChart data={d.serie.map((x) => ({ ...x, dia: br(x.dia) }))} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="dia" tick={{ fontSize: 11 }} interval="preserveStartEnd" /><YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip /><Legend wrapperStyle={{ fontSize: 12 }} />
                      <Area type="monotone" dataKey="abordagens" name="Abordagens" stroke="#6366f1" fill="#6366f1" fillOpacity={0.15} strokeWidth={2} isAnimationActive={false} />
                      <Area type="monotone" dataKey="respostas" name="Responderam" stroke="#10b981" fill="#10b981" fillOpacity={0.2} strokeWidth={2} isAnimationActive={false} />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              </div></div>
            </div>
          </section>

          <section className="space-y-3"><Secao icone="users" titulo="Por vendedor" /><Vendedores linhas={d.vendedores} /></section>

          <section ref={vacuo} className="scroll-mt-20 space-y-3">
            <Secao icone="alert" titulo="Em aberto há mais de 24 h" dica="Pessoas que responderam e ninguém da equipe voltou. Os mais baratos de recuperar: já mostraram interesse." />
            <Lista itens={d.sem_retorno} tipo="vacuo" vazio="Ninguém esperando retorno há mais de 24 h. Bom sinal." />
          </section>

          <section className="space-y-3">
            <Secao icone="checkCircle" titulo="Qualificados ainda sem reunião" dica="A lista de trabalho para agendar: leads que falaram de produto ou serviço e ainda não viraram reunião." />
            <Lista itens={d.qualificados} tipo="qual" vazio="Nenhum lead qualificado aguardando reunião." />
          </section>

          <section className="space-y-3">
            <Secao icone="folder" titulo="Higiene do CRM" dica="O que não está registrado não aparece em relatório nenhum." />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Stat icon="alert" label="Só ativação" value={d.higiene.estabelecida_so_ativacao?.n ?? 0} hint={`de ${d.higiene.estabelecida_so_ativacao?.de ?? 0} em 'estabelecida/negociação'`} tom="amber" />
              <Stat icon="alert" label="Sem oportunidade" value={d.higiene.contatos_sem_oportunidade.n} hint={`${d.higiene.contatos_sem_oportunidade.pct}% dos contatos de DM`} tom="rose" />
              <Stat icon="clock" label="Para contactar" value={d.higiene.para_contactar} hint="ainda sem abordagem" tom="sky" />
              <Stat icon="clock" label="Em contato parados" value={d.higiene.em_contato_parados_7d} hint="sem movimento há 7+ dias" tom="amber" />
              <Stat icon="money" label="Venda aberta" value={d.higiene.venda_realizada_aberta.length} hint="em 'Venda realizada' sem ganho" tom="violet" />
            </div>
            {d.higiene.venda_realizada_aberta.length > 0 && (
              <div className="card break-avoid divide-y divide-slate-100 text-sm">
                {d.higiene.venda_realizada_aberta.map((v, i) => (
                  <div key={i} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                    <span className="font-semibold">{v.contato}</span>
                    <span className="text-slate-500">{v.dono} · <span className="num font-semibold text-slate-800">{brl(v.valor)}</span> · marcar como ganho no HighLevel?</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
