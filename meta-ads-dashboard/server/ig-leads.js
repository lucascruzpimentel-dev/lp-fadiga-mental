// Leads do social selling que já chegaram ao resultado: reunião agendada e venda. Não dependem do período escolhido:
// são sempre todos os que existem hoje no CRM, para o gerente nunca perder de vista quem está perto de fechar.
//  - Reunião agendada: oportunidade aberta em "Reunião Agendada" nos funis de social selling.
//  - Venda: oportunidade ganha, ou em "Venda realizada" nos funis de social selling, de quem tem conversa de Instagram.
// Cada lead traz a conversa (troca de mensagens) e a análise da IA quando existe.
import { sb, nameOf } from './whatsapp.js';
import { usaMock } from './atendimentos.js';
import { carregarContatos, rotular, tituloDe } from './contatos.js';
import { ehSocial, estagioDe } from './instagram.js';
import { deduplicar } from './vendas.js';
import { produtoDaOportunidade, produtoPorId } from './produtos.js';

const DIA = 864e5;
const ETAPAS = { respondeu: 'Só respondeu', conversa: 'Conversa sem produto', qualificado: 'Qualificado', convite_feito: 'Convite feito', agendado: 'Agendado', recusou: 'Recusou', esfriou: 'Esfriou' };

let cache = { t: 0, p: null };
export function leadsInstagram() {
  if (cache.p && Date.now() - cache.t < 60e3) return cache.p;
  const p = calcular();
  p.catch(() => { if (cache.p === p) cache = { t: 0, p: null }; });
  cache = { t: Date.now(), p };
  return p;
}

// Conversas de Instagram dos contatos (todas, de qualquer data): uma consulta por bloco de contatos, só a estrutura.
async function conversasDosContatos(ids) {
  const out = new Map(); // contact_id -> { conversas: Map(id -> {ultima, n, ultima_de}) }
  const unicos = [...new Set(ids)].filter((x) => /^[\w-]{3,80}$/.test(x));
  const blocos = [];
  for (let i = 0; i < unicos.length; i += 50) blocos.push(unicos.slice(i, i + 50));
  const paginas = await Promise.all(blocos.map((b) => sb('wa_mensagens', { select: 'conversation_id,contact_id,direcao,origem,enviada_em', tipo_mensagem: 'eq.IG', contact_id: `in.(${b.join(',')})`, order: 'enviada_em.asc' })));
  for (const m of paginas.flat()) {
    const c = out.get(m.contact_id) || out.set(m.contact_id, new Map()).get(m.contact_id);
    const v = c.get(m.conversation_id) || c.set(m.conversation_id, { id: m.conversation_id, n: 0, cliente: 0, ultima: m.enviada_em, ultima_de: 'cliente' }).get(m.conversation_id);
    v.n++; if (m.direcao === 'inbound') v.cliente++;
    v.ultima = m.enviada_em; v.ultima_de = m.direcao === 'inbound' ? 'cliente' : 'equipe';
  }
  return out;
}

