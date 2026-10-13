// Relatório geral de um vendedor (ou do time): o que está trabalhando, onde peca, o que faz bem e como ajustar a abordagem.
// Tudo calculado por regras sobre dados reais (análises de conversa + oportunidades do HighLevel), sem custo de IA.
import { r1, pct, falhou } from './atendimentos.js';
import { pontuar } from './equipe.js';
import { totais, ehComercial, SEM_RESP } from './vendas.js';
import { produtoDaOportunidade, produtoDaConversa, produtoPorId, sa } from './produtos.js';
import { analisarProdutos } from './produtos-analise.js';

const DIA_MS = 864e5;
const COMERCIAIS = ['compra', 'duvida_produto', 'pagamento_financeiro'];
const CAT = { suporte_acesso: 'Suporte / acesso', outro: 'Outros', evento: 'Evento', duvida_produto: 'Dúvida sobre produto', compra: 'Compra', pagamento_financeiro: 'Pagamento', reclamacao: 'Reclamação', cancelamento_reembolso: 'Cancelamento / reembolso' };
const brl = (n) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const GRAVIDADE = { critico: 3, atencao: 2, forte: 0 };

// Roteiros de apoio: o que dizer no lugar do que está falhando.
const ROTEIRO = {
  fechamento: 'Posso te enviar agora o link para garantir sua vaga? As inscrições deste lote encerram em [data]. Se preferir, te explico as formas de pagamento antes.',
  retomada: 'Oi [nome], tudo bem? Passando para saber se ficou alguma dúvida sobre [produto]. Consigo te ajudar a decidir ainda esta semana?',
  proximo_passo: 'Combinado, [nome]: vou te mandar o link e te chamo amanhã às [hora] para confirmar. Pode ser?',
  rapidez: 'Oi [nome], aqui é [seu nome] do Instituto Atleta Campeão. Já vi sua mensagem e estou te respondendo agora.',
  qualificacao: 'Para te indicar a melhor opção, me conta: você atua com [atletas / equipes / famílias] e qual é o seu principal objetivo hoje?',
};


// A última conversa indica que o cliente já pagou? Então a oportunidade provavelmente deveria estar como ganha.
export const indicaPagamento = (conv) => !!conv && /realiz(ou|ado) (o )?pagamento|pagamento (foi )?(realizado|confirmado|efetuado)|efetuou (o )?pagamento|comprovante/i.test(conv.resumo || '');

// O cliente disse que não quer agora? A IA marca "interesse de compra" mesmo assim; o texto do resumo desmente.
export const recusou = (conv) => !!conv && /nao pretende|nao tem interesse|sem interesse|nao deseja|nao quer|desist|nao ha interesse|nao podera|sem condicoes|nao tem condicoes/.test(sa(`${conv.resumo || ''} ${conv.proxima_acao || ''}`));

const dataCurta = (iso) => { const d = new Date(new Date(iso).getTime() - 3 * 3600e3).toISOString(); return `${d.slice(8, 10)}/${d.slice(5, 7)}`; };

