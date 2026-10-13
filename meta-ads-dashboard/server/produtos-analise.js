// Análise por produto: onde o time gasta as conversas, de onde vem a receita, o que está em aberto e o que o cliente pergunta.
import { falhou, pct, r1 } from './atendimentos.js';
import { CATALOGO, produtoPorId, produtoDaOportunidade, produtoDaConversa, temasDoTexto, TEMAS } from './produtos.js';

const DIA_MS = 864e5;
const brl = (n) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const mediana = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
const EVENTO = 'Evento (porta de entrada)';
const FORMACAO = 'Formação (alto ticket)';

export function analisarProdutos({ conversas, opps, vendas }) {
  const base = new Map(CATALOGO.map((p) => [p.id, { ...p, conversas: [], vendas: [], abertas: [] }]));
  const semProduto = [];
  for (const a of conversas.filter((x) => !falhou(x))) { const id = produtoDaConversa(a); (id ? base.get(id).conversas : semProduto).push(a); }
  for (const v of vendas) (base.get(v.produto || 'prospeccao') || base.get('prospeccao')).vendas.push(v);
  for (const o of opps.filter((x) => x.status === 'open')) base.get(produtoDaOportunidade(o)).abertas.push(o);

  const corte = Date.now() - 30 * DIA_MS;
  const totalConv = conversas.filter((x) => !falhou(x)).length;
  const totalReceita = vendas.reduce((s, v) => s + v.valor, 0);
  const lista = [...base.values()].map((p) => {
    const ok = p.conversas;
    const notas = ok.filter((a) => a.nota != null).map((a) => a.nota);
    const receita = p.vendas.reduce((s, v) => s + v.valor, 0);
    const comValor = p.abertas.filter((o) => Number(o.valor) > 0);
    const cont = {};
    for (const a of ok) for (const t of temasDoTexto(a)) cont[t] = (cont[t] || 0) + 1;
    const temas = Object.entries(cont).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, n]) => ({ tema: TEMAS.find((x) => x.id === id).nome, n, pct: pct(n, ok.length) }));
    return {
      id: p.id, nome: p.nome, familia: p.familia, nivel: p.nivel, descricao: p.descricao, proximo: p.proximo,
      conversas: ok.length, conversas_pct: pct(ok.length, totalConv),
      nota: notas.length ? r1(notas.reduce((s, x) => s + x, 0) / notas.length) : null,
      resolvidas_pct: pct(ok.filter((a) => a.resolvido).length, ok.length),
      interesse_aberto: ok.filter((a) => a.oportunidade_venda && !a.resolvido).length,
      vendas: p.vendas.length, receita, receita_pct: pct(receita, totalReceita), ticket: p.vendas.length ? Math.round(receita / p.vendas.length) : null,
      ticket_mediano: mediana(p.vendas.map((v) => v.valor).filter((v) => v > 0)),
      abertas: p.abertas.length, ativas: p.abertas.filter((o) => o.atualizada_em && new Date(o.atualizada_em).getTime() >= corte).length,
      valor_aberto: comValor.reduce((s, o) => s + Number(o.valor), 0), com_valor: comValor.length,
      temas,
    };
  }).filter((p) => p.conversas || p.vendas || p.abertas).sort((a, b) => b.receita - a.receita || b.conversas - a.conversas);
  return { lista, sem_produto: semProduto.length, total_conversas: totalConv, total_receita: totalReceita };
}

// Leitura de contexto, em frases: o que os números querem dizer sobre o produto e o esforço do time.
export function leituraProdutos(a) {
  const out = [];
  const por = (f) => a.lista.filter((p) => p.familia === f);
  const soma = (l, k) => l.reduce((s, p) => s + p[k], 0);
  const identificadas = soma(a.lista, 'conversas');
  const ev = por(EVENTO), fo = por(FORMACAO);
  if (identificadas >= 20 && ev.length) {
    const cEv = pct(soma(ev, 'conversas'), identificadas), rEv = a.total_receita ? pct(soma(ev, 'receita'), a.total_receita) : null;
    out.push({ tom: cEv >= 50 && rEv != null && rEv < 10 ? 'atencao' : 'info',
      texto: `${cEv}% das conversas em que o produto aparece são sobre os eventos de entrada (${ev.map((p) => p.nome).join(' e ')}), que respondem por ${rEv ?? '—'}% da receita do período. Esses eventos formam a base de contatos, mas o dinheiro está na formação.` });
  }
  if (fo.length) {
    const cFo = pct(soma(fo, 'conversas'), identificadas), rFo = a.total_receita ? pct(soma(fo, 'receita'), a.total_receita) : null;
    const abertoFo = soma(fo, 'valor_aberto');
    out.push({ tom: 'info', texto: `A formação (${fo.map((p) => p.nome).join(', ')}) é ${cFo}% das conversas e ${rFo ?? '—'}% da receita${abertoFo ? `, com ${brl(abertoFo)} em oportunidades abertas com valor` : ''}. Cada venda vale em média ${brl(soma(fo, 'receita') / Math.max(1, soma(fo, 'vendas')))}.` });
  }
  const pos = a.lista.find((p) => p.id === 'pos_pse');
  if (pos?.conversas >= 10) {
    const top = pos.temas[0];
    out.push({ tom: pos.resolvidas_pct < 40 ? 'atencao' : 'info', texto: `Nas ${pos.conversas} conversas sobre a Pós em Psicologia do Esporte, ${pos.resolvidas_pct}% foram resolvidas e ${pos.interesse_aberto} têm interesse de compra sem fechamento.${top ? ` O assunto que mais aparece é ${top.tema.toLowerCase()} (${top.pct}% das conversas).` : ''}` });
  }
  const idef = a.lista.find((p) => p.id === 'prospeccao');
  if (idef?.vendas) out.push({ tom: 'atencao', texto: `${idef.vendas} ${idef.vendas === 1 ? 'venda' : 'vendas'} (${brl(idef.receita)}, ${idef.receita_pct}% da receita) estão em funis genéricos e não têm produto identificado. Sem isso não dá para saber o que está vendendo.` });
  if (a.sem_produto >= 20) out.push({ tom: 'info', texto: `${a.sem_produto} conversas não citam nenhum produto. Em geral são suporte, acesso e mensagens soltas.` });
  return out;
}
