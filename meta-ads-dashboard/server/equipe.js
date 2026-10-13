// Aba Equipe: nota geral do atendimento, nota individual e página de desempenho de cada vendedor.
// A nota é composta e transparente: cada componente é mostrado separado, com o peso e a regra.
import { sb, nameOf, THEMES, themeOf } from './whatsapp.js';
import { totais, carregarVendas, abertasPorVendedor, SEM_RESP } from './vendas.js';
import { carregar, caso, falhou, usaMock, brt, diaDe, addDias, avg, r1, pct, hojeBrt } from './atendimentos.js';

const env = process.env;
const H0 = Number(env.WA_HORARIO_INICIO || 8), H1 = Number(env.WA_HORARIO_FIM || 18); // horário comercial, seg–sex, Brasília

export const CRITERIO = {
  pesos: { qualidade: 0.55, agilidade: 0.2, resolucao: 0.25 },
  regras: {
    qualidade: 'Média das notas (1 a 10) que a IA deu às conversas, avaliando clareza, cordialidade, se respondeu o que foi perguntado e se conduziu para a solução ou a venda. É uma avaliação, não uma medição.',
    agilidade: `Tempo até a primeira resposta, só em conversas iniciadas em horário comercial (seg–sex, ${H0}h às ${H1}h). Até 5 min vale 10; a partir de 60 min vale 0.`,
    resolucao: 'Percentual de conversas em que a demanda do cliente foi resolvida.',
  },
  atribuicao: 'Uma conversa conta para a pessoa que mandou pelo menos 2 mensagens manuais nela, ou 30% ou mais das mensagens manuais. Conversas atendidas só por automação não entram na nota de ninguém.',
  amostra_minima: 10,
};

const comercial = (iso) => {
  const d = new Date(brt(iso));
  const dow = d.getUTCDay(), h = d.getUTCHours();
  return dow >= 1 && dow <= 5 && h >= H0 && h < H1;
};
const clamp = (n) => Math.max(0, Math.min(10, n));
const agil = (min) => clamp(10 - (min - 5) * (10 / 55));

// Nota composta de um conjunto de conversas. Componentes sem dados saem do cálculo e os pesos são reajustados.
export function pontuar(lista) {
  const ok = lista.filter((a) => !falhou(a));
  const notas = ok.filter((a) => a.nota != null).map((a) => a.nota);
  const rapidas = ok.filter((a) => a.primeira_resposta_seg != null && comercial(a.inicio)).map((a) => agil(a.primeira_resposta_seg / 60));
  const semResp = ok.filter((a) => a.alerta === 'cliente_sem_resposta').length;
  const comp = {
    qualidade: avg(notas),
    agilidade: avg(rapidas),
    resolucao: ok.length ? (10 * ok.filter((a) => a.resolvido).length) / ok.length : null,
  };
  let soma = 0, peso = 0;
  for (const [k, w] of Object.entries(CRITERIO.pesos)) if (comp[k] != null) { soma += comp[k] * w; peso += w; }
  const tempos = ok.filter((a) => a.primeira_resposta_seg != null && comercial(a.inicio)).map((a) => a.primeira_resposta_seg / 60);
  return {
    conversas: ok.length,
    nota: peso ? r1(soma / peso) : null,
    componentes: Object.fromEntries(Object.entries(comp).map(([k, v]) => [k, r1(v)])),
    medido: {
      primeira_resposta_min: r1(avg(tempos)),
      resolvidas_pct: pct(ok.filter((a) => a.resolvido).length, ok.length),
      sem_resposta: semResp,
      oportunidades_abertas: ok.filter((a) => a.oportunidade_venda && !a.resolvido).length,
    },
  };
}

// Quem atendeu cada conversa. Usa as mensagens manuais por pessoa; sem acesso a elas, cai para a lista de atendentes da análise.
export async function atribuicao(lista, de, ate) {
  const porAnalise = () => new Map(lista.map((a) => [a.conversation_id, a.atendentes || []]));
  if (usaMock()) return porAnalise();
  try {
    const msgs = await sb('wa_mensagens', {
      select: 'conversation_id,direcao,user_id,origem',
      enviada_em: [`gte.${de}T03:00:00Z`, `lte.${addDias(ate, 1)}T02:59:59Z`],
    });
    const cont = new Map();
    for (const m of msgs) {
      if (m.direcao !== 'outbound' || m.origem !== 'app' || !m.user_id) continue;
      const c = cont.get(m.conversation_id) || {};
      c[m.user_id] = (c[m.user_id] || 0) + 1;
      cont.set(m.conversation_id, c);
    }
    const out = new Map();
    for (const a of lista) {
      const c = cont.get(a.conversation_id) || {};
      const tot = Object.values(c).reduce((s, n) => s + n, 0);
      out.set(a.conversation_id, Object.entries(c).filter(([, n]) => n >= 2 || n / tot >= 0.3).sort((a, b) => b[1] - a[1]).map(([id]) => id)); // o primeiro é o principal
    }
    return out;
  } catch { return porAnalise(); }
}