// Resumo e próximo passo de uma oportunidade em aberto. Usa o que a última conversa combinou, se houver;
// senão, a regra pela idade da oportunidade e pela etapa em que ela está.
function oportunidade(o, conv, parada) {
  const dias = Math.round(parada);
  const criada = o.criada_em ? Math.round((Date.now() - new Date(o.criada_em).getTime()) / DIA_MS) : null;
  const nomeContato = o.contato_nome || o.nome || '';
  const primeiro = nomeContato.trim().split(/\s+/)[0] || '';
  let produtoId = produtoDaOportunidade(o);
  if (produtoId === 'prospeccao' && conv) produtoId = produtoDaConversa(conv) || 'prospeccao';
  const prod = produtoPorId(produtoId);
  const produto = produtoId === 'prospeccao' ? (o.pipeline_nome || 'nossa proposta') : prod.nome;
  const recente = conv && (Date.now() - new Date(conv.inicio).getTime()) / DIA_MS <= 14;
  const fatos = [`${o.pipeline_nome || 'Sem funil'}${o.etapa_nome ? `, etapa “${o.etapa_nome}”` : ''}.`, `Valor ${brl(o.valor)}.`, criada != null ? `Criada há ${criada} dias.` : null, dias >= 999 ? 'Sem registro de movimentação.' : dias === 0 ? 'Movimentada hoje.' : `Última movimentação há ${dias} dias.`].filter(Boolean).join(' ');
  const ultima = conv ? `Última conversa (${dataCurta(conv.inicio)}): ${conv.resumo}` : 'Sem conversa analisada nos últimos dias.';
  let acao, roteiro = ROTEIRO.retomada.replace('[nome]', primeiro).replace('[produto]', produto);
  const recusa = recente && recusou(conv);
  let possivelGanho = false;
  if (recente && indicaPagamento(conv)) { possivelGanho = true; acao = 'A última conversa indica que o pagamento já foi feito. Confirme no financeiro e, se estiver pago, marque a oportunidade como ganha para a venda entrar no placar.'; roteiro = `Oi ${primeiro}, recebi seu pagamento. Estou confirmando aqui e já te envio o acesso.`; }
  else if (recusa) { acao = 'O cliente sinalizou que não quer agora. Respeite: registre o motivo no HighLevel e agende um novo contato daqui a 30 dias com uma novidade (nova turma, condição ou conteúdo). Não insista antes disso.'; roteiro = `Oi ${primeiro}, tudo bem? Combinamos de retomar mais adiante. Estamos com novidades em ${produto}. Posso te contar rapidinho?`; }
  else if (recente && conv.proxima_acao) acao = `Combinado na última conversa: ${conv.proxima_acao}`;
  else if (/dados/i.test(o.etapa_nome || '')) { acao = 'O cliente já passou os dados. Envie a proposta ou o contrato e confirme a forma de pagamento hoje.'; roteiro = `Oi ${primeiro}, recebi seus dados. Já te envio a proposta para ${produto}. Prefere pagar à vista ou parcelado?`; }
  else if (dias > 30) acao = `Sem movimento há ${dias} dias. Faça uma retomada com um motivo novo (prazo da condição, últimas vagas, novidade). Sem resposta em 2 tentativas, marque como perdida para limpar o funil.`;
  else if (dias > 14) acao = 'Retome hoje: pergunte se ficou alguma dúvida e proponha o próximo passo com data.';
  else { acao = 'Está em andamento. Avance para o próximo passo (proposta, link de pagamento ou reunião) e registre no CRM.'; roteiro = ROTEIRO.proximo_passo.replace('[nome]', primeiro).replace('[hora]', '10h'); }
  if (produtoId !== 'prospeccao' && !recusa && !(recente && (indicaPagamento(conv) || conv.proxima_acao))) acao += ` Para este produto: ${prod.proximo}`;
  if (Number(o.valor) >= 10000) acao += ' É uma oportunidade de alto valor: prefira ligar em vez de só mandar mensagem e envolva a gerência se travar.';
  return {
    id: o.id, contact_id: o.contact_id, contato: nomeContato || null, telefone: o.contato_telefone || null, email: o.contato_email || null,
    funil: o.pipeline_nome, etapa: o.etapa_nome, valor: Number(o.valor), parada_dias: dias, criada_dias: criada,
    produto_id: produtoId, produto: prod.nome, produto_familia: prod.familia, produto_descricao: prod.descricao,
    resumo: `${fatos} ${ultima}`, acao, roteiro, conversation_id: conv?.conversation_id || null, possivel_ganho: possivelGanho,
  };
}

