// Casos analisados do Instagram: cada pessoa que interagiu, com a análise da IA sobre a condução do social selling
// (personalização, qualificação, convite e follow-up), o diagnóstico por regra e a conversa completa ao clicar.
import { useEffect, useMemo, useRef, useState } from 'react';
import { getJson } from './api.js';
import { Icon, Avatar, Stat, Secao, Esqueleto, CopiarCampo, Conversa, Gaveta, Meter } from './ui.jsx';
import { notaClass } from './shared.jsx';
import { SeletorPeriodo, usePeriodo, consulta, br, nomeDia } from './periodo.jsx';

const PERMITIDOS = ['hoje', 'ontem', '7', '14', '30', 'custom'];
const tempo = (min) => (min == null ? '—' : min >= 1440 ? `${Math.round(min / 144) / 10} d` : min >= 60 ? `${Math.round(min / 6) / 10} h` : `${min} min`);
const corNota = (n) => (n == null ? '#94a3b8' : n >= 8 ? '#10b981' : n >= 6 ? '#f59e0b' : '#f43f5e');

const guarda = new Map();
function pedir(q) {
  const g = guarda.get(q);
  if (g && Date.now() - g.t < 60e3) return g.p;
  const p = getJson(`/api/instagram-casos?${q}`);
  p.catch(() => guarda.delete(q));
  guarda.set(q, { t: Date.now(), p });
  return p;
}

const FILTROS = [
  ['todos', 'Todos', () => true],
  ['aberto', 'Em aberto', (c) => c.aberto],
  ['sem', 'Sem resposta da equipe', (c) => !c.obteve_resposta],
  ['qual', 'Qualificados', (c) => c.qualificado],
  ['reuniao', 'Reunião agendada', (c) => c.reuniao],
  ['ia', 'Com análise da IA', (c) => !!c.ia],
  ['semia', 'Sem análise ainda', (c) => !c.ia],
  ['baixa', 'Nota baixa (≤ 5)', (c) => c.ia?.nota != null && c.ia.nota <= 5],
];

const DIMENSOES = [
  ['personalizacao', 'Personalização', 'A abordagem usa algo real do lead (filho atleta, modalidade, comentário) em vez de texto genérico.'],
  ['qualificacao', 'Qualificação', 'Faz perguntas que descobrem necessidade, momento e quem decide.'],
  ['convite', 'Convite para reunião', 'Convida com clareza para uma reunião, ligação, evento ou próximo passo.'],
  ['followup', 'Follow-up', 'Retoma o lead quando ele esfria ou deixa de responder.'],
];

