// Instagram (social selling): mede o funil de prospecção a partir de TODAS as mensagens de DM (wa_mensagens, tipo "IG")
// e do estágio das oportunidades no CRM. Não usa nota de atendimento: o que importa aqui é abordar, ser respondido,
// qualificar e agendar reunião com lead qualificado. Tudo por regra, sem IA (a análise de qualidade entra depois).
import { nameOf } from './whatsapp.js';
import { usaSnapshot } from './snapshot.js';
import { usaMock, addDias, hojeBrt, diaDe, horaDe, pct, r1 } from './atendimentos.js';
import { estrutura, textosDoCliente, ultimasMensagens, limparTexto } from './mensagens.js';
import { carregarContatos, rotular, tituloDe } from './contatos.js';

const H = 3600e3, DIA = 24 * H;
const sa = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const mediana = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };

// Funis do social selling no CRM (o principal é "Social Selling - Geral"; os demais têm [IG] ou "Social" no nome).
const ehSocial = (o) => /social|\[ig\]/i.test(o.pipeline_nome || '');

// Estágio do lead, do mais frio ao mais quente. Reunião só conta se o lead já foi qualificado (regra do gerente).
export const ESTAGIOS = [
  { n: 0, id: 'frio', rot: 'Comentou / para contactar' },
  { n: 1, id: 'contato', rot: 'Em contato' },
  { n: 2, id: 'qualificado', rot: 'Qualificado' },
  { n: 3, id: 'reuniao', rot: 'Reunião agendada' },
  { n: 4, id: 'venda', rot: 'Venda' },
];
function estagioDe(o) {
  if (o.status === 'won') return 4;
  const e = sa(o.etapa_nome);
  if (/venda realizada/.test(e)) return 4;
  if (/reuniao agendada/.test(e)) return 3;
  // "Em condução" do CRM é ignorado até o time passar a usá-lo com a definição do gerente (troca frequente de mensagens).
  if (/oportunidade estabelecida|negocia/.test(e)) return 2;
  if (/em contato|contatado|respondeu dm|enviou dm|follow|nutricao|solicitou link/.test(e)) return 1;
  return 0;
}

// Qualificado = o CLIENTE falou de produto ou serviço (preço, inscrição, curso, pós, mentoria, atendimento...).
// "Oportunidade estabelecida" no CRM não vale: a maioria é só a primeira mensagem enviada (ativação).
const INTERESSE = /\b(valor(es)?|preco|quanto (custa|e|fica|sai)|investimento|parcel\w*|pagamento|pix|cartao|boleto|inscri\w*|matricul\w*|curso|pos[- ]?gradua\w*|posgrad\w*|mentoria|congresso|formacao|certificad\w*|ementa|grade|atendimento|sessao|consulta|terapia|coaching|lideranca parental|treinamento mental|neurociencia|como funciona|tenho interesse|me interessa|quero saber|gostaria de saber|queria saber|vagas?|quando (comeca|e|sera)|reuniao|agendar|horario|link)\b/;
// Em condução = troca frequente: o cliente respondeu várias vezes e a equipe também.
const EM_CONDUCAO = (c) => c.n_cliente >= 4 && c.n_equipe >= 3;

// Resume uma conversa de DM a partir da estrutura das mensagens (sem texto: é o que pesa) e do texto das falas do cliente.
function resumirConversa(id, ms, textoCliente, agora) {
  const ins = ms.filter((m) => m.direcao === 'inbound');
  const humanas = ms.filter((m) => m.direcao === 'outbound' && m.origem !== 'workflow');
  const primeira = ms[0], ultima = ms[ms.length - 1];
  // Cada vez que o cliente fala e ninguém da equipe responde: guarda quanto demorou. O que ficou sem resposta vira "aguardando".
  const retornos = [];
  let pendente = null, teveRetorno = false;
  for (const m of ms) {
    const t = Date.parse(m.enviada_em);
    if (m.direcao === 'inbound') { if (pendente == null) pendente = t; }
    else if (m.origem !== 'workflow' && pendente != null) { retornos.push({ t0: pendente, espera: t - pendente }); teveRetorno = true; pendente = null; }
  }
  const hora = (t) => +horaDe(new Date(t).toISOString()).slice(0, 2);
  const noExpediente = (t) => hora(t) >= 8 && hora(t) < 21;
  return {
    id, contact_id: ms.find((m) => m.contact_id)?.contact_id || null,
    inicio: primeira.enviada_em, ultima_em: ultima.enviada_em,
    comecou: primeira.direcao === 'inbound' ? 'cliente' : 'empresa',
    automacao_abriu: primeira.direcao === 'outbound' && primeira.origem === 'workflow',
    n_cliente: ins.length, n_equipe: humanas.length,
    respondeu: ins.length > 0, conversou: ins.length >= 2,
    obteve_resposta: ins.length > 0 && teveRetorno, // o cliente falou e uma pessoa da equipe respondeu depois
    retornos: retornos.filter((r) => noExpediente(r.t0)),
    aguardando_desde: pendente, aguardando_h: pendente == null ? null : (agora - pendente) / H,
    texto_cliente: textoCliente || '',
    ultima_de: ultima.direcao === 'inbound' ? 'cliente' : 'equipe',
    user_ids: [...new Set(humanas.map((m) => m.user_id).filter(Boolean))],
  };
}

