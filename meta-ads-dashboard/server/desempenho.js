// Desempenho de um vendedor (ou do time todo) em qualquer período: vendas, receita, conversão, nota e avaliação.
import { carregar, diaDe, addDias, hojeBrt, usaMock, r1, falhou } from './atendimentos.js';
import { atribuicao, vendedor, pontuar, CRITERIO } from './equipe.js';
import { inicioCobertura } from './atendimentos.js';
import { carregarVendas, abertasPorVendedor, carregarOportunidades, coberturaOpps, totais, entreDias, SEM_RESP } from './vendas.js';
import { montarRelatorio, buscarOportunidades } from './relatorio.js';
import { nameOf } from './whatsapp.js';

const segunda = (d) => addDias(d, -((new Date(d + 'T12:00:00Z').getUTCDay() + 6) % 7));
const balde = (d, agrupar) => (agrupar === 'mes' ? d.slice(0, 7) : agrupar === 'semana' ? segunda(d) : d);
const entre = (lista, de, ate) => lista.filter((a) => diaDe(a.inicio) >= de && diaDe(a.inicio) <= ate);

export async function desempenho({ quem, de, ate, agrupar }) {
  const hoje = hojeBrt();
  const dias = Math.round((new Date(ate) - new Date(de)) / 864e5) + 1;
  const antDe = addDias(de, -dias), antAte = addDias(de, -1);
  const inicioMes = hoje.slice(0, 7) + '-01', inicioSemana = segunda(hoje);
  const desde = [antDe, inicioMes, inicioSemana].sort()[0];
  const tudo = await carregar(desde, hoje > ate ? hoje : ate);
  const mapa = await atribuicao(tudo, desde, hoje > ate ? hoje : ate);

  const fim = hoje > ate ? hoje : ate;
  const vend = await carregarVendas(desde, fim, tudo, mapa);
  const abertas = await abertasPorVendedor(tudo, mapa);
  const doTime = quem === 'time';
  const vendasQuem = doTime ? vend.lista : vend.lista.filter((v) => v.vendedor === quem);
  const dele = (a) => doTime || (mapa.get(a.conversation_id) || []).includes(quem);
  const principal = (a) => doTime || mapa.get(a.conversation_id)?.[0] === quem;
  const meus = tudo.filter(dele), principais = tudo.filter(principal);

  const atual = entre(meus, de, ate), anterior = entre(meus, antDe, antAte);
  const ids = [...new Set([...entre(tudo, de, ate).flatMap((a) => mapa.get(a.conversation_id) || []), ...entreDias(vend.lista, de, ate).map((v) => v.vendedor)])];

  // Série do gráfico: um ponto por dia, semana ou mês, incluindo os vazios.
  const chaves = [];
  for (let d = de; d <= ate; d = addDias(d, 1)) { const k = balde(d, agrupar); if (chaves[chaves.length - 1] !== k) chaves.push(k); }
  const serie = chaves.map((k) => {
    const t = totais(entre(principais, de, ate).filter((a) => balde(diaDe(a.inicio), agrupar) === k), entreDias(vendasQuem, de, ate).filter((v) => balde(v.dia, agrupar) === k));
    const nota = pontuar(atual.filter((a) => balde(diaDe(a.inicio), agrupar) === k)).nota;
    return { periodo: k, ...t, nota };
  });

  const resumo = Object.fromEntries([['hoje', hoje], ['semana', inicioSemana], ['mes', inicioMes]].map(([k, ini]) => [k, totais(entre(principais, ini, hoje), entreDias(vendasQuem, ini, hoje))]));
  const abertasQuem = doTime ? [...abertas.values()].reduce((t, x) => ({ abertas: t.abertas + x.abertas, ativas: t.ativas + x.ativas }), { abertas: 0, ativas: 0 }) : abertas.get(quem) || null;
  const avaliacao = vendedor(quem, atual, anterior, entre(principais, de, ate), entreDias(vendasQuem, de, ate), abertasQuem);
  if (doTime) avaliacao.nome = 'Time todo'; else avaliacao.nome = nameOf(quem);

  const equipeLista = entre(tudo.filter((a) => (mapa.get(a.conversation_id) || []).length), de, ate);
  const ultimaPorContato = new Map();
  for (const a of tudo) if (a.contact_id && !falhou(a) && (!ultimaPorContato.get(a.contact_id) || a.inicio > ultimaPorContato.get(a.contact_id).inicio)) ultimaPorContato.set(a.contact_id, a);
  const donoPorContato = new Map([...ultimaPorContato].map(([c, a]) => [c, mapa.get(a.conversation_id)?.[0]]));
  const oppsTodas = await carregarOportunidades();
  const relatorio = montarRelatorio({
    quem, doTime, nome: avaliacao.nome, lista: atual, equipeLista, conv: avaliacao.vendas,
    vendasQuem: entreDias(vendasQuem, de, ate), vendasTime: entreDias(vend.lista.filter((v) => v.vendedor !== SEM_RESP), de, ate),
    opps: oppsTodas, padroes: avaliacao.padroes, conversas: ultimaPorContato, donoPorContato, cobertura: await coberturaOpps(oppsTodas),
  });

  return {
    mock: usaMock(), vendas_disponiveis: vend.disponiveis, cobertura_inicio: inicioCobertura(), duplicadas: vend.duplicadas, relatorio, de, ate, agrupar, criterio: CRITERIO,
    quem: { id: quem, nome: avaliacao.nome },
    vendedores: ids.map((id) => ({ id, nome: nameOf(id) })).sort((a, b) => a.nome.localeCompare(b.nome)),
    totais: totais(entre(principais, de, ate), entreDias(vendasQuem, de, ate)), anterior: totais(entre(principais, antDe, antAte), entreDias(vendasQuem, antDe, antAte)), abertas: abertasQuem,
    resumo, serie, avaliacao,
  };
}

// Busca de oportunidade por contato dentro da carteira do vendedor (ou do time).
export async function buscar({ quem, termo }) {
  const hoje = hojeBrt();
  const tudo = await carregar(addDias(hoje, -60), hoje);
  const mapa = await atribuicao(tudo, addDias(hoje, -60), hoje);
  const ultima = new Map();
  for (const a of tudo) if (a.contact_id && !falhou(a) && (!ultima.get(a.contact_id) || a.inicio > ultima.get(a.contact_id).inicio)) ultima.set(a.contact_id, a);
  const donoPorContato = new Map([...ultima].map(([c, a]) => [c, mapa.get(a.conversation_id)?.[0]]));
  return buscarOportunidades({ quem, doTime: quem === 'time', termo, opps: await carregarOportunidades(), conversas: ultima, donoPorContato });
}