// Análise da IA de um caso: etapa, notas por dimensão, o que fazer agora e uma mensagem pronta para enviar.
export function BlocoAnaliseIG({ ia }) {
  return (
    <div className="space-y-3 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400"><Icon name="sparkles" className="h-4 w-4" /> Análise da IA · social selling</p>
      <div className="flex flex-wrap gap-1.5 text-xs">
        <span className={`rounded-full px-2.5 py-1 font-semibold ${notaClass(ia.nota)}`}>Nota {ia.nota ?? '—'}</span>
        <span className="rounded-full bg-indigo-50 px-2.5 py-1 font-semibold text-indigo-700">{ia.etapa_rot || ia.etapa}</span>
        {ia.qualificado && <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">Lead qualificado</span>}
        {ia.produto && <span className="rounded-full bg-slate-200/70 px-2.5 py-1 text-slate-700">Interesse: {ia.produto}</span>}
        {ia.objecao && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-800">Objeção: {ia.objecao}</span>}
        {ia.desatualizada && <span className="rounded-full bg-slate-200/70 px-2.5 py-1 text-slate-600" title="A conversa continuou depois desta análise">análise anterior às últimas mensagens</span>}
      </div>
      {ia.resumo && <p className="text-sm leading-relaxed text-slate-700">{ia.resumo}</p>}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        {DIMENSOES.map(([k, rot, dica]) => (
          <div key={k} title={dica}>
            <div className="flex justify-between text-xs text-slate-600"><span>{rot}</span><span className="num font-semibold text-slate-900">{ia[k] ?? '—'}</span></div>
            <Meter pct={(ia[k] ?? 0) * 10} cor={corNota(ia[k])} className="mt-1" />
          </div>
        ))}
      </div>
      {ia.proxima_acao && <p className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-900"><span className="font-semibold">Próxima ação: </span>{ia.proxima_acao}</p>}
      {ia.mensagem_sugerida && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
          <div className="mb-1 flex items-center justify-between gap-2"><span className="text-xs font-bold uppercase tracking-wide text-emerald-700">Mensagem sugerida</span><CopiarCampo texto={ia.mensagem_sugerida} rotulo="copiar mensagem" /></div>
          <p className="whitespace-pre-wrap text-sm text-emerald-950">{ia.mensagem_sugerida}</p>
        </div>
      )}
      {ia.melhorias?.length > 0 && <div><p className="mb-1 text-xs font-bold uppercase tracking-wide text-amber-700">Onde melhorar</p><ul className="list-disc space-y-0.5 pl-5 text-sm text-slate-700">{ia.melhorias.map((t) => <li key={t}>{t}</li>)}</ul></div>}
    </div>
  );
}

function Detalhe({ c, onClose }) {
  const contato = [c.contato, c.telefone, c.email].filter(Boolean).join(' · ');
  return (
    <Gaveta aberta onClose={onClose}>
      <div className="space-y-5 p-5 pt-4">
        <div className="flex items-center gap-3 pr-12">
          <Avatar nome={c.contato.replace('@', '')} className="h-12 w-12 text-base" />
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold leading-tight">{c.contato}</h2>
            <p className="text-sm text-slate-500">{br(c.dia)} {c.hora} · {c.dono}{c.perfil ? ` · @${c.perfil}` : ''}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {c.telefone && <CopiarCampo texto={c.telefone} rotulo={c.telefone} icone="phone" />}
          {c.email && <CopiarCampo texto={c.email} rotulo="e-mail" icone="mail" />}
          <CopiarCampo texto={contato} rotulo="copiar contato" />
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs">
          {c.aberto ? <span className="rounded-full bg-rose-50 px-2.5 py-1 font-semibold text-rose-700">Em aberto há {tempo(c.espera_min)}</span> : <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">Sem pendência</span>}
          {c.obteve_resposta ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">1ª resposta da equipe em {tempo(c.primeira_espera_min)}</span> : <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">Equipe nunca respondeu</span>}
          {c.qualificado && <span className="rounded-full bg-violet-50 px-2.5 py-1 font-semibold text-violet-700">Falou de produto ou serviço</span>}
          {c.conducao && <span className="rounded-full bg-sky-50 px-2.5 py-1 font-semibold text-sky-700">Em condução</span>}
          {c.reuniao && <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">Reunião agendada</span>}
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{c.mensagens_cliente} do cliente · {c.mensagens_equipe} da equipe</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{c.quem_comecou === 'empresa' ? 'Equipe abordou' : 'Chamou primeiro'}</span>
          {c.estagio_crm && <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-indigo-700">CRM: {c.estagio_crm}</span>}
        </div>
        {c.ia ? <BlocoAnaliseIG ia={c.ia} /> : <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-600 ring-1 ring-slate-200">A IA ainda não analisou esta conversa. Ela analisa as conversas paradas há 2 h ou mais, a cada 30 minutos.</p>}
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400"><Icon name="chat" className="h-4 w-4" /> Conversa no Instagram</p>
          <Conversa id={c.id} />
        </div>
      </div>
    </Gaveta>
  );
}

// Onde a equipe pode melhorar: a média de cada dimensão nas conversas já analisadas.
function Analise({ ia, kpis }) {
  if (!ia.analisados) {
    return <p className="card px-4 py-6 text-center text-sm text-slate-500">A IA ainda não analisou conversas deste período. Ela analisa as conversas paradas há 2 h ou mais, até 25 a cada 30 minutos.</p>;
  }
  const medidas = DIMENSOES.map(([k, rot, dica]) => ({ k, rot, dica, v: ia[k] })).filter((m) => m.v != null);
  const pior = [...medidas].sort((a, b) => a.v - b.v)[0];
  return (
    <div className="card break-avoid space-y-4 p-5">
      <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
        {medidas.map((m) => (
          <div key={m.k} title={m.dica}>
            <div className="flex items-baseline justify-between text-sm"><span className="font-semibold text-slate-800">{m.rot}</span><span className="num text-lg font-bold" style={{ color: corNota(m.v) }}>{m.v}</span></div>
            <Meter pct={m.v * 10} cor={corNota(m.v)} className="mt-1" />
            <p className="mt-1 text-xs text-slate-400">{m.dica}</p>
          </div>
        ))}
      </div>
      {pior && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900"><span className="font-semibold">Ponto mais fraco: {pior.rot.toLowerCase()} ({pior.v}).</span> Média das {ia.analisados} conversas já analisadas ({kpis.analisados_pct}% dos casos do período), de 1 a 10.</p>}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Onde as conversas pararam</span>
        {ia.etapas.map((e) => <span key={e.etapa} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">{e.rot} <b className="num">{e.n}</b></span>)}
      </div>
      {ia.objecoes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Objeções citadas</span>
          {ia.objecoes.map((o) => <span key={o.texto} className="rounded-full bg-amber-50 px-2.5 py-1 text-xs text-amber-800">{o.texto}{o.n > 1 && <b className="num"> ×{o.n}</b>}</span>)}
        </div>
      )}
    </div>
  );
}

export default function InstagramCasos() {
  const [periodo, setPeriodo] = usePeriodo(PERMITIDOS);
  const [d, setD] = useState(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState('todos');
  const [aberto, setAberto] = useState(null);
  const [tudo, setTudo] = useState(false);
  const tabela = useRef(null);
  useEffect(() => {
    let vivo = true;
    setCarregando(true); setErro('');
    pedir(consulta(periodo)).then((x) => vivo && setD(x)).catch((e) => vivo && setErro(e.message)).finally(() => vivo && setCarregando(false));
    return () => { vivo = false; };
  }, [periodo]);
  useEffect(() => { setFiltro('todos'); setTudo(false); }, [periodo]);
  useEffect(() => setTudo(false), [filtro]);

  const f = FILTROS.find(([k]) => k === filtro)[2];
  const casos = d?.casos || [];
  const lista = useMemo(() => casos.filter(f), [casos, filtro]);
  const mostrar = tudo ? lista : lista.slice(0, 40);
  const k = d?.kpis;

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 pb-12 pt-4">
      <Secao icone="sparkles" titulo="Casos analisados · Instagram"
        dica={d?.disponivel ? `${d.de === d.ate ? nomeDia(d.de) : `${br(d.de)} a ${br(d.ate)}`} · pessoas que interagiram, com a análise da IA e a conversa` : 'Pessoas que interagiram, com a análise da IA e a conversa'}
        direita={<SeletorPeriodo periodo={periodo} setPeriodo={setPeriodo} permitidos={PERMITIDOS} maxDias={60} />} />

      {erro && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">Não consegui carregar: {erro}</p>}
      {!d && !erro && <div className="space-y-4"><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <Esqueleto key={i} className="h-28" />)}</div><Esqueleto className="h-64" /></div>}
      {d && !d.disponivel && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{d.motivo}</p>}

      {d?.disponivel && (
        <div className={carregando ? 'space-y-8 opacity-60 transition' : 'space-y-8 transition'}>
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat icon="users" label="Pessoas que interagiram" value={k.casos} hint="com ao menos uma mensagem" />
            <button type="button" className="text-left" onClick={() => { setFiltro('aberto'); tabela.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
              <Stat icon="alert" label="Em aberto" value={k.em_aberto} hint="esperando a equipe" tom="rose" className="h-full transition hover:ring-2 hover:ring-rose-200" />
            </button>
            <Stat icon="clock" label="Sem resposta da equipe" value={k.sem_resposta_equipe} hint="ninguém respondeu" tom="amber" />
            <Stat icon="checkCircle" label="Qualificados" value={k.qualificados} hint="falaram de produto ou serviço" tom="violet" />
            <Stat icon="clock" label="Reuniões" value={k.reunioes} hint="estágio no CRM" tom="emerald" />
            <Stat icon="sparkles" label="Analisados pela IA" value={`${k.analisados}`} hint={d.ia.nota != null ? `${k.analisados_pct}% dos casos · nota média ${d.ia.nota}` : `${k.analisados_pct}% dos casos`} tom="sky" />
          </section>

          <section className="space-y-3">
            <Secao icone="bulb" titulo="Onde a equipe pode melhorar" dica="Média da avaliação da IA nas conversas analisadas" />
            <Analise ia={d.ia} kpis={k} />
          </section>

          <section ref={tabela} className="scroll-mt-20 space-y-3">
            <Secao icone="folder" titulo="Casos" dica="Clique em um caso para ver a análise, a mensagem sugerida e a conversa." />
            <div className="no-print flex flex-wrap gap-2">
              {FILTROS.map(([id, rot, fn]) => {
                const n = casos.filter(fn).length;
                return <button key={id} onClick={() => setFiltro(id)} disabled={id !== 'todos' && !n} className={`rounded-full px-3 py-1 text-sm transition disabled:opacity-40 ${filtro === id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{rot} <span className="num font-semibold">{n}</span></button>;
              })}
            </div>
            <div className="card break-avoid overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead><tr className="border-b border-slate-100 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3">Quando</th><th className="px-4 py-3">Contato</th><th className="px-4 py-3">Última mensagem do lead</th><th className="px-4 py-3">Responsável</th><th className="px-4 py-3">Situação</th><th className="px-4 py-3">Análise da IA</th>
                </tr></thead>
                <tbody>
                  {mostrar.map((c) => (
                    <tr key={c.id} onClick={() => setAberto(c)} className="cursor-pointer border-b border-slate-50 align-top transition last:border-0 hover:bg-slate-50/70">
                      <td className="num px-4 py-3 text-slate-500">{br(c.dia)}<br /><span className="text-xs text-slate-400">{c.hora}</span></td>
                      <td className="px-4 py-3"><p className="font-semibold">{c.contato}</p><p className="text-xs text-slate-400">{c.telefone || (c.perfil ? `@${c.perfil}` : '')}</p></td>
                      <td className="max-w-xs px-4 py-3"><p className="line-clamp-2 text-slate-600">{c.ultima_msg || '—'}</p></td>
                      <td className="px-4 py-3 text-slate-600">{c.dono}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1 text-xs">
                          {c.aberto ? <span className="num rounded-full bg-rose-50 px-2 py-0.5 font-semibold text-rose-700">em aberto {tempo(c.espera_min)}</span> : <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">sem pendência</span>}
                          {!c.obteve_resposta && <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">sem resposta da equipe</span>}
                          {c.qualificado && <span className="rounded-full bg-violet-50 px-2 py-0.5 font-semibold text-violet-700">qualificado</span>}
                          {c.reuniao && <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">reunião</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {c.ia ? (
                          <div className="flex flex-wrap items-center gap-1.5 text-xs"><span className={`num rounded-full px-2 py-0.5 font-semibold ${notaClass(c.ia.nota)}`}>{c.ia.nota ?? '—'}</span><span className="rounded-full bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-700">{c.ia.etapa_rot}</span></div>
                        ) : <span className="text-xs text-slate-300">ainda não analisada</span>}
                      </td>
                    </tr>
                  ))}
                  {!mostrar.length && <tr><td colSpan="6" className="px-4 py-8 text-center text-slate-400">Nenhum caso neste filtro.</td></tr>}
                </tbody>
              </table>
              {lista.length > 40 && <button onClick={() => setTudo(!tudo)} className="no-print w-full border-t border-slate-100 py-2.5 text-sm font-semibold text-indigo-600 hover:bg-indigo-50">{tudo ? 'Mostrar menos' : `Ver todos (${lista.length})`}</button>}
            </div>
          </section>
        </div>
      )}
      {aberto && <Detalhe c={aberto} onClose={() => setAberto(null)} />}
    </div>
  );
}
