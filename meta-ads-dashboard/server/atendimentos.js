// Aba Atendimentos: casos do dia, relatório diário/semanal e insights.
// Lê só wa_analises / wa_mensagens (Supabase de WhatsApp). Sem credenciais ou com MOCK=1, usa dados de exemplo.
import { sb, nameOf } from './whatsapp.js';
import { mockCasos, mockConversa } from './mock-atendimentos.js';

const env = process.env;
export const usaMock = () => env.MOCK !== '0' && !env.SNAPSHOT_DIR && (env.MOCK === '1' || !(env.WA_SUPABASE_URL && env.WA_SUPABASE_SERVICE_ROLE_KEY));

// Dia e hora sempre no fuso de Brasília (UTC-3).
export const brt = (iso) => new Date(new Date(iso).getTime() - 3 * 3600e3).toISOString();
export const diaDe = (iso) => brt(iso).slice(0, 10);
export const horaDe = (iso) => brt(iso).slice(11, 16);
export const hojeBrt = () => brt(new Date().toISOString()).slice(0, 10);
export const addDias = (d, n) => new Date(new Date(d + 'T12:00:00Z').getTime() + n * 864e5).toISOString().slice(0, 10);
export const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
export const r1 = (n) => (n == null ? null : +n.toFixed(1));
export const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);

const CAMPOS = 'conversation_id,contact_id,inicio,categoria,sentimento,resolvido,nota,atendentes,oportunidade_venda,alerta,primeira_resposta_seg,qtd_mensagens,resumo,motivo,proxima_acao,pontos_fortes,pontos_melhoria';
const EXTRAS = 'contato_nome,contato_telefone,evidencias,canal'; // colunas opcionais: só existem depois que o fluxo do n8n for atualizado

// Quem completa nome e telefone do contato (registrado por vendas.js): a análise guarda só o ID do HighLevel.
let enriquecer = async (lista) => lista;
export const registrarEnriquecedor = (f) => { enriquecer = f; };

// Primeiro dia com conversa analisada. A conversão só pode considerar vendas desse dia em diante,
// senão vendas de um período maior seriam divididas por conversas de um período menor.
let coberturaInicio = null;
export const inicioCobertura = () => coberturaInicio;

export async function carregar(de, ate) {
  const rows = await enriquecer(await carregarBruto(de, ate));
  for (const a of rows) { const d = diaDe(a.inicio); if (!coberturaInicio || d < coberturaInicio) coberturaInicio = d; }
  return rows;
}

// Análises de Instagram (coluna canal = 'instagram') não entram nas notas, na conversão nem no ranking do WhatsApp:
// social selling é prospecção e é medido na aba Instagram. Sem a coluna, tudo é WhatsApp.
async function carregarBruto(de, ate) {
  if (usaMock()) return mockCasos(de, ate);
  const filtro = { order: 'inicio.asc', inicio: [`gte.${de}T03:00:00Z`, `lte.${addDias(ate, 1)}T02:59:59Z`] };
  let rows;
  try { rows = await sb('wa_analises', { select: `${CAMPOS},${EXTRAS}`, ...filtro }); }
  catch { rows = await sb('wa_analises', { select: CAMPOS, ...filtro }); } // colunas novas ainda não existem
  return rows.filter((a) => (a.canal || 'whatsapp') === 'whatsapp');
}

export const falhou = (a) => String(a.resumo || '').startsWith('FALHA NA ANÁLISE');

// Ordem de atenção: oportunidade aberta e cliente irritado primeiro.
function prioridade(a) {
  let p = 0;
  if (a.oportunidade_venda && !a.resolvido) p += 3;
  if (a.alerta && a.alerta !== 'nenhum') p += 2;
  if (a.sentimento === 'negativo') p += 2;
  if (!a.resolvido) p += 1;
  if (a.nota != null && a.nota <= 5) p += 1;
  return p;
}