// Quão "quente" está uma oportunidade: sinais da conversa recente, etapa do funil, valor e idade. Não depende só do valor.
function esquentar(o, conv, parada) {
  let calor = 0; const motivos = [];
  const diasConv = conv ? (Date.now() - new Date(conv.inicio).getTime()) / DIA_MS : 999;
  if (conv && diasConv <= 14 && indicaPagamento(conv)) { calor += 60; motivos.push('Pagamento indicado na conversa'); }
  if (conv && diasConv <= 7 && conv.oportunidade_venda && !conv.resolvido) { calor += 50; motivos.push('Interesse de compra recente sem fechamento'); }
  else if (conv && diasConv <= 14 && ['compra', 'duvida_produto', 'pagamento_financeiro'].includes(conv.categoria) && !conv.resolvido) { calor += 30; motivos.push('Conversa comercial em aberto'); }
  if (/negocia|proposta|dados|fechamento|pagamento/i.test(o.etapa_nome || '')) { calor += 20; motivos.push(`Etapa avançada (${o.etapa_nome})`); }
  if (conv && diasConv <= 30 && recusou(conv)) { calor -= 45; motivos.unshift('Cliente sinalizou que não quer agora'); }
  const v = Number(o.valor) || 0;
  if (v > 0) { calor += Math.min(30, Math.log10(v + 1) * 8); if (v >= 5000) motivos.push('Alto valor'); }
  if (parada <= 3) calor += 10; else if (parada <= 7) calor += 6; else if (parada > 90) calor -= 20; else if (parada > 30) calor -= 10;
  return { calor: Math.round(calor), motivos };
}

function funis(vendasQuem, abertas) {
  const m = new Map();
  const get = (nome) => { const k = nome || 'Sem funil'; if (!m.has(k)) m.set(k, { funil: k, ganhas: 0, receita: 0, abertas: 0, ativas: 0, valor_aberto: 0 }); return m.get(k); };
  const corte = Date.now() - 30 * DIA_MS;
  for (const v of vendasQuem) { const f = get(v.funil); f.ganhas++; f.receita += v.valor; }
  for (const o of abertas) {
    const f = get(o.pipeline_nome);
    f.abertas++; f.valor_aberto += Number(o.valor) || 0;
    if (o.atualizada_em && new Date(o.atualizada_em).getTime() >= corte) f.ativas++;
  }
  return [...m.values()].sort((a, b) => b.receita - a.receita || b.ativas - a.ativas).slice(0, 12);
}

// Busca uma oportunidade do vendedor (ou do time) pelo nome, telefone ou e-mail do contato, com o mesmo resumo e ação da lista.
export function buscarOportunidades({ quem, doTime, termo, opps, conversas, donoPorContato }) {
  const t = sa(termo).trim();
  if (t.length < 2) return [];
  const digitos = t.replace(/\D/g, '');
  const idade = (o) => (o.atualizada_em ? (Date.now() - new Date(o.atualizada_em).getTime()) / DIA_MS : 999);
  const minhas = opps.filter((o) => o.status === 'open' && (doTime || (quem === SEM_RESP ? !o.responsavel_id : (o.responsavel_id === quem || (!o.responsavel_id && donoPorContato.get(o.contact_id) === quem)))));
  const bate = (o) => sa(`${o.contato_nome || ''} ${o.nome || ''} ${o.contato_email || ''}`).includes(t) || (digitos.length >= 4 && String(o.contato_telefone || '').replace(/\D/g, '').includes(digitos));
  return minhas.filter(bate).slice(0, 40).map((o) => {
    const conv = conversas.get(o.contact_id);
    const { calor, motivos } = esquentar(o, conv, idade(o));
    return { ...oportunidade(o, conv, idade(o)), calor, motivos, outras: 0 };
  }).sort((a, b) => b.calor - a.calor || b.valor - a.valor);
}

