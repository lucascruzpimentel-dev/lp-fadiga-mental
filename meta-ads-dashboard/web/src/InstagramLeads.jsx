// Reuniões agendadas e vendas do social selling: sempre todos os leads que já chegaram ao resultado, sem depender de período.
// Cada lead abre a troca de mensagens do Instagram e a análise da IA, para o gerente conferir como a conversa foi conduzida.
import { useEffect, useState } from 'react';
import { getJson } from './api.js';
import { Icon, Avatar, Stat, Secao, Segmentado, Esqueleto, CopiarCampo, Conversa } from './ui.jsx';
import { BlocoAnaliseIG } from './InstagramCasos.jsx';
import { br } from './periodo.jsx';

const brl = (n) => (n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }));
const quando = (dias) => (dias == null ? '' : dias === 0 ? 'hoje' : dias === 1 ? 'ontem' : `há ${dias} dias`);
const DATA = (iso) => (iso ? br(new Date(new Date(iso).getTime() - 3 * 3600e3).toISOString().slice(0, 10)) : '');

function LeadCard({ l }) {
  const [aberto, setAberto] = useState(false);
  const [conv, setConv] = useState(l.conversa_id);
  const contato = [l.contato, l.telefone, l.email].filter(Boolean).join(' · ');
  const venda = l.tipo === 'venda';
  return (
    <div className={`card break-avoid overflow-hidden border-l-4 ${venda ? 'border-l-emerald-500' : 'border-l-indigo-500'}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pr-3">
        <button onClick={() => setAberto(!aberto)} aria-expanded={aberto} className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3.5 text-left transition hover:bg-slate-50">
          <Avatar nome={l.contato.replace('@', '')} className="h-9 w-9 text-xs" />
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-x-2">
              <span className="font-semibold">{l.contato}</span>
              {l.perfil && <span className="text-xs font-medium text-slate-400">@{l.perfil}</span>}
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${venda ? (l.ganha ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800') : 'bg-indigo-50 text-indigo-700'}`}>{venda ? (l.ganha ? 'Venda ganha' : 'Venda realizada · falta marcar o ganho') : 'Reunião agendada'}</span>
              {l.valor > 0 && <span className="num rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-semibold text-white">{brl(l.valor)}</span>}
            </span>
            <span className="mt-0.5 block text-xs text-slate-500"><span className="font-medium text-slate-700">{l.oportunidade}</span> · {l.funil} › {l.etapa} · {l.dono}{l.data ? ` · ${DATA(l.data)} (${quando(l.dias)})` : ''}</span>
          </span>
        </button>
        <div className="flex flex-wrap items-center gap-1.5">
          {l.telefone && <CopiarCampo texto={l.telefone} rotulo={l.telefone} icone="phone" />}
          {l.email && <CopiarCampo texto={l.email} rotulo="e-mail" icone="mail" />}
          <CopiarCampo texto={contato} rotulo="contato" />
          <button onClick={() => setAberto(!aberto)} className="no-print inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white hover:bg-slate-700"><Icon name="chat" className="h-3.5 w-3.5" /> {aberto ? 'Fechar' : 'Ver conversa'}</button>
        </div>
      </div>
      {!aberto && l.ia?.resumo && <p className="border-t border-slate-100 px-4 py-2.5 text-sm leading-relaxed text-slate-700"><span className="font-semibold text-slate-900">Resumo da conversa: </span>{l.ia.resumo}</p>}
      {!aberto && l.conversa_id && <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">{l.conversas[0].mensagens} mensagens · {l.mensagens_cliente} do lead · última {l.ultima_de === 'cliente' ? 'do lead' : 'da equipe'} em {DATA(l.ultima_msg_em)}{l.ia ? ` · IA: nota ${l.ia.nota ?? '—'}, ${l.ia.etapa_rot}` : l.conversa_id ? ' · resumo da IA a caminho' : ''}</p>}
      {!aberto && !l.conversa_id && <p className="border-t border-slate-100 px-4 py-2 text-sm text-amber-700">Sem DM de Instagram registrada para este contato.</p>}
      {aberto && (
        <div className="space-y-4 border-t border-slate-100 bg-slate-50/60 p-4">
          <p className={`rounded-xl px-3 py-2 text-sm ring-1 ${l.tipo === 'venda' && !l.ganha ? 'bg-amber-50 text-amber-900 ring-amber-200' : 'bg-white text-slate-600 ring-slate-200'}`}><span className="font-semibold">Por que está aqui: </span>{l.motivo}</p>
          {l.observacao && <p className="rounded-xl bg-white px-3 py-2 text-sm text-slate-600 ring-1 ring-slate-200">{l.observacao}</p>}
          {l.ia && <BlocoAnaliseIG ia={l.ia} />}
          {l.conversas.length > 1 && (
            <div className="flex flex-wrap gap-1.5 text-xs">{l.conversas.map((c, i) => <button key={c.id} onClick={() => setConv(c.id)} className={`rounded-full px-2.5 py-1 font-semibold ${conv === c.id ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700'}`}>Conversa {i + 1} · {c.mensagens} msgs · {DATA(c.ultima)}</button>)}</div>
          )}
          {conv ? (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400"><Icon name="chat" className="h-4 w-4" /> Troca de mensagens no Instagram</p>
              <Conversa id={conv} />
            </div>
          ) : <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">Este contato não tem DM de Instagram registrada. Confira a conversa no HighLevel.</p>}
        </div>
      )}
    </div>
  );
}

export default function InstagramLeads() {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState('');
  const [ver, setVer] = useState('todos');
  useEffect(() => { getJson('/api/instagram-leads').then(setD).catch((e) => setErro(e.message)); }, []);
  const k = d?.kpis;
  const lista = !d?.disponivel ? [] : ver === 'reuniao' ? d.reunioes : ver === 'venda' ? d.vendas.filter((v) => v.ganha) : ver === 'confirmar' ? d.vendas.filter((v) => !v.ganha) : [...d.reunioes, ...d.vendas].sort((a, b) => String(b.data).localeCompare(String(a.data)));

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 pb-12 pt-4">
      <Secao icone="checkCircle" titulo="Reuniões agendadas e vendas" dica="Todos os leads do social selling que já chegaram ao resultado, sempre atualizados. Abra um lead para ver a troca de mensagens." />

      {erro && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">Não consegui carregar: {erro}</p>}
      {!d && !erro && <div className="space-y-3"><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Esqueleto key={i} className="h-28" />)}</div><Esqueleto className="h-24" /><Esqueleto className="h-24" /></div>}
      {d && !d.disponivel && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{d.motivo}</p>}

      {d?.disponivel && (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat icon="clock" label="Reuniões agendadas" value={k.reunioes} hint="em 'Reunião Agendada' no CRM" tom="indigo" />
            <Stat icon="money" label="Vendas ganhas" value={k.vendas_ganhas} hint={k.vendas_sem_ganho ? `+ ${k.vendas_sem_ganho} em "Venda realizada" sem o ganho marcado` : 'ganho marcado no HighLevel'} tom="emerald" />
            <Stat icon="chart" label="Receita ganha" value={brl(k.receita)} hint="só vendas com ganho marcado" tom="amber" />
            <Stat icon="chat" label="Sem conversa" value={k.sem_conversa} hint="leads sem DM registrada" tom="sky" />
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-500">{lista.length} lead{lista.length === 1 ? '' : 's'}</p>
              <Segmentado opcoes={[['todos', `Todos (${k.reunioes + k.vendas})`], ['reuniao', `Reuniões (${k.reunioes})`], ['venda', `Vendas ganhas (${k.vendas_ganhas})`], ['confirmar', `Falta marcar o ganho (${k.vendas_sem_ganho})`]]} valor={ver} onChange={setVer} />
            </div>
            {lista.length === 0 && <p className="card px-4 py-8 text-center text-sm text-slate-500">Nenhum lead nesta categoria agora.</p>}
            <div className="space-y-3">{lista.map((l) => <LeadCard key={`${l.tipo}-${l.id}`} l={l} />)}</div>
          </section>

          {d.mensagens_desde && <p className="text-xs text-slate-400">O painel guarda as mensagens de Instagram a partir de {DATA(d.mensagens_desde)}. Em leads mais antigos, a troca de mensagens pode aparecer incompleta (o começo da conversa está no HighLevel).</p>}
          {k.vendas_sem_ganho > 0 && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{k.vendas_sem_ganho} lead(s) estão em "Venda realizada" no social selling, mas a oportunidade ainda não foi marcada como ganha no HighLevel. Eles já contam como venda aqui; falta o time marcar o ganho para entrarem na receita.</p>}
        </>
      )}
    </div>
  );
}
