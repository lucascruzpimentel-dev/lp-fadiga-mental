// Vendas e oportunidades. Fonte: oportunidades do HighLevel (tabela ghl_oportunidades, sincronizada pelo n8n).
// Venda = oportunidade com status "won"; a data da venda é a data do ganho; o vendedor é o responsável pela oportunidade.
// Ganho sem responsável: usa quem atendeu a conversa mais recente daquele contato; sem conversa, fica em "Sem responsável".
import { sb, NOMES_GHL } from './whatsapp.js';
import { usaMock, falhou, diaDe, addDias, registrarEnriquecedor, inicioCobertura } from './atendimentos.js';
import { produtoDaOportunidade, produtoDaConversa } from './produtos.js';

export const SEM_RESP = 'sem-responsavel';
const DIA_MS = 864e5;

// Nomes dos vendedores vêm da tabela ghl_usuarios (cache de 10 min).
let usuariosEm = 0;
async function carregarUsuarios() {
  if (usaMock() || Date.now() - usuariosEm < 600e3) return;
  usuariosEm = Date.now();
  try { for (const u of await sb('ghl_usuarios', { select: 'id,nome' })) if (u.nome) NOMES_GHL[u.id] = u.nome; } catch { /* tabela ainda não existe */ }
}

// Quem atendeu o contato: a conversa mais recente até a data da venda (mais 1 dia).
function indiceConversas(analises, mapa) {
  const porContato = new Map();
  for (const a of analises) {
    const v = mapa.get(a.conversation_id)?.[0];
    if (!a.contact_id || !v) continue;
    const l = porContato.get(a.contact_id) || [];
    l.push({ t: new Date(a.inicio).getTime(), v });
    porContato.set(a.contact_id, l);
  }
  return (contato, quando) => {
    const limite = new Date(quando).getTime() + DIA_MS;
    return (porContato.get(contato) || []).filter((x) => x.t <= limite).sort((a, b) => b.t - a.t)[0]?.v || null;
  };
}

// Vendas do período: [{ id, dia, valor, vendedor, contato, telefone, funil }]. "disponiveis" é falso se a tabela não existir.
export async function carregarVendas(de, ate, analises, mapa) {
  await carregarUsuarios();
  if (usaMock()) {
    const lista = analises.filter((a) => !falhou(a) && Number(a.venda_valor) > 0 && diaDe(a.inicio) >= de && diaDe(a.inicio) <= ate)
      .map((a) => ({ id: a.conversation_id, dia: diaDe(a.inicio), valor: Number(a.venda_valor), vendedor: mapa.get(a.conversation_id)?.[0] || SEM_RESP, contato: a.contato_nome, telefone: a.contato_telefone, funil: 'Exemplo', produto: 'pos_pse' }));
    return { disponiveis: true, lista };
  }
  try {
    const rows = await sb('ghl_oportunidades', {
      select: 'id,valor,responsavel_id,contact_id,contato_nome,contato_telefone,pipeline_nome,etapa_nome,status_alterado_em',
      status: 'eq.won', order: 'status_alterado_em.asc',
      status_alterado_em: [`gte.${de}T03:00:00Z`, `lte.${addDias(ate, 1)}T02:59:59Z`],
    });
    const { unicas, duplicadas } = deduplicar(rows);
    const quemAtendeu = indiceConversas(analises, mapa);
    // Venda em funil genérico (prospecção, qualificação): o produto vem do que a conversa com o cliente cita.
    const convDoContato = new Map();
    for (const a of analises) if (a.contact_id && !falhou(a) && (!convDoContato.get(a.contact_id) || a.inicio > convDoContato.get(a.contact_id).inicio)) convDoContato.set(a.contact_id, a);
    const produtoDaVenda = (o) => { const p = produtoDaOportunidade(o); return p !== 'prospeccao' ? p : (produtoDaConversa(convDoContato.get(o.contact_id) || {}) || 'prospeccao'); };
    return {
      disponiveis: true, duplicadas,
      lista: unicas.map((o) => ({
        id: o.id, dia: diaDe(o.status_alterado_em), valor: Number(o.valor) || 0,
        vendedor: o.responsavel_id || quemAtendeu(o.contact_id, o.status_alterado_em) || SEM_RESP,
        contato: o.contato_nome, telefone: o.contato_telefone, funil: o.pipeline_nome, etapa: o.etapa_nome, produto: produtoDaVenda(o),
      })),
    };
  } catch {
    return { disponiveis: false, lista: [], duplicadas: { n: 0, valor: 0 } };
  }
}

// "Oportunidades Gerais" reúne as vendas de todos os produtos, então a mesma venda aparece também no funil do produto
// (mesmo contato e mesmo valor). Conta uma vez só: fica o registro do funil do produto (que diz o que foi vendido),
// herdando o responsável do outro se faltar. O valor repetido é informado à parte, para a conta fechar.
const GERAIS = 'Oportunidades Gerais';
export function deduplicar(rows) {
  const grupos = new Map();
  const soltas = [];
  for (const o of rows) {
    if (!o.contact_id || !(Number(o.valor) > 0)) { soltas.push(o); continue; }
    const k = `${o.contact_id}|${Math.round(Number(o.valor))}`;
    grupos.set(k, [...(grupos.get(k) || []), o]);
  }
  const unicas = [...soltas];
  let n = 0, valor = 0;
  for (const g of grupos.values()) {
    if (g.length === 1) { unicas.push(g[0]); continue; }
    const produto = g.find((o) => o.pipeline_nome !== GERAIS) || g[0];
    const dono = g.find((o) => o.responsavel_id)?.responsavel_id || null;
    unicas.push({ ...produto, responsavel_id: produto.responsavel_id || dono });
    n += g.length - 1; valor += Number(produto.valor) * (g.length - 1);
  }
  return { unicas: unicas.sort((x, y) => String(x.status_alterado_em).localeCompare(String(y.status_alterado_em))), duplicadas: { n, valor } };
}