export const caso = (a) => ({
  id: a.conversation_id, chave: `${a.conversation_id}|${a.inicio}`, dia: diaDe(a.inicio), hora: horaDe(a.inicio),
  contato: a.contato_nome || (a.contact_id ? `Contato …${String(a.contact_id).slice(-4)}` : '—'), telefone: a.contato_telefone || null, email: a.contato_email || null, evidencias: a.evidencias || [],
  categoria: a.categoria, sentimento: a.sentimento, resolvido: !!a.resolvido, nota: a.nota,
  vendedores: (a.atendentes?.length ? a.atendentes : []).map(nameOf),
  oportunidade: !!a.oportunidade_venda, alerta: a.alerta && a.alerta !== 'nenhum' ? a.alerta : null,
  primeira_resposta_min: a.primeira_resposta_seg == null ? null : r1(a.primeira_resposta_seg / 60),
  mensagens: a.qtd_mensagens, resumo: a.resumo, motivo: a.motivo, proxima_acao: a.proxima_acao || null,
  fortes: a.pontos_fortes || [], melhorias: a.pontos_melhoria || [], prioridade: prioridade(a),
});

function metricas(lista) {
  const ok = lista.filter((a) => !falhou(a));
  const resp = ok.filter((a) => a.primeira_resposta_seg != null).map((a) => a.primeira_resposta_seg / 60);
  return {
    conversas: ok.length,
    resolvidas_pct: pct(ok.filter((a) => a.resolvido).length, ok.length),
    nota: r1(avg(ok.filter((a) => a.nota != null).map((a) => a.nota))),
    primeira_resposta_min: r1(avg(resp)),
    sem_resposta: ok.filter((a) => a.alerta === 'cliente_sem_resposta').length,
    oportunidades_abertas: ok.filter((a) => a.oportunidade_venda && !a.resolvido).length,
    negativos: ok.filter((a) => a.sentimento === 'negativo').length,
  };
}

const CAT = { suporte_acesso: 'Suporte / acesso', outro: 'Outros', evento: 'Evento', duvida_produto: 'Dúvida sobre produto', compra: 'Compra', pagamento_financeiro: 'Pagamento', reclamacao: 'Reclamação', cancelamento_reembolso: 'Cancelamento / reembolso' };
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const variacao = (a, b) => (b ? Math.round(((a - b) / b) * 100) : null);

function insights(dia, cur, prev, semana, doDia) {
  const out = [];
  const v = variacao(cur.conversas, prev.conversas);
  if (v != null && Math.abs(v) >= 20) out.push({ tone: v > 0 ? 'info' : 'warn', text: `O volume de conversas ${v > 0 ? 'subiu' : 'caiu'} ${Math.abs(v)}% em relação à semana anterior (${cur.conversas} contra ${prev.conversas}).` });
  if (cur.primeira_resposta_min != null && prev.primeira_resposta_min != null && cur.primeira_resposta_min > prev.primeira_resposta_min * 1.25 && cur.primeira_resposta_min > 10)
    out.push({ tone: 'bad', text: `A primeira resposta está demorando mais: ${cur.primeira_resposta_min} min nesta semana contra ${prev.primeira_resposta_min} min na anterior.` });
  if (cur.nota != null && prev.nota != null && cur.nota <= prev.nota - 0.5)
    out.push({ tone: 'bad', text: `A nota média do atendimento caiu de ${prev.nota} para ${cur.nota}.` });
  if (cur.nota != null && prev.nota != null && cur.nota >= prev.nota + 0.5)
    out.push({ tone: 'good', text: `A nota média do atendimento subiu de ${prev.nota} para ${cur.nota}.` });
  if (pct(cur.sem_resposta, cur.conversas) >= 20)
    out.push({ tone: 'warn', text: `${cur.sem_resposta} conversas (${pct(cur.sem_resposta, cur.conversas)}%) terminaram sem retorno (o cliente parou de responder ou a equipe não voltou). Abra os casos para ver quem parou.` });
  if (doDia.oportunidades_abertas)
    out.push({ tone: 'good', text: `${doDia.oportunidades_abertas} oportunidade(s) de venda abertas neste dia. É onde a equipe deve agir primeiro.` });

  const porCat = {};
  semana.filter((a) => !falhou(a)).forEach((a) => { porCat[a.categoria] = (porCat[a.categoria] || 0) + 1; });
  const top = Object.entries(porCat).sort((a, b) => b[1] - a[1])[0];
  if (top) out.push({ tone: 'info', text: `Assunto mais frequente da semana: ${CAT[top[0]] || top[0]} (${pct(top[1], cur.conversas)}% das conversas).` });

  const porDia = {};
  semana.filter((a) => !falhou(a)).forEach((a) => { const d = diaDe(a.inicio); porDia[d] = (porDia[d] || 0) + 1; });
  const pico = Object.entries(porDia).sort((a, b) => b[1] - a[1])[0];
  if (pico) out.push({ tone: 'info', text: `Dia mais movimentado da semana: ${DIAS[new Date(pico[0] + 'T12:00:00Z').getUTCDay()]}, ${pico[0].slice(8)}/${pico[0].slice(5, 7)}, com ${pico[1]} conversas.` });
  if (!out.length) out.push({ tone: 'info', text: 'Sem variações relevantes em relação à semana anterior.' });
  return out;
}