async function calcular() {
  if (usaMock()) return { disponivel: false, motivo: 'Sem acesso ao banco de mensagens (modo de exemplo).' };
  const { contatos, opps } = await carregarContatos();
  const reuniaoOpps = opps.filter((o) => o.status === 'open' && ehSocial(o) && estagioDe(o) === 3);
  const vendaSocial = opps.filter((o) => ehSocial(o) && estagioDe(o) === 4);
  const ganhas = opps.filter((o) => o.status === 'won');

  // Quem tem conversa de Instagram: só essas vendas (ganhas em qualquer funil) são do social selling.
  const idsConsulta = [...reuniaoOpps, ...vendaSocial, ...ganhas].map((o) => o.contact_id).filter(Boolean);
  const [convs, analises, primeira] = await Promise.all([
    conversasDosContatos(idsConsulta),
    sb('ig_analises', { select: 'conversation_id,ultima_msg_em,etapa,qualificado,interesse_produto,objecao,personalizacao,qualificacao,convite,followup,nota,resumo,proxima_acao,mensagem_sugerida,pontos_melhoria', order: 'ultima_msg_em.desc' }).catch(() => []),
    sb('wa_mensagens', { select: 'enviada_em', tipo_mensagem: 'eq.IG', order: 'enviada_em.asc', limit: 1 }).catch(() => []),
  ]);
  const ia = new Map();
  for (const a of analises) if (!ia.has(a.conversation_id)) ia.set(a.conversation_id, a);

  // Venda fora dos funis de social selling só conta se for recente (90 dias) e de quem tem conversa de Instagram.
  const corte = Date.now() - 90 * DIA;
  const recentes = ganhas.filter((o) => convs.has(o.contact_id) && !ehSocial(o) && Date.parse(o.status_alterado_em || 0) >= corte);
  const vendasBrutas = [...vendaSocial, ...recentes];
  const { unicas: semDuplicar } = deduplicar([...new Map(vendasBrutas.map((o) => [o.id, o])).values()]);
  // Uma venda por pessoa: se há o card de "Venda realizada" do social selling e a oportunidade ganha do produto, vale a ganha.
  const porPessoa = new Map();
  for (const o of semDuplicar) {
    const k = o.contact_id || o.id, atual = porPessoa.get(k);
    if (!atual) { porPessoa.set(k, { o, extras: [] }); continue; }
    const novoMelhor = o.status === 'won' && atual.o.status !== 'won';
    if (novoMelhor) porPessoa.set(k, { o, extras: [...atual.extras, atual.o] }); else atual.extras.push(o);
  }
  const unicas = [...porPessoa.values()];

  const agora = Date.now();
  const lead = (o, tipo, extras = []) => {
    const k = contatos.get(o.contact_id);
    const r = rotular(k?.nome || o.contato_nome);
    const lista = [...(convs.get(o.contact_id)?.values() || [])].sort((a, b) => b.ultima.localeCompare(a.ultima));
    const principal = lista[0] || null;
    const a = principal ? ia.get(principal.id) : null;
    const data = tipo === 'venda' && o.status === 'won' ? o.status_alterado_em : o.atualizada_em;
    const quandoCrm = o.atualizada_em ? new Date(new Date(o.atualizada_em).getTime() - 3 * 3600e3).toISOString().slice(0, 10).split('-').reverse().slice(0, 2).join('/') : null;
    const motivo = tipo === 'reuniao'
      ? `No HighLevel, a oportunidade "${o.nome}" está na etapa "Reunião Agendada" do funil ${o.pipeline_nome}${quandoCrm ? ` (movida/atualizada em ${quandoCrm})` : ''}.`
      : o.status === 'won'
        ? `No HighLevel, a oportunidade "${o.nome}" (${o.pipeline_nome}) está marcada como GANHA.`
        : `No HighLevel, a oportunidade "${o.nome}" está na etapa "Venda realizada" do funil ${o.pipeline_nome}${quandoCrm ? ` (atualizada em ${quandoCrm})` : ''}. O ganho ainda não foi marcado: o time precisa marcar a oportunidade como ganha para a venda entrar na receita.`;
    return {
      id: o.id, tipo, oportunidade: o.nome, motivo, observacao: extras.length ? `Também no CRM: ${extras.map((e) => `${e.pipeline_nome} › ${e.etapa_nome}${Number(e.valor) ? ` (R$ ${Math.round(Number(e.valor)).toLocaleString('pt-BR')})` : ''}`).join('; ')}` : null, contact_id: o.contact_id, contato: tituloDe(r, o.contact_id), perfil: r.nome && r.perfil ? r.perfil : null,
      telefone: k?.telefone || o.contato_telefone || null, email: k?.email || o.contato_email || null,
      etapa: o.etapa_nome, funil: o.pipeline_nome, status: o.status, valor: Number(o.valor) || 0,
      produto: produtoDaOportunidade(o) === 'prospeccao' ? null : produtoPorId(produtoDaOportunidade(o)).nome, dono: o.responsavel_id ? nameOf(o.responsavel_id) : 'Sem responsável',
      data, dias: data ? Math.floor((agora - Date.parse(data)) / DIA) : null, ganha: o.status === 'won',
      conversa_id: principal?.id || null, conversas: lista.map((c) => ({ id: c.id, mensagens: c.n, ultima: c.ultima })),
      mensagens_cliente: principal?.cliente ?? 0, ultima_msg_em: principal?.ultima || null, ultima_de: principal?.ultima_de || null,
      ia: a ? { etapa: a.etapa, etapa_rot: ETAPAS[a.etapa] || a.etapa, qualificado: !!a.qualificado, produto: a.interesse_produto, objecao: a.objecao, personalizacao: a.personalizacao, qualificacao: a.qualificacao, convite: a.convite, followup: a.followup, nota: a.nota, resumo: a.resumo, proxima_acao: a.proxima_acao, mensagem_sugerida: a.mensagem_sugerida, melhorias: a.pontos_melhoria || [] } : null,
    };
  };
  const ordem = (a, b) => String(b.data).localeCompare(String(a.data));
  const reunioes = reuniaoOpps.map((o) => lead(o, 'reuniao')).sort(ordem);
  const vendas = unicas.map(({ o, extras }) => lead(o, 'venda', extras)).sort(ordem);
  return {
    disponivel: true, mensagens_desde: primeira[0]?.enviada_em || null,
    kpis: {
      reunioes: reunioes.length, vendas: vendas.length, vendas_ganhas: vendas.filter((v) => v.ganha).length, receita: vendas.filter((v) => v.ganha).reduce((s, v) => s + v.valor, 0),
      vendas_sem_ganho: vendas.filter((v) => !v.ganha).length, sem_conversa: [...reunioes, ...vendas].filter((l) => !l.conversa_id).length,
    },
    reunioes, vendas,
  };
}