const tema = (k) => THEMES.find((t) => t.key === k);

export function vendedor(id, lista, anterior, principais = lista, vendas = [], abertas = null) {
  const p = pontuar(lista), pa = pontuar(anterior);
  const casos = lista.filter((a) => !falhou(a)).map(caso).sort((a, b) => (b.dia + b.hora).localeCompare(a.dia + a.hora));

  // Padrões que se repetem, com os casos que provam cada um.
  const temas = new Map();
  for (const c of casos) for (const m of c.melhorias) {
    const k = themeOf(m);
    if (k === 'outros') continue;
    const t = temas.get(k) || { chave: k, n: 0, casos: [] };
    t.n++; if (t.casos.length < 3 && !t.casos.includes(c.id)) t.casos.push(c.id);
    temas.set(k, t);
  }
  const padroes = [...temas.values()].sort((a, b) => b.n - a.n).slice(0, 4).map((t) => ({ tema: tema(t.chave).label, n: t.n, dica: tema(t.chave).tip, casos: t.casos }));

  // Para revisar: pior primeiro. Elogiar: os melhores.
  const grave = (c) => c.alerta && c.alerta !== 'cliente_sem_resposta'; // "sem retorno" é ambíguo (cliente ou equipe), não pesa sozinho
  const gravidade = (c) => (grave(c) ? 3 : 0) + (c.sentimento === 'negativo' ? 2 : 0) + (c.nota != null ? 10 - c.nota : 0) + (c.evidencias.length ? 1 : 0);
  const revisar = [...casos].filter((c) => (c.nota != null && c.nota <= 6) || grave(c) || c.evidencias.length).sort((a, b) => gravidade(b) - gravidade(a)).slice(0, 6).map((c) => c.chave);
  const bons = [...casos].filter((c) => c.nota != null && c.nota >= 9 && c.resolvido).slice(0, 3).map((c) => c.chave);

  const porDia = new Map();
  for (const a of lista.filter((x) => !falhou(x))) { const d = diaDe(a.inicio); porDia.set(d, [...(porDia.get(d) || []), a]); }
  const evolucao = [...porDia.entries()].sort().map(([dia, l]) => ({ dia, conversas: l.length, nota: pontuar(l).nota }));

  return {
    id, nome: nameOf(id), vendas: totais(principais, vendas), abertas, ...p, variacao: p.nota != null && pa.nota != null ? r1(p.nota - pa.nota) : null,
    amostra_pequena: p.conversas < CRITERIO.amostra_minima, padroes, revisar, bons, evolucao, casos,
  };
}

export async function equipe(dias = 30) {
  const ate = hojeBrt();
  const de = addDias(ate, -(dias - 1)), deAnt = addDias(ate, -(2 * dias - 1));
  const tudo = await carregar(deAnt, ate);
  const atual = tudo.filter((a) => diaDe(a.inicio) >= de);
  const anterior = tudo.filter((a) => diaDe(a.inicio) < de);
  const mapa = await atribuicao(tudo, deAnt, ate);
  const deles = (lista, id) => lista.filter((a) => (mapa.get(a.conversation_id) || []).includes(id));

  const vend = await carregarVendas(de, ate, tudo, mapa);
  const abertas = await abertasPorVendedor(tudo, mapa);
  const vendasDe = (id) => vend.lista.filter((v) => v.vendedor === id);
  const ids = [...new Set([...atual.flatMap((a) => mapa.get(a.conversation_id) || []), ...vend.lista.map((v) => v.vendedor)])];
  const g = pontuar(atual), ga = pontuar(anterior);
  const so_automacao = atual.filter((a) => !falhou(a) && !(mapa.get(a.conversation_id) || []).length).length;
  return {
    mock: usaMock(), vendas_disponiveis: vend.disponiveis, de, ate, dias, criterio: CRITERIO,
    geral: { ...g, vendas: totais(atual, vend.lista), variacao: g.nota != null && ga.nota != null ? r1(g.nota - ga.nota) : null, so_automacao },
    vendedores: ids.map((id) => vendedor(id, deles(atual, id), deles(anterior, id), atual.filter((a) => mapa.get(a.conversation_id)?.[0] === id), vendasDe(id), abertas.get(id) || null)).sort((a, b) => (b.nota ?? -1) - (a.nota ?? -1)),
  };
}