export async function atendimentos(dia) {
  const lista = await carregar(addDias(dia, -13), dia);
  const doDia = lista.filter((a) => diaDe(a.inicio) === dia);
  const semanaAtual = lista.filter((a) => diaDe(a.inicio) > addDias(dia, -7));
  const semanaAnterior = lista.filter((a) => diaDe(a.inicio) <= addDias(dia, -7));

  const dias = [];
  for (let i = 13; i >= 0; i--) {
    const d = addDias(dia, -i);
    const m = metricas(lista.filter((a) => diaDe(a.inicio) === d));
    dias.push({ dia: d, conversas: m.conversas, nota: m.nota, resolvidas_pct: m.resolvidas_pct, sem_resposta: m.sem_resposta });
  }
  const casos = doDia.filter((a) => !falhou(a)).map(caso).sort((a, b) => b.prioridade - a.prioridade || a.hora.localeCompare(b.hora));
  const mDia = metricas(doDia), cur = metricas(semanaAtual), prev = metricas(semanaAnterior);
  return {
    dia, mock: usaMock(), falhas: doDia.filter(falhou).length,
    kpis_dia: mDia, semana: { atual: cur, anterior: prev },
    insights: insights(dia, cur, prev, semanaAtual, mDia),
    dias, casos,
  };
}

export async function conversa(id) {
  if (!/^[\w-]{3,80}$/.test(id)) throw new Error('id inválido');
  if (usaMock()) return mockConversa(id);
  const rows = await sb('wa_mensagens', { select: 'conversation_id,direcao,user_id,origem,tipo_mensagem,corpo,enviada_em', conversation_id: `eq.${id}`, order: 'enviada_em.asc' });
  const texto = (m) => m.corpo ?? m.texto ?? m.body ?? m.mensagem ?? m.message ?? m.conteudo ?? m.content ?? null;
  return {
    texto_disponivel: rows.some((m) => texto(m) != null),
    mensagens: rows.map((m) => ({
      quando: `${diaDe(m.enviada_em).slice(8)}/${diaDe(m.enviada_em).slice(5, 7)} ${horaDe(m.enviada_em)}`,
      de: m.direcao === 'inbound' ? 'cliente' : m.origem === 'workflow' ? 'automação' : 'atendente',
      quem: m.direcao === 'inbound' ? 'Cliente' : m.origem === 'workflow' ? 'Automação' : (m.user_id ? nameOf(m.user_id) : 'Atendente'),
      texto: texto(m),
    })),
  };
}