export function montarRelatorio({ quem, doTime, nome, lista, equipeLista, conv, vendasQuem, vendasTime, opps, padroes, conversas = new Map(), donoPorContato = new Map(), cobertura = null }) {
  const ok = lista.filter((a) => !falhou(a));
  const eq = equipeLista.filter((a) => !falhou(a));
  const p = pontuar(ok), pt = pontuar(eq);
  const eqCom = eq.filter(ehComercial).length;
  const convTime = eqCom ? +((100 * vendasTime.length) / eqCom).toFixed(1) : null;

  // Oportunidades do HighLevel desta pessoa (ou do time inteiro).
  // Oportunidade sem responsável fica com quem atendeu a conversa mais recente daquele contato.
  const minhas = opps.filter((o) => doTime || (quem === SEM_RESP ? !o.responsavel_id : (o.responsavel_id === quem || (!o.responsavel_id && donoPorContato.get(o.contact_id) === quem))));
  const abertas = minhas.filter((o) => o.status === 'open');
  const idade = (o) => (o.atualizada_em ? (Date.now() - new Date(o.atualizada_em).getTime()) / DIA_MS : 999);
  const ativas = abertas.filter((o) => idade(o) <= 30);
  const comValor = abertas.filter((o) => Number(o.valor) > 0);
  const paradas = comValor.filter((o) => idade(o) > 14);
  const dias = (iso) => (iso ? (Date.now() - new Date(iso).getTime()) / DIA_MS : 999);
  const candidatos = abertas.map((o) => {
    const conv = conversas.get(o.contact_id);
    const { calor, motivos } = esquentar(o, conv, idade(o));
    return { ...oportunidade(o, conv, idade(o)), calor, motivos };
  });
  // Uma linha por contato: fica a oportunidade mais quente, e as outras viram um contador.
  const porContato = (lista) => {
    const m = new Map();
    for (const x of lista) {
      const k = x.contact_id || x.id;
      const atual = m.get(k);
      if (!atual) m.set(k, { ...x, outras: 0 });
      else if (x.calor > atual.calor || (x.calor === atual.calor && x.valor > atual.valor)) m.set(k, { ...x, outras: atual.outras + 1 });
      else atual.outras += 1;
    }
    return [...m.values()];
  };
  const produtosDele = analisarProdutos({ conversas: lista, opps: minhas, vendas: vendasQuem }).lista;
  const quentes = porContato(candidatos.filter((x) => x.calor >= 20)).sort((a, b) => b.calor - a.calor || b.valor - a.valor).slice(0, 25);
  const maiores = porContato(candidatos.filter((x) => x.valor > 0)).sort((a, b) => b.valor - a.valor).slice(0, 25);

  // Análise das conversas por assunto.
  const porCat = new Map();
  for (const a of ok) { const l = porCat.get(a.categoria) || []; l.push(a); porCat.set(a.categoria, l); }
  const categorias = [...porCat.entries()].map(([k, l]) => {
    const pp = pontuar(l);
    return { categoria: k, nome: CAT[k] || k, conversas: l.length, nota: pp.nota, resolvidas_pct: pp.medido.resolvidas_pct, oportunidades: l.filter((a) => a.oportunidade_venda && !a.resolvido).length };
  }).sort((a, b) => b.conversas - a.conversas);

  // Diagnóstico: o que está pesando contra e o que está a favor.
  const itens = [];
  const add = (id, tom, titulo, evidencia, acao, roteiro) => itens.push({ id, tom, titulo, evidencia, acao, roteiro: roteiro ? ROTEIRO[roteiro] : null });

  if (!doTime && conv.comerciais >= 10 && convTime != null && conv.conversao != null) {
    const txt = `${conv.vendas} ${conv.vendas === 1 ? 'venda' : 'vendas'} em ${conv.comerciais} conversas comerciais (${conv.conversao}%), contra ${convTime}% do time.`;
    if (conv.conversao < convTime * 0.5) add('conversao', 'critico', 'Taxa de conversão muito abaixo do time', txt, 'Termine toda conversa de compra ou dúvida de produto com o link e um prazo para decidir. Conversa que acaba em "qualquer dúvida me chame" não vira venda.', 'fechamento');
    else if (conv.conversao < convTime * 0.8) add('conversao', 'atencao', 'Taxa de conversão abaixo do time', txt, 'Conduza o cliente até o fechamento: depois de responder, proponha o próximo passo com data.', 'fechamento');
    else if (conv.conversao > convTime * 1.2) add('conversao', 'forte', 'Converte acima do time', txt, 'Documente o que você faz nas conversas que fecham e compartilhe com a equipe.');
  }
  if (paradas.length) {
    const soma = paradas.reduce((s, o) => s + Number(o.valor), 0);
    add('paradas', paradas.length >= 10 ? 'critico' : 'atencao', 'Oportunidades com valor paradas', `${paradas.length} oportunidades com valor (${brl(soma)} no total) sem movimento há mais de 14 dias.`, `Reative hoje as ${Math.min(10, paradas.length)} de maior valor, listadas abaixo. Quem não responder em 2 tentativas vai para perdida, para limpar o funil.`, 'retomada');
  }
  const interesse = ok.filter((a) => a.oportunidade_venda);
  const semFecho = interesse.filter((a) => !a.resolvido);
  if (semFecho.length >= 3) add('interesse', pct(semFecho.length, interesse.length) >= 50 ? 'critico' : 'atencao', 'Interesse de compra sem fechamento', `${semFecho.length} de ${interesse.length} conversas com interesse de compra (${pct(semFecho.length, interesse.length)}%) terminaram sem resolução.`, 'Em toda conversa com interesse, deixe combinado o próximo passo com data e registre no CRM.', 'proximo_passo');
  const tp = p.medido.primeira_resposta_min, tt = pt.medido.primeira_resposta_min;
  if (!doTime && tp != null && tt != null) {
    if (tp > tt * 1.3 && tp > 10) add('resposta', 'atencao', 'Primeira resposta mais lenta que a do time', `${tp} min em horário comercial, contra ${tt} min do time.`, 'Quem espera esfria. Ative alertas de conversa nova e responda o primeiro contato em poucos minutos.', 'rapidez');
    else if (tp < tt * 0.8) add('resposta', 'forte', 'Responde mais rápido que o time', `${tp} min em horário comercial, contra ${tt} min do time.`, 'Mantenha. A rapidez é uma das principais alavancas de conversão.');
  }
  if (!doTime && p.medido.resolvidas_pct <= pt.medido.resolvidas_pct - 8) add('resolucao', 'atencao', 'Resolve menos conversas que o time', `${p.medido.resolvidas_pct}% resolvidas, contra ${pt.medido.resolvidas_pct}% do time.`, 'Antes de encerrar, confirme que o cliente tem o que precisa e o próximo passo.', 'proximo_passo');
  if (!doTime && p.medido.resolvidas_pct >= pt.medido.resolvidas_pct + 8) add('resolucao', 'forte', 'Resolve mais conversas que o time', `${p.medido.resolvidas_pct}% resolvidas, contra ${pt.medido.resolvidas_pct}% do time.`, 'Mantenha o padrão de fechar cada conversa com próximo passo claro.');
  const com = ok.filter((a) => COMERCIAIS.includes(a.categoria));
  const comRes = pct(com.filter((a) => a.resolvido).length, com.length);
  if (com.length >= 8 && comRes < 50) add('comercial', 'atencao', 'Conversas comerciais pouco resolvidas', `Só ${comRes}% das ${com.length} conversas de compra, produto e pagamento foram resolvidas.`, 'Nas conversas comerciais, faça uma pergunta de qualificação antes de oferecer e termine com o convite para inscrição.', 'qualificacao');
  if (!doTime && p.nota != null && pt.nota != null) {
    if (p.nota <= pt.nota - 0.7) add('nota', 'atencao', 'Nota abaixo da média do time', `Nota ${p.nota}, contra ${pt.nota} do time.`, 'Reveja os casos de nota baixa abaixo e padronize as respostas que funcionaram.');
    if (p.nota >= pt.nota + 0.7) add('nota', 'forte', 'Nota acima da média do time', `Nota ${p.nota}, contra ${pt.nota} do time.`, 'Use suas conversas como exemplo para o time.');
  }
  for (const t of padroes.filter((x) => x.n >= 5).slice(0, 2)) add(`tema-${t.tema}`, 'atencao', `Repete em ${pct(t.n, ok.length)}% das conversas: ${t.tema}`, `Apareceu nas avaliações de ${t.n} de ${ok.length} conversas.`, t.dica);
  const melhor = categorias.filter((c) => c.conversas >= 5 && c.nota != null).sort((a, b) => b.nota - a.nota)[0];
  if (melhor && melhor.nota >= 7) add('melhor-cat', 'forte', `Vai bem em ${melhor.nome}`, `Nota ${melhor.nota} em ${melhor.conversas} conversas, ${melhor.resolvidas_pct}% resolvidas.`, 'Leve o mesmo cuidado para as outras categorias.');

  const pecando = itens.filter((i) => i.tom !== 'forte').sort((a, b) => GRAVIDADE[b.tom] - GRAVIDADE[a.tom]);
  const fortes = itens.filter((i) => i.tom === 'forte');
  const plano = pecando.slice(0, 3).map((i, n) => ({ ordem: n + 1, tom: i.tom, titulo: i.titulo, evidencia: i.evidencia, acao: i.acao, roteiro: i.roteiro }));
  const outros = pecando.slice(3).map((i) => ({ tom: i.tom, titulo: i.titulo, evidencia: i.evidencia, acao: i.acao }));
  const comparativo = doTime ? [] : [
    { id: 'conversao', label: 'Taxa de conversão', valor: conv.conversao, time: convTime, unidade: '%', melhor: 'alto' },
    { id: 'resolucao', label: 'Conversas resolvidas', valor: p.medido.resolvidas_pct, time: pt.medido.resolvidas_pct, unidade: '%', melhor: 'alto' },
    { id: 'resposta', label: '1ª resposta', valor: p.medido.primeira_resposta_min, time: pt.medido.primeira_resposta_min, unidade: ' min', melhor: 'baixo' },
    { id: 'nota', label: 'Nota do atendimento', valor: p.nota, time: pt.nota, unidade: '', melhor: 'alto' },
  ];

  const resumo = `${nome}: ${ok.length} conversas, nota ${p.nota ?? '—'}${doTime ? '' : ` (time ${pt.nota ?? '—'})`}, ${vendasQuem.length} ${vendasQuem.length === 1 ? 'venda' : 'vendas'} (${brl(vendasQuem.reduce((s, v) => s + v.valor, 0))})${conv.conversao != null ? `, conversão ${conv.conversao}%` : ''}. ${abertas.length ? `Carteira: ${abertas.length} oportunidades em aberto, ${ativas.length} ativas nos últimos 30 dias${comValor.length ? `, ${comValor.length} com valor (${brl(comValor.reduce((s, o) => s + Number(o.valor), 0))})` : ''}.` : ''}`;

  return {
    resumo, plano, outros, fortes, comparativo, categorias, quentes, maiores, produtos: produtosDele,
    funis: funis(vendasQuem, abertas),
    carteira: { cobertura, abertas: abertas.length, ativas: ativas.length, com_valor: comValor.length, valor_aberto: comValor.reduce((s, o) => s + Number(o.valor), 0), paradas: paradas.length },
    comparacao: doTime ? null : { nota: pt.nota, conversao: convTime, primeira_resposta_min: tt, resolvidas_pct: pt.medido.resolvidas_pct },
  };
}
