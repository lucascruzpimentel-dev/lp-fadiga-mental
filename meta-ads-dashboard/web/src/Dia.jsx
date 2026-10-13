// Visão do dia: o que aconteceu nas mensagens reais, por canal (WhatsApp, Instagram) ou no geral.
// Não depende da IA: conta quem escreveu, quem foi respondido, por quem, em quanto tempo e quem ainda espera.
import { useEffect, useState } from 'react';
import { getJson } from './api.js';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { Icon, Avatar, Stat, Secao, Esqueleto, CopiarCampo, Conversa } from './ui.jsx';
import { CAT } from './shared.jsx';

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

function Kpis({ c }) {
  const semIA = c.ia.analisadas === 0;
  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <Stat icon="chat" label="Clientes escreveram" value={c.clientes} hint={<><span className="num">{c.recebidas}</span> mensagens · <span className="num">{c.novas}</span> novas conversas</>}>
        <p className="mt-0.5"><Ref ontem={c.ontem?.clientes} media={c.media_7.clientes} /></p>
      </Stat>
      <Stat icon="users" label="Respondidos por pessoa" value={`${c.pessoa_pct}%`} hint={<><span className="num">{c.por_pessoa}</span> de {c.clientes}</>} tom="emerald">
        <p className="mt-0.5"><Ref ontem={c.ontem?.por_pessoa} media={c.media_7.por_pessoa} /></p>
      </Stat>
      <Stat icon="sparkles" label="Só automação" value={c.so_automacao} hint="receberam apenas o robô" tom="violet" />
      <Stat icon="alert" label="Esperando agora" value={c.aguardando} hint={`${c.sem_resposta} sem nenhuma resposta`} tom={c.aguardando ? 'rose' : 'sky'} />
      <Stat icon="clock" label="1ª resposta (pessoa)" value={tempo(c.primeira_resposta_min)} hint={c.ate_1h_pct != null ? `${c.ate_1h_pct}% em até 1 h` : 'ninguém respondeu'} tom="amber">
        <p className="mt-0.5"><Ref ontem={c.ontem?.primeira_resposta_min} media={c.media_7.primeira_resposta_min} fmt={tempo} /></p>
      </Stat>
      <Stat icon="checkCircle" label="Resolvidas (IA)" value={semIA ? '—' : `${c.ia.resolvidas_pct}%`} hint={semIA ? 'IA ainda não analisou' : `${c.ia.resolvidas} de ${c.ia.analisadas} analisadas · ${c.ia.interesse_compra} com interesse de compra`} tom="sky" />
    </section>
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

function Espera({ c, mostrarCanal }) {
  const [aberto, setAberto] = useState(false);
  const contato = [c.contato, c.telefone, c.email].filter(Boolean).join(' · ');
  const grave = c.espera_min >= 240;
  return (
    <div className="card break-avoid overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pr-3">
        <button onClick={() => setAberto(!aberto)} aria-expanded={aberto} className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left transition hover:bg-slate-50">
          <span className="font-semibold">{c.contato}</span>
          {mostrarCanal && <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${CANAL[c.canal]?.cor}`}>{CANAL[c.canal]?.rot}</span>}
          <span className={`num rounded-full px-2 py-0.5 text-xs font-semibold ${grave ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>espera {tempo(c.espera_min)}</span>
          <span className="text-xs text-slate-400">desde {horaBrt(c.desde)}{c.dono ? ` · ${c.dono}` : ''}</span>
        </button>
        <div className="flex flex-wrap items-center gap-1.5">
          {c.telefone && <CopiarCampo texto={c.telefone} rotulo={c.telefone} icone="phone" />}
          {c.email && <CopiarCampo texto={c.email} rotulo="e-mail" icone="mail" />}
          <CopiarCampo texto={contato} rotulo="contato" />
        </div>
      </div>
      {!aberto && <p className="border-t border-slate-100 px-4 py-2 text-sm text-slate-500"><span className="font-semibold text-slate-600">Cliente: </span>{c.ultima_msg}</p>}
      {aberto && <div className="border-t border-slate-100 bg-slate-50/60 p-4"><Conversa id={c.id} /></div>}
    </div>
  );
}

function ListaEspera({ itens, mostrarCanal }) {
  const [tudo, setTudo] = useState(false);
  if (!itens.length) return <p className="card px-4 py-6 text-center text-sm text-slate-500">Ninguém esperando resposta. Bom sinal.</p>;
  const mostrar = tudo ? itens : itens.slice(0, 10);
  return (
    <div className="space-y-2">
      {mostrar.map((c) => <Espera key={c.id} c={c} mostrarCanal={mostrarCanal} />)}
      {itens.length > 10 && <button onClick={() => setTudo(!tudo)} className="no-print w-full rounded-xl py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50">{tudo ? 'Mostrar menos' : `Ver todos (${itens.length})`}</button>}
    </div>
  );
}

export default function Dia({ canal = 'geral' }) {
  const [dia, setDia] = useState(hojeBrt());
  const [d, setD] = useState(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  useEffect(() => {
    setCarregando(true); setErro('');
    getJson(`/api/dia?${new URLSearchParams({ dia })}`).then(setD).catch((e) => setErro(e.message)).finally(() => setCarregando(false));
  }, [dia]);
  const c = d?.canais?.[canal];

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 pb-12 pt-4">
      <Secao icone="chart" titulo={TITULO[canal]} dica={`${nomeDia(dia)} · contado direto nas mensagens, sem depender da IA`} direita={<NavDia dia={dia} setDia={setDia} />} />

      {erro && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">Não consegui carregar: {erro}</p>}
      {!d && !erro && <div className="space-y-4"><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <Esqueleto key={i} className="h-28" />)}</div><Esqueleto className="h-48" /></div>}
      {d && !d.disponivel && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{d.motivo}</p>}

      {c && (
        <div className={carregando ? 'space-y-8 opacity-60 transition' : 'space-y-8 transition'}>
          {d.parcial && <p className="rounded-xl bg-sky-50 px-4 py-2.5 text-sm text-sky-800">Dia em andamento: dados até {horaBrt(d.dados_ate).slice(6)}. Os números crescem ao longo do dia.</p>}

          <Kpis c={c} />

          <section className="space-y-3">
            <Secao icone="bulb" titulo="O que os números dizem" />
            <ul className="space-y-2">{(c.insights || []).map((x, i) => <li key={i} className={`rounded-xl border-l-4 px-4 py-3 text-sm leading-relaxed text-slate-700 ${TOM[x.tom] || TOM.info}`}>{x.texto}</li>)}</ul>
          </section>

          {canal === 'geral' && <section className="space-y-3"><Secao icone="folder" titulo="WhatsApp e Instagram lado a lado" /><Comparativo canais={d.canais} /></section>}

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
              <Secao icone="trend" titulo="Últimos 8 dias" dica="Clientes que escreveram e quantos foram respondidos por pessoa" />
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

          <section className="space-y-3">
            <Secao icone="alert" titulo="Esperando resposta agora" dica="A última mensagem é do cliente e ninguém voltou. Do mais antigo para o mais recente." />
            <ListaEspera itens={c.lista_aguardando} mostrarCanal={canal === 'geral'} />
          </section>

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

          {c.ia.analisadas > 0 && c.ia.categorias.length > 0 && (
            <section className="space-y-3">
              <Secao icone="folder" titulo="Motivos do contato (IA)" dica={`Das ${c.ia.analisadas} conversas já analisadas`} />
              <div className="flex flex-wrap gap-2">{c.ia.categorias.map((k) => <span key={k.categoria} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">{CAT[k.categoria] || k.categoria} <b className="num">{k.n}</b></span>)}</div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