// Todas as oportunidades do HighLevel sincronizadas (cache de 5 min). Sem a tabela, devolve lista vazia.
let oppCache = { t: 0, v: null };
export async function carregarOportunidades() {
  if (usaMock()) return [];
  if (oppCache.v && Date.now() - oppCache.t < 300e3) return oppCache.v;
  let rows = [];
  try {
    rows = await sb('ghl_oportunidades', { select: 'id,nome,status,valor,pipeline_nome,etapa_nome,responsavel_id,contact_id,contato_nome,contato_telefone,contato_email,criada_em,atualizada_em,status_alterado_em' });
  } catch { /* tabela ainda não existe */ }
  oppCache = { t: Date.now(), v: rows };
  return rows;
}

// Oportunidades em aberto por vendedor. "ativas" = mexidas nos últimos 30 dias (o resto são listas antigas paradas).
export async function abertasPorVendedor(analises, mapa) {
  if (usaMock()) {
    const m = new Map();
    for (const a of analises.filter((x) => !falhou(x) && x.oportunidade_venda && !x.resolvido)) {
      const v = mapa.get(a.conversation_id)?.[0]; if (!v) continue;
      const o = m.get(v) || { abertas: 0, ativas: 0 }; o.abertas++; o.ativas++; m.set(v, o);
    }
    return m;
  }
  const m = new Map();
  const corte = Date.now() - 30 * DIA_MS;
  for (const o of await carregarOportunidades()) {
    if (o.status !== 'open' || !o.responsavel_id) continue;
    const x = m.get(o.responsavel_id) || { abertas: 0, ativas: 0 };
    x.abertas++; if (o.atualizada_em && new Date(o.atualizada_em).getTime() >= corte) x.ativas++;
    m.set(o.responsavel_id, x);
  }
  return m;
}

// Conversa comercial: compra, dúvida de produto, pagamento ou interesse de compra. A conversão é medida só sobre elas,
// porque suporte, evento e outros assuntos nunca viram venda e puniriam quem atende mais disso.
export const ehComercial = (a) => ['compra', 'duvida_produto', 'pagamento_financeiro'].includes(a.categoria) || !!a.oportunidade_venda;

// Totais de um vendedor (ou do time): vendas e receita vêm das oportunidades ganhas; a conversão é vendas ÷ conversas atendidas.
export function totais(conversas, vendas) {
  const ok = conversas.filter((a) => !falhou(a));
  const receita = vendas.reduce((s, v) => s + v.valor, 0);
  const desde = inicioCobertura();
  const naJanela = desde ? vendas.filter((v) => v.dia >= desde) : vendas; // só vendas de dias em que há conversa analisada
  const comerciais = ok.filter(ehComercial).length;
  return {
    conversas: ok.length, comerciais, vendas: vendas.length, receita,
    ticket: vendas.length ? Math.round(receita / vendas.length) : null,
    conversao: comerciais ? +((100 * naJanela.length) / comerciais).toFixed(1) : null,
  };
}

export const entreDias = (lista, de, ate) => lista.filter((v) => v.dia >= de && v.dia <= ate);

// Nome e telefone dos contatos das conversas. Fontes, da mais para a menos confiável:
// ghl_contatos (consulta direta ao HighLevel) e ghl_oportunidades (contato da oportunidade).
let contatosCache = { t: 0, m: null };
async function mapaContatos() {
  if (contatosCache.m && Date.now() - contatosCache.t < 300e3) return contatosCache.m;
  const m = new Map();
  for (const o of await carregarOportunidades()) if (o.contact_id && o.contato_nome) m.set(o.contact_id, { nome: o.contato_nome, telefone: o.contato_telefone, email: o.contato_email });
  try { for (const c of await sb('ghl_contatos', { select: 'id,nome,telefone,email' })) if (c.nome) m.set(c.id, { nome: c.nome, telefone: c.telefone, email: c.email }); } catch { /* tabela ainda não existe */ }
  contatosCache = { t: Date.now(), m };
  return m;
}
registrarEnriquecedor(async (lista) => {
  if (usaMock()) return lista;
  const m = await mapaContatos();
  return lista.map((a) => {
    const c = !a.contato_nome && m.get(a.contact_id);
    return c ? { ...a, contato_nome: c.nome, contato_telefone: c.telefone || a.contato_telefone, contato_email: c.email || null } : a;
  });
});

// Quantas oportunidades abertas temos sincronizadas, contra o total do HighLevel (gravado pelo fluxo do n8n em ghl_sync).
export async function coberturaOpps(opps) {
  const sincronizadas = opps.filter((o) => o.status === 'open').length;
  try {
    const r = await sb('ghl_sync', { select: 'id,total', id: 'eq.abertas' });
    return { sincronizadas, total: r[0]?.total ?? null };
  } catch { return { sincronizadas, total: null }; }
}
