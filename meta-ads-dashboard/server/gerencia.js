// Painel do gerente: transforma os números em decisões. Cada decisão traz o porquê (os números), o que fazer e quem.
// Tudo por regras sobre dados reais; nada aqui é opinião de IA.
import { carregar, diaDe, addDias, hojeBrt, usaMock, falhou, inicioCobertura, pct, r1 } from './atendimentos.js';
import { atribuicao, vendedor, pontuar } from './equipe.js';
import { carregarVendas, carregarOportunidades, totais, entreDias, SEM_RESP } from './vendas.js';
import { montarRelatorio, indicaPagamento } from './relatorio.js';
import { nameOf } from './whatsapp.js';
import { analisarProdutos, leituraProdutos } from './produtos-analise.js';

const DIA_MS = 864e5;
const brl = (n) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const entre = (lista, de, ate) => lista.filter((a) => diaDe(a.inicio) >= de && diaDe(a.inicio) <= ate);
const variacao = (a, b) => (b ? Math.round(((a - b) / b) * 100) : null);
const GERAIS = 'Oportunidades Gerais';

export async function gerencia(dias = 30) {
  const ate = hojeBrt();
  const de = addDias(ate, -(dias - 1)), antDe = addDias(de, -dias), antAte = addDias(de, -1);

  const tudo = await carregar(antDe, ate);
  const mapa = await atribuicao(tudo, antDe, ate);
  const [vAtual, vAnt] = [await carregarVendas(de, ate, tudo, mapa), await carregarVendas(antDe, antAte, tudo, mapa)];
  const opps = await carregarOportunidades();

  const atual = entre(tudo, de, ate), anterior = entre(tudo, antDe, antAte);
  const dono = (a) => mapa.get(a.conversation_id) || [];
  const principalDe = (a) => dono(a)[0];
  const equipeAtual = atual.filter((a) => dono(a).length), equipeAnt = anterior.filter((a) => dono(a).length);

  // ---- Time ----
  const tAtual = totais(equipeAtual, vAtual.lista.filter((v) => v.vendedor !== SEM_RESP));
  const tAnt = totais(equipeAnt, vAnt.lista.filter((v) => v.vendedor !== SEM_RESP));
  const receita = vAtual.lista.reduce((s, v) => s + v.valor, 0), receitaAnt = vAnt.lista.reduce((s, v) => s + v.valor, 0);
  const idade = (o) => (o.atualizada_em ? (Date.now() - new Date(o.atualizada_em).getTime()) / DIA_MS : 999);
  const abertas = opps.filter((o) => o.status === 'open');
  const comValor = abertas.filter((o) => Number(o.valor) > 0);
  const ativasValor = comValor.filter((o) => idade(o) <= 30);
  const paradas = comValor.filter((o) => idade(o) > 14);
  const semDono = comValor.filter((o) => !o.responsavel_id);
  const soma = (l) => l.reduce((s, o) => s + Number(o.valor), 0);

  // ---- Placar por vendedor ----
  const ids = [...new Set([...equipeAtual.flatMap(dono), ...vAtual.lista.map((v) => v.vendedor)])];
  const principaisTotal = equipeAtual.filter((a) => principalDe(a)).length;
  const linhas = ids.map((id) => {
    const assigned = atual.filter((a) => dono(a).includes(id));
    const principais = atual.filter((a) => principalDe(a) === id);
    const v = vAtual.lista.filter((x) => x.vendedor === id);
    const t = totais(principais, v), p = pontuar(assigned);
    const minhas = abertas.filter((o) => (id === SEM_RESP ? !o.responsavel_id : o.responsavel_id === id));
    const mv = minhas.filter((o) => Number(o.valor) > 0);
    return {
      id, nome: nameOf(id), conversas: principais.length, comerciais: t.comerciais, carga_pct: pct(principais.length, principaisTotal),
      vendas: t.vendas, receita: t.receita, conversao: t.conversao, ticket: t.ticket, nota: p.nota,
      primeira_resposta_min: p.medido.primeira_resposta_min,
      ativas: minhas.filter((o) => idade(o) <= 30).length, valor_aberto: soma(mv), valor_parado: soma(mv.filter((o) => idade(o) > 14)),
      parado_qtd: mv.filter((o) => idade(o) > 14).length,
    };
  }).sort((a, b) => b.receita - a.receita || b.conversas - a.conversas);
  const reais = linhas.filter((l) => l.id !== SEM_RESP);

  // ---- Produtos: o que o time conversa, o que vende e o que está em aberto, por produto de verdade ----
  const analiseProd = analisarProdutos({ conversas: atual, opps, vendas: vAtual.lista });
  const leitura = leituraProdutos(analiseProd);
  const produtos = analiseProd.lista;

  // Oportunidades abertas cuja última conversa (14 dias) indica pagamento feito: provavelmente já são venda.
  const ultima = new Map();
  for (const a of tudo) if (a.contact_id && !falhou(a) && (!ultima.get(a.contact_id) || a.inicio > ultima.get(a.contact_id).inicio)) ultima.set(a.contact_id, a);
  const jaPagas = comValor.filter((o) => { const c = ultima.get(o.contact_id); return c && (Date.now() - new Date(c.inicio).getTime()) / DIA_MS <= 14 && indicaPagamento(c); });

  // ---- Decisões ----
  const decisoes = [];
  const add = (d) => decisoes.push(d);

  if (jaPagas.length) {
    add({ id: 'ja_pagas', urg: 92, em_jogo: soma(jaPagas), titulo: 'Confirme pagamentos e marque as vendas como ganhas',
      porque: `${jaPagas.length} ${jaPagas.length === 1 ? 'oportunidade aberta tem' : 'oportunidades abertas têm'} conversa recente indicando que o cliente já pagou (${brl(soma(jaPagas))}). Enquanto ficarem abertas, a venda não entra na receita nem no placar de ninguém.`,
      acao: 'Peça ao financeiro a confirmação e marque cada uma como ganha no HighLevel, com o responsável preenchido. Os clientes estão listados nas maiores oportunidades da aba Vendedor.', quem: ['Financeiro', 'Gerência'] });
  }
  if (paradas.length) {
    const por = reais.filter((l) => l.valor_parado > 0).sort((a, b) => b.valor_parado - a.valor_parado).slice(0, 3);
    add({ id: 'parado', urg: 95, em_jogo: soma(paradas), titulo: 'Reative o dinheiro parado na carteira',
      porque: `${paradas.length} oportunidades com valor (${brl(soma(paradas))}) estão sem movimento há mais de 14 dias${por.length ? `. Maiores carteiras paradas: ${por.map((l) => `${l.nome} ${brl(l.valor_parado)}`).join(', ')}` : ''}.`,
      acao: 'Peça a cada vendedor para reativar as 10 maiores da própria carteira esta semana (a lista está na aba Vendedor). Quem não responder em 2 tentativas vai para perdida, para o funil refletir a realidade.',
      quem: por.map((l) => l.nome), vendedor_id: por[0]?.id });
  }
  if (semDono.length) {
    add({ id: 'sem_dono', urg: 85, em_jogo: soma(semDono), titulo: 'Defina um dono para cada oportunidade com valor',
      porque: `${semDono.length} oportunidades abertas com valor (${brl(soma(semDono))}) não têm responsável no HighLevel. Sem dono, ninguém cobra e ninguém é medido.`,
      acao: 'Distribua essas oportunidades hoje, de acordo com a carga de cada um (veja o placar). Regra daqui pra frente: toda oportunidade nasce com responsável.', quem: ['Gerência'] });
  }
  const vSem = vAtual.lista.filter((v) => v.vendedor === SEM_RESP);
  if (vAtual.lista.length >= 5 && pct(vSem.length, vAtual.lista.length) >= 20) {
    add({ id: 'venda_sem_dono', urg: 70, em_jogo: vSem.reduce((s, v) => s + v.valor, 0), titulo: 'Vendas sem responsável impedem medir quem vende',
      porque: `${vSem.length} de ${vAtual.lista.length} vendas (${pct(vSem.length, vAtual.lista.length)}%) estão sem responsável no HighLevel e não entram no ranking de ninguém.`,
      acao: 'Exija o preenchimento do responsável ao marcar a oportunidade como ganha.', quem: ['Gerência'] });
  }
  const topo = [...reais].sort((a, b) => b.conversas - a.conversas)[0];
  if (topo && reais.length > 1 && topo.carga_pct >= 50) {
    const outros = reais.filter((l) => l.id !== topo.id && l.comerciais >= 10);
    const melhor = [...outros].filter((l) => l.conversao != null).sort((a, b) => b.conversao - a.conversao)[0];
    add({ id: 'carga', urg: 80, em_jogo: null, titulo: `Redistribua o atendimento: ${topo.nome} concentra ${topo.carga_pct}% das conversas`,
      porque: `${topo.nome} atende ${topo.conversas} conversas, quase tudo da equipe${topo.conversao != null ? `, e converte ${topo.conversao}% das ${topo.comerciais} conversas comerciais` : ''}${melhor ? `. ${melhor.nome} converte ${melhor.conversao}% das ${melhor.comerciais} conversas comerciais que atende` : ''}. Concentrar demais reduz a atenção por cliente e deixa o time dependente de uma pessoa.`,
      acao: `Direcione parte da entrada de leads para ${melhor ? melhor.nome : 'os demais vendedores'} e acompanhe a conversão por duas semanas antes de decidir.`, quem: [topo.nome, melhor?.nome].filter(Boolean), vendedor_id: topo.id });
  }
  const aptos = reais.filter((l) => l.comerciais >= 10 && l.conversao != null);
  if (aptos.length >= 2) {
    const mx = [...aptos].sort((a, b) => b.conversao - a.conversao)[0], mn = [...aptos].sort((a, b) => a.conversao - b.conversao)[0];
    if (mx.id !== mn.id && mx.conversao >= 1.5 * Math.max(mn.conversao, 0.1)) {
      add({ id: 'pareamento', urg: 65, em_jogo: null, titulo: `Faça ${mx.nome} ensinar ${mn.nome}`,
        porque: `${mx.nome} converte ${mx.conversao}% e ${mn.nome} converte ${mn.conversao}%, sobre conversas comerciais (${mx.comerciais} contra ${mn.comerciais}).`,
        acao: `Marque 30 minutos para ${mx.nome} mostrar 3 conversas que fecharam e o roteiro de fechamento que usa. Depois acompanhe a conversão de ${mn.nome} por 2 semanas.`, quem: [mx.nome, mn.nome] });
    }
  }
  const soAutomacao = atual.filter((a) => !falhou(a) && !dono(a).length && a.oportunidade_venda && !a.resolvido);
  if (soAutomacao.length >= 10) {
    add({ id: 'automacao', urg: 75, em_jogo: null, titulo: 'Conversas com interesse de compra estão ficando só com a automação',
      porque: `${soAutomacao.length} conversas com interesse de compra não tiveram nenhum atendente humano e terminaram sem resolução.`,
      acao: 'Crie um alerta que chame um vendedor quando a automação detectar interesse de compra, e defina quem cobre cada horário.', quem: ['Gerência'] });
  }
  const tiv = equipeAtual.filter((a) => !falhou(a) && a.oportunidade_venda);
  const semFecho = tiv.filter((a) => !a.resolvido);
  if (tiv.length >= 20 && pct(semFecho.length, tiv.length) >= 50) {
    add({ id: 'fechamento', urg: 72, em_jogo: null, titulo: 'Treine o fechamento: a maioria do interesse de compra não vira venda',
      porque: `${semFecho.length} de ${tiv.length} conversas com interesse de compra (${pct(semFecho.length, tiv.length)}%) terminaram sem resolução.`,
      acao: 'Padronize o fechamento: toda conversa de interesse termina com o link, uma data para decidir e o próximo passo combinado. Treine em reunião usando os casos da aba Vendedor.', quem: reais.map((l) => l.nome) });
  }
  if (tAtual.conversao != null && tAnt.conversao != null && tAnt.conversao > 0 && variacao(tAtual.conversao, tAnt.conversao) <= -20) {
    add({ id: 'queda', urg: 78, em_jogo: null, titulo: 'A conversão do time caiu',
      porque: `Conversão de ${tAtual.conversao}% contra ${tAnt.conversao}% no período anterior (${variacao(tAtual.conversao, tAnt.conversao)}%).`,
      acao: 'Descubra se a queda vem da qualidade dos leads (mudou a campanha ou a lista?) ou do atendimento (veja o placar abaixo).', quem: ['Gerência'] });
  }
  const tp = pontuar(equipeAtual).medido.primeira_resposta_min;
  if (tp != null && tp > 15) {
    add({ id: 'resposta', urg: 60, em_jogo: null, titulo: 'Reduza o tempo da primeira resposta',
      porque: `O time leva ${tp} min para responder a primeira mensagem em horário comercial.`,
      acao: 'Meta: abaixo de 5 minutos. Defina um responsável por turno e ative alerta de conversa nova.', quem: ['Equipe'] });
  }
  const topoProd = produtos.find((p) => p.id !== 'prospeccao') ? [...produtos].sort((x, y) => y.receita - x.receita)[0] : null;
  if (topoProd && topoProd.receita_pct >= 40 && topoProd.id !== 'prospeccao') {
    add({ id: 'concentracao_produto', urg: 50, em_jogo: topoProd.receita, titulo: `Dependência de um produto: ${topoProd.nome}`,
      porque: `${topoProd.receita_pct}% da receita do período (${brl(topoProd.receita)}) vem de ${topoProd.nome}.`,
      acao: 'Decida se vale reforçar a oferta que já vende ou abrir uma segunda frente, para não depender de um só produto.', quem: ['Gerência'] });
  }
  // Esforço contra retorno: o time conversa sobre eventos de baixo ticket enquanto a formação concentra o dinheiro.
  const eventos = produtos.filter((p) => p.familia === 'Evento (porta de entrada)'), formacao = produtos.filter((p) => p.familia === 'Formação (alto ticket)');
  const convIdent = produtos.reduce((t, p) => t + p.conversas, 0);
  const convEv = eventos.reduce((t, p) => t + p.conversas, 0);
  if (convIdent >= 50 && pct(convEv, convIdent) >= 60) {
    const intFo = formacao.reduce((t, p) => t + p.interesse_aberto, 0), abFo = formacao.reduce((t, p) => t + p.valor_aberto, 0);
    add({ id: 'esforco', urg: 74, em_jogo: abFo || null, titulo: 'O time gasta o esforço nos eventos, e o dinheiro está na formação',
      porque: `${pct(convEv, convIdent)}% das conversas com produto citado são sobre os congressos (entrada de baixo ticket), que geram ${pct(eventos.reduce((t, p) => t + p.receita, 0), analiseProd.total_receita || 1)}% da receita. A formação tem ${intFo} conversas com interesse de compra sem fechamento e ${brl(abFo)} em oportunidades abertas com valor.`,
      acao: 'Automatize o suporte de acesso e gravação dos congressos para liberar horário comercial, e dedique esse tempo a quem demonstrou interesse na pós. Defina uma meta semanal de conversas de formação por vendedor.', quem: ['Gerência'] });
  }
  const pos = produtos.find((p) => p.id === 'pos_pse');
  if (pos && pos.interesse_aberto >= 15) {
    add({ id: 'pos_interesse', urg: 76, em_jogo: null, titulo: `Feche o interesse na ${pos.nome}`,
      porque: `${pos.interesse_aberto} de ${pos.conversas} conversas sobre a pós têm interesse de compra sem fechamento. O ticket é de ${brl(pos.ticket_mediano || pos.ticket || 0)}, então cada fechamento muda o resultado do mês.`,
      acao: 'Liste essas conversas (aba Vendedor, "Onde agir primeiro"), retome em até 48 horas apresentando grade, certificação e a condição de pagamento, e registre o resultado no HighLevel.', quem: ['Equipe comercial'] });
  }

  decisoes.sort((a, b) => b.urg - a.urg || (b.em_jogo || 0) - (a.em_jogo || 0));

  // ---- Pauta dos 1:1 ----
  const pauta = reais.filter((l) => l.conversas >= 10 || l.vendas > 0).map((l) => {
    const assigned = atual.filter((a) => dono(a).includes(l.id)), ant = anterior.filter((a) => dono(a).includes(l.id));
    const principais = atual.filter((a) => principalDe(a) === l.id);
    const v = vAtual.lista.filter((x) => x.vendedor === l.id);
    const av = vendedor(l.id, assigned, ant, principais, v, null);
    const rel = montarRelatorio({ quem: l.id, doTime: false, nome: l.nome, lista: assigned, equipeLista: equipeAtual, conv: av.vendas, vendasQuem: v, vendasTime: vAtual.lista.filter((x) => x.vendedor !== SEM_RESP), opps, padroes: av.padroes });
    const meta = l.conversao != null && tAtual.conversao != null && l.conversao < tAtual.conversao ? `Conversão de ${l.conversao}% para ${tAtual.conversao}% (média do time)` : 'Manter a conversão e abrir mais conversas de compra';
    return { id: l.id, nome: l.nome, nota: l.nota, elogio: rel.fortes[0] ? { titulo: rel.fortes[0].titulo, evidencia: rel.fortes[0].evidencia } : null,
      focos: rel.plano.map((p) => ({ titulo: p.titulo, evidencia: p.evidencia, acao: p.acao })), meta };
  });

  const principal = decisoes[0];
  const dv = variacao(receita, receitaAnt);
  const resumo = `Nos últimos ${dias} dias o time vendeu ${brl(receita)} em ${vAtual.lista.length} ${vAtual.lista.length === 1 ? 'venda' : 'vendas'}${dv != null ? ` (${dv > 0 ? '+' : ''}${dv}% contra o período anterior)` : ''}, com conversão de ${tAtual.conversao ?? '—'}%. Há ${brl(soma(ativasValor))} em oportunidades ativas e ${brl(soma(paradas))} paradas há mais de 14 dias.${principal ? ` A decisão mais urgente: ${principal.titulo.charAt(0).toLowerCase()}${principal.titulo.slice(1)}.` : ''}`;

  return {
    mock: usaMock(), de, ate, dias, cobertura_inicio: inicioCobertura(), duplicadas: vAtual.duplicadas, vendas_disponiveis: vAtual.disponiveis,
    resumo,
    numeros: {
      receita, receita_ant: receitaAnt, vendas: vAtual.lista.length, vendas_ant: vAnt.lista.length,
      conversao: tAtual.conversao, conversao_ant: tAnt.conversao, ticket: vAtual.lista.length ? Math.round(receita / vAtual.lista.length) : null,
      pipeline_ativo: soma(ativasValor), parado: soma(paradas), parado_qtd: paradas.length, sem_dono: soma(semDono), sem_dono_qtd: semDono.length,
    },
    decisoes, placar: linhas, produtos, produtos_leitura: leitura, produtos_meta: { sem_produto: analiseProd.sem_produto, total_conversas: analiseProd.total_conversas }, pauta,
  };
}
