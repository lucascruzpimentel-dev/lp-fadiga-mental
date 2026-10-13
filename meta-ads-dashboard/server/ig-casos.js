// Casos do Instagram: cada pessoa que interagiu no período, com o que a IA concluiu da conversa (quando já analisou)
// e o diagnóstico por regra (quem espera, em quanto tempo voltaram, estágio no CRM). É o equivalente do "Casos analisados"
// do WhatsApp, só que lendo o social selling: personalização, qualificação, convite e follow-up.
import { sb, nameOf } from './whatsapp.js';
import { usaMock, addDias, hojeBrt, brt, pct, r1, avg } from './atendimentos.js';
import { prepararConversas } from './instagram.js';
import { limparTexto } from './mensagens.js';

const MIN = 60e3;
const ETAPAS = { respondeu: 'Só respondeu', conversa: 'Conversa sem produto', qualificado: 'Qualificado', convite_feito: 'Convite feito', agendado: 'Agendado', recusou: 'Recusou', esfriou: 'Esfriou' };

const cache = new Map();
export async function casosInstagram({ dias, de, ate } = {}) {
  const hoje = hojeBrt();
  if (!de || !ate) { ate = hoje; de = addDias(ate, -((dias || 7) - 1)); }
  const chave = `${de}|${ate}`;
  const c = cache.get(chave);
  if (c && Date.now() - c.t < (ate >= hoje ? 60e3 : 5 * MIN)) return c.p;
  const p = calcular(de, ate);
  p.catch(() => { if (cache.get(chave)?.p === p) cache.delete(chave); });
  cache.set(chave, { t: Date.now(), p });
  if (cache.size > 30) cache.delete(cache.keys().next().value);
  return p;
}

async function calcular(de, ate) {
  if (usaMock()) return { disponivel: false, motivo: 'Sem acesso ao banco de mensagens (modo de exemplo).' };
  const [{ convs, agora, ultimaFalaCliente }, analises] = await Promise.all([
    prepararConversas(de, ate),
    sb('ig_analises', { select: 'conversation_id,analisada_em,ultima_msg_em,etapa,qualificado,interesse_produto,objecao,personalizacao,qualificacao,convite,followup,nota,resumo,proxima_acao,mensagem_sugerida,pontos_melhoria', ultima_msg_em: `gte.${addDias(de, -1)}T03:00:00Z`, order: 'ultima_msg_em.desc' }).catch(() => []),
  ]);
  const ia = new Map();
  for (const a of analises) if (!ia.has(a.conversation_id)) ia.set(a.conversation_id, a);

  const casos = convs.filter((c) => c.respondeu).map((c) => {
    const a = ia.get(c.id);
    return {
      id: c.id, contato: c.contato, perfil: c.perfil && c.contato !== `@${c.perfil}` ? c.perfil : null, telefone: c.telefone, email: c.email,
      dia: brt(c.primeira_fala_cliente).slice(0, 10), hora: brt(c.primeira_fala_cliente).slice(11, 16),
      quem_comecou: c.comecou, dono: nameOf(c.dono), mensagens_cliente: c.n_cliente, mensagens_equipe: c.n_equipe,
      aberto: c.aguardando_desde != null, espera_min: c.aguardando_desde != null ? Math.round((agora - c.aguardando_desde) / MIN) : null,
      obteve_resposta: c.obteve_resposta, primeira_espera_min: c.primeira_espera_min,
      qualificado: c.qualificado, conducao: c.conducao, estagio_crm: c.opp?.etapa_nome || null, reuniao: c.estagio != null && c.estagio >= 3,
      ultima_msg: ultimaFalaCliente.has(c.id) ? limparTexto(ultimaFalaCliente.get(c.id)) : null,
      ia: a ? { etapa: a.etapa, etapa_rot: ETAPAS[a.etapa] || a.etapa, qualificado: !!a.qualificado, produto: a.interesse_produto, objecao: a.objecao, personalizacao: a.personalizacao, qualificacao: a.qualificacao, convite: a.convite, followup: a.followup, nota: a.nota, resumo: a.resumo, proxima_acao: a.proxima_acao, mensagem_sugerida: a.mensagem_sugerida, melhorias: a.pontos_melhoria || [], desatualizada: Date.parse(a.ultima_msg_em) < Date.parse(new Date(c.ultima_em).toISOString()) - 60e3 } : null,
    };
  }).sort((a, b) => (b.aberto - a.aberto) || ((b.espera_min || 0) - (a.espera_min || 0)) || b.hora.localeCompare(a.hora));

  const analisados = casos.filter((c) => c.ia);
  const media = (k) => { const v = analisados.map((c) => c.ia[k]).filter((x) => x != null); return v.length ? r1(avg(v)) : null; };
  const etapas = {};
  for (const c of analisados) etapas[c.ia.etapa] = (etapas[c.ia.etapa] || 0) + 1;
  const objecoes = {};
  for (const c of analisados) if (c.ia.objecao) { const k = c.ia.objecao.toLowerCase().slice(0, 60); objecoes[k] = (objecoes[k] || 0) + 1; }

  return {
    disponivel: true, de, ate,
    kpis: { casos: casos.length, em_aberto: casos.filter((c) => c.aberto).length, sem_resposta_equipe: casos.filter((c) => !c.obteve_resposta).length, qualificados: casos.filter((c) => c.qualificado).length, reunioes: casos.filter((c) => c.reuniao).length, analisados: analisados.length, analisados_pct: pct(analisados.length, casos.length) },
    ia: { analisados: analisados.length, nota: media('nota'), personalizacao: media('personalizacao'), qualificacao: media('qualificacao'), convite: media('convite'), followup: media('followup'), etapas: Object.entries(etapas).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ etapa: k, rot: ETAPAS[k] || k, n })), objecoes: Object.entries(objecoes).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([texto, n]) => ({ texto, n })) },
    casos,
  };
}