const cache = new Map();
export async function instagram(dias) {
  const c = cache.get(dias);
  if (c && Date.now() - c.t < (dias === 1 ? 45e3 : 3 * 60e3)) return c.p;
  const ate = hojeBrt(), de = addDias(ate, -(dias - 1));
  const p = calcular(de, ate, dias);
  p.catch(() => { if (cache.get(dias)?.p === p) cache.delete(dias); });
  cache.set(dias, { t: Date.now(), p });
  return p;
}

async function calcular(de, ate, dias) {
  if (usaMock()) return { mock: true, dias, de, ate, disponivel: false, motivo: 'Sem acesso ao banco de WhatsApp (modo de exemplo).' };

  // Tudo em paralelo: estrutura das DMs, texto do cliente, contatos e oportunidades.
  const [msgs, textos, ctx] = await Promise.all([estrutura('IG', de, ate), textosDoCliente('IG', de, ate), carregarContatos()]);
  const { contatos, opps, porContato } = ctx;
  const fim = msgs.length ? Date.parse(msgs[msgs.length - 1].enviada_em) : Date.now();
  const agora = usaSnapshot() ? fim : Date.now();

  const textoPorConv = new Map();
  for (const t of textos) textoPorConv.set(t.conversation_id, (textoPorConv.get(t.conversation_id) || '') + ' ' + sa(t.corpo));
  const porConv = new Map();
  for (const m of msgs) { if (!m.conversation_id) continue; (porConv.get(m.conversation_id) || porConv.set(m.conversation_id, []).get(m.conversation_id)).push(m); }
  const convs = [...porConv].map(([id, ms]) => resumirConversa(id, ms, textoPorConv.get(id), agora));

  // Oportunidades do CRM por contato: o estágio mais avançado entre as de social selling, e quem é o responsável.
  const melhorOpp = (cid) => {
    const l = (porContato.get(cid) || []).filter((o) => o.status === 'open' || o.status === 'won');
    const soc = l.filter(ehSocial), base = soc.length ? soc : l;
    return base.sort((a, b) => estagioDe(b) - estagioDe(a) || String(b.atualizada_em).localeCompare(String(a.atualizada_em)))[0] || null;
  };
  for (const c of convs) {
    const o = melhorOpp(c.contact_id);
    const k = contatos.get(c.contact_id);
    c.opp = o;
    c.estagio = o ? estagioDe(o) : null;
    c.dono = o?.responsavel_id || k?.responsavel_id || c.user_ids[0] || 'sem-responsavel';
    c.qualificado = (c.n_cliente >= 2 && INTERESSE.test(c.texto_cliente)) || (c.estagio != null && c.estagio >= 3);
    c.conducao = EM_CONDUCAO(c);
    const r = rotular(k?.nome || o?.contato_nome);
    c.perfil = r.perfil;
    c.contato = tituloDe(r, c.contact_id);
    c.telefone = k?.telefone || o?.contato_telefone || null;
    c.email = k?.email || o?.contato_email || null;
  }

  const retornosMin = (l) => l.flatMap((c) => c.retornos.map((r) => r.espera / 60e3));
  const funil = (l) => {
    const abordadas = l.filter((c) => c.comecou === 'empresa');
    const interagiram = l.filter((c) => c.respondeu);
    const comOpp = (n) => l.filter((c) => c.estagio != null && c.estagio >= n).length;
    return {
      conversas: l.length,
      // Quem a equipe procurou, quem chamou primeiro, quem interagiu, quem foi respondido e quem espera.
      contactadas: abordadas.length, chamaram_primeiro: l.length - abordadas.length, abordadas: abordadas.length, abordadas_respondidas: abordadas.filter((c) => c.respondeu).length,
      interagiram: interagiram.length, obtiveram_resposta: interagiram.filter((c) => c.obteve_resposta).length,
      em_aberto: interagiram.filter((c) => c.aguardando_desde != null).length, em_aberto_24h: interagiram.filter((c) => c.aguardando_h > 24).length,
      sem_resposta_do_cliente: abordadas.filter((c) => !c.respondeu).length,
      responderam: interagiram.length, conversaram: l.filter((c) => c.conversou).length,
      qualificados: l.filter((c) => c.qualificado).length, em_conducao: l.filter((c) => c.conducao).length,
      reunioes: comOpp(3), reunioes_qualificadas: l.filter((c) => c.estagio != null && c.estagio >= 3 && c.qualificado).length, vendas: comOpp(4),
    };
  };
  const f = funil(convs);
  const etapas = [
    { id: 'conversas', rot: 'Conversas no período', n: f.conversas, dica: 'Contatos com ao menos uma DM no período.' },
    { id: 'responderam', rot: 'Responderam', n: f.responderam, dica: 'O cliente enviou ao menos uma mensagem.' },
    { id: 'conversaram', rot: 'Conversaram', n: f.conversaram, dica: 'O cliente enviou 2 ou mais mensagens: houve diálogo, não só um "oi".' },
    { id: 'qualificados', rot: 'Qualificados (falaram de produto ou serviço)', n: f.qualificados, dica: 'O cliente respondeu 2 ou mais vezes e falou de preço, inscrição, curso, pós, mentoria, atendimento etc. Não usa o estágio do CRM.' },
    { id: 'reunioes', rot: 'Reunião agendada', n: f.reunioes, dica: 'Oportunidade em "Reunião Agendada" no CRM. É a meta do social selling (vale com lead qualificado).' },
    { id: 'vendas', rot: 'Venda', n: f.vendas, dica: 'Oportunidade ganha ou em "Venda realizada".' },
  ].map((e, i, a) => ({ ...e, pct_anterior: i === 0 ? null : pct(e.n, a[i - 1].n), pct_total: pct(e.n, f.conversas) }));

  // Por vendedor
  const donos = [...new Set(convs.map((c) => c.dono))];
  const vendedores = donos.map((id) => {
    const l = convs.filter((c) => c.dono === id), x = funil(l), r = retornosMin(l);
    return { id, nome: nameOf(id), ...x, taxa_resposta: pct(x.abordadas_respondidas, x.abordadas), mediana_retorno_min: r.length ? Math.round(mediana(r)) : null, sem_retorno: l.filter((c) => c.aguardando_h > 24).length };
  }).sort((a, b) => b.conversas - a.conversas);

  // Série diária: abordagens iniciadas pela empresa e primeiras respostas de clientes.
  const serie = [];
  for (let i = dias - 1; i >= 0; i--) {
    const d = addDias(ate, -i);
    const doDia = convs.filter((c) => diaDe(c.inicio) === d);
    serie.push({ dia: d, abordagens: doDia.filter((c) => c.comecou === 'empresa').length, respostas: doDia.filter((c) => c.comecou === 'empresa' && c.respondeu).length, novos_do_cliente: doDia.filter((c) => c.comecou === 'cliente').length });
  }

  // Listas de trabalho. Só para elas se busca o texto da última mensagem (uma consulta curta).
  const vacuo = convs.filter((c) => c.aguardando_h != null && c.aguardando_h > 24 && c.respondeu)
    .sort((a, b) => b.n_cliente - a.n_cliente || a.aguardando_h - b.aguardando_h).slice(0, 40);
  const qualSemReuniao = convs.filter((c) => c.qualificado && !(c.estagio >= 3)).sort((a, b) => b.ultima_em.localeCompare(a.ultima_em)).slice(0, 40);
  const semOpp = convs.filter((c) => !porContato.get(c.contact_id)?.length);
  const exemplosSemOpp = semOpp.filter((c) => c.respondeu).slice(0, 8);
  const ultimas = await ultimasMensagens([...vacuo, ...qualSemReuniao, ...exemplosSemOpp].map((c) => c.id), de).catch(() => new Map());
  for (const c of [...vacuo, ...qualSemReuniao, ...exemplosSemOpp]) c.ultima_texto = ultimas.has(c.id) ? limparTexto(ultimas.get(c.id).corpo) : '(abra a conversa)';

  const semRetorno = vacuo.map((c) => caso(c, { tipo: c.n_equipe ? 'Esfriou: respondeu e ninguém voltou' : 'Nunca foi respondida por uma pessoa' }));
  const qualificadosSemReuniao = qualSemReuniao.map((c) => {
    const o = c.opp;
    return {
      id: c.id, opp_id: o?.id || null, contato: c.contato, perfil: r_perfil(c), telefone: c.telefone, email: c.email,
      etapa: o?.etapa_nome || 'Sem oportunidade no CRM', funil: o?.pipeline_nome || null, valor: Number(o?.valor) || 0, dono: nameOf(c.dono),
      parado_dias: Math.floor((agora - Date.parse(c.ultima_em)) / DIA),
      ultima_msg: c.ultima_texto, ultima_de: c.ultima_de, mensagens_cliente: c.n_cliente,
      tipo: c.conducao ? 'Em condução: troca frequente de mensagens' : 'Falou de produto ou serviço, ainda sem reunião',
    };
  });
  const socialAbertas = opps.filter((o) => o.status === 'open' && ehSocial(o));

  // Higiene do CRM
  const contatosIg = new Set(convs.map((c) => c.contact_id).filter(Boolean));
  const paradas = socialAbertas.filter((o) => estagioDe(o) === 1 && o.atualizada_em && agora - Date.parse(o.atualizada_em) > 7 * DIA);
  const vendaAberta = socialAbertas.filter((o) => /venda realizada/.test(sa(o.etapa_nome)));
  const porContatoConv = new Map();
  for (const c of convs) if (c.contact_id) porContatoConv.set(c.contact_id, c);
  const declaradasAvancadas = socialAbertas.filter((o) => estagioDe(o) === 2);
  const soAtivacao = declaradasAvancadas.filter((o) => !porContatoConv.get(o.contact_id)?.respondeu);
  const higiene = {
    estabelecida_so_ativacao: { n: soAtivacao.length, de: declaradasAvancadas.length },
    contatos_sem_oportunidade: { n: semOpp.length, pct: pct(semOpp.length, convs.length), exemplos: exemplosSemOpp.map((c) => caso(c, {})) },
    para_contactar: socialAbertas.filter((o) => /para contactar/.test(sa(o.etapa_nome))).length,
    em_contato_parados_7d: paradas.length,
    venda_realizada_aberta: vendaAberta.map((o) => ({ contato: tituloDe(rotular(o.contato_nome || o.nome), null), valor: Number(o.valor) || 0, dono: nameOf(o.responsavel_id || 'sem-responsavel'), etapa: o.etapa_nome })),
    sem_responsavel: socialAbertas.filter((o) => !o.responsavel_id).length,
    total_social_abertas: socialAbertas.length,
    contatos_ig: contatosIg.size,
  };

  const todos = retornosMin(convs);
  const geral = {
    ...f, taxa_resposta: pct(f.abordadas_respondidas, f.abordadas), taxa_conversa: pct(f.conversaram, f.conversas),
    interagiram_pct: pct(f.interagiram, f.conversas), obtiveram_pct: pct(f.obtiveram_resposta, f.interagiram), em_aberto_pct: pct(f.em_aberto, f.interagiram),
    mediana_retorno_min: todos.length ? Math.round(mediana(todos)) : null,
    retorno_1h_pct: todos.length ? pct(todos.filter((m) => m <= 60).length, todos.length) : null,
    retorno_amostra: todos.length,
    sem_retorno: f.em_aberto_24h,
    abordagens_por_dia: r1(f.abordadas / dias),
    automacao_abriu: convs.filter((c) => c.automacao_abriu).length,
  };

  return { mock: false, disponivel: true, dias, de, ate, geral, etapas, vendedores, serie, sem_retorno: semRetorno, qualificados: qualificadosSemReuniao, higiene, insights: leitura({ geral, etapas, vendedores, higiene, f }), tem_opps: opps.length > 0 };
}

// Mostra o @ ao lado só quando o título já não é o próprio @.
const r_perfil = (c) => (c.perfil && c.contato !== `@${c.perfil}` ? c.perfil : null);

function caso(c, extra) {
  return {
    id: c.id, contato: c.contato, perfil: r_perfil(c), etapa: c.opp?.etapa_nome || null, funil: c.opp?.pipeline_nome || null, dono: nameOf(c.dono),
    telefone: c.telefone, email: c.email,
    quando: c.aguardando_desde ? new Date(c.aguardando_desde).toISOString() : c.ultima_em,
    parado_dias: c.aguardando_h != null ? Math.floor(c.aguardando_h / 24) : null,
    mensagens_cliente: c.n_cliente, ultima_msg: c.ultima_texto, ultima_de: c.ultima_de, ...extra,
  };
}

// Leitura em frases: o que os números querem dizer para quem gerencia o social selling.
function leitura({ geral: g, etapas, vendedores, higiene: h, f }) {
  const out = [];
  if (!f.conversas) return [{ tom: 'info', texto: 'Ainda não há mensagens de Instagram no período.' }];
  out.push({ tom: g.taxa_resposta < 40 ? 'atencao' : 'info', texto: `${f.contactadas} pessoas contactadas no período (${g.abordagens_por_dia} por dia) e ${f.chamaram_primeiro} que chamaram primeiro. ${g.interagiram_pct}% das ${f.conversas} pessoas interagiram, e ${g.taxa_conversa}% viraram conversa de verdade (2 ou mais mensagens do cliente).` });
  if (f.interagiram) out.push({ tom: g.obtiveram_pct < 70 ? 'atencao' : 'info', texto: `Das ${f.interagiram} pessoas que interagiram, ${f.obtiveram_resposta} (${g.obtiveram_pct}%) receberam resposta da equipe e ${f.em_aberto} estão em aberto, esperando resposta agora${f.em_aberto_24h ? ` (${f.em_aberto_24h} há mais de 24 h)` : ''}.` });
  // Maior queda entre etapas consecutivas a partir de "conversaram"
  const quedas = etapas.slice(3).filter((e) => e.pct_anterior != null);
  const pior = quedas.sort((a, b) => a.pct_anterior - b.pct_anterior)[0];
  if (etapas[2].n >= 10 && pior) {
    const ant = etapas[etapas.indexOf(pior) - 1];
    out.push({ tom: 'atencao', texto: `A maior perda do funil está entre "${ant.rot}" (${ant.n}) e "${pior.rot}" (${pior.n}): só ${pior.pct_anterior}% avançam. É aí que o gerente deve olhar as conversas.` });
  }
  if (h.estabelecida_so_ativacao.de) out.push({ tom: 'atencao', texto: `${h.estabelecida_so_ativacao.n} de ${h.estabelecida_so_ativacao.de} oportunidades em "Oportunidade estabelecida" ou "Em negociação" nunca tiveram resposta do cliente: é só ativação (primeira mensagem enviada). O estágio do CRM está inflado, por isso o painel mede a qualificação pela conversa.` });
  if (f.em_conducao) out.push({ tom: 'info', texto: `${f.em_conducao} conversas estão em condução de verdade (o cliente respondeu 4 ou mais vezes e a equipe acompanhou).` });
  if (f.reunioes === 0) out.push({ tom: 'atencao', texto: 'Nenhum lead do período está em "Reunião agendada". Se a meta é agendamento, a conversa não está chegando ao convite, ou o estágio não está sendo atualizado no CRM.' });
  else out.push({ tom: 'info', texto: `${f.reunioes} lead(s) em "Reunião agendada" ou além, de ${f.qualificados} qualificados pela conversa (${pct(f.reunioes, f.qualificados)}%). ${f.reunioes_qualificadas} deles falaram de produto ou serviço antes de agendar.` });
  if (g.mediana_retorno_min != null) {
    const lento = g.mediana_retorno_min > 120;
    out.push({ tom: lento ? 'atencao' : 'info', texto: `Quando o cliente responde (entre 8h e 21h), a equipe volta em ${g.mediana_retorno_min >= 60 ? `${r1(g.mediana_retorno_min / 60)} h` : `${g.mediana_retorno_min} min`} na mediana. ${g.retorno_1h_pct}% são respondidos em até 1 hora.` });
  }
  if (h.contatos_sem_oportunidade.n) out.push({ tom: 'atencao', texto: `${h.contatos_sem_oportunidade.n} contatos (${h.contatos_sem_oportunidade.pct}%) com conversa no Instagram não têm nenhuma oportunidade no CRM. Eles não aparecem em nenhum funil nem em nenhum relatório.` });
  if (h.venda_realizada_aberta.length) out.push({ tom: 'atencao', texto: `${h.venda_realizada_aberta.length} oportunidade(s) estão em "Venda realizada" mas com status aberto. Se foram vendas, marque como ganho no HighLevel, senão não entram na receita.` });
  if (h.em_contato_parados_7d) out.push({ tom: 'info', texto: `${h.em_contato_parados_7d} leads em "Em contato" estão há mais de 7 dias sem movimento. Decidir: retomar com follow-up ou encerrar.` });
  const top = vendedores[0];
  if (top && vendedores.length > 1 && pct(top.conversas, f.conversas) >= 70) out.push({ tom: 'info', texto: `${top.nome} concentra ${pct(top.conversas, f.conversas)}% das conversas do Instagram. O resultado do canal depende quase só dela.` });
  return out;
}
