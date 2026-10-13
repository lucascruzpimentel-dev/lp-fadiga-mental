// Visão do dia: o que aconteceu de verdade nas mensagens (wa_mensagens), por canal e no geral.
// Diferente da aba de casos analisados, que depende da IA (ela só analisa 2 h depois que a conversa para), aqui a conta é direta:
// quantos clientes escreveram, quantos foram respondidos por pessoa ou só por automação, quem respondeu, quem espera.
// Quando a IA já analisou a conversa, o resumo, a nota e o "resolvido" dela aparecem junto, no mesmo caso.
import { sb, nameOf } from './whatsapp.js';
import { usaSnapshot } from './snapshot.js';
import { usaMock, brt, diaDe, hojeBrt, addDias, pct, r1, avg } from './atendimentos.js';
import { estrutura, textosDoCliente, limparTexto } from './mensagens.js';
import { carregarContatos, rotular, tituloDe } from './contatos.js';

const MIN = 60e3;
const SEM_ID = 'sem-identificacao';
const mediana = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
const nomeDono = (id) => (!id || id === SEM_ID || id === 'sem-responsavel' ? null : nameOf(id));

const cache = new Map();
export async function visaoDia(dia) {
  const c = cache.get(dia);
  const ttl = dia === hojeBrt() ? 45e3 : 5 * MIN;
  if (c && Date.now() - c.t < ttl) return c.p;
  const p = calcular(dia);
  p.catch(() => { if (cache.get(dia)?.p === p) cache.delete(dia); });
  cache.set(dia, { t: Date.now(), p });
  if (cache.size > 40) cache.delete(cache.keys().next().value);
  return p;
}

// Um registro por conversa e por dia em que houve mensagem.
function registros(conv, donoPadrao) {
  const ms = conv.ms;
  const humanas = [], robo = [];
  for (const m of ms) if (m.direcao === 'outbound') (m.origem === 'workflow' ? robo : humanas).push({ t: Date.parse(m.enviada_em), user: m.user_id });
  const ultima = ms[ms.length - 1];
  const esperando = ultima.direcao === 'inbound';
  const primeiraEhCliente = ms[0].direcao === 'inbound';
  const porDia = new Map();
  for (const m of ms) {
    const d = diaDe(m.enviada_em);
    const r = porDia.get(d) || porDia.set(d, { dia: d, canal: conv.canal, id: conv.id, contact_id: conv.contact_id, recebidas: 0, enviadas: 0, automacao: 0, entradaT: null, donos: new Map(), novas: false }).get(d);
    const t = Date.parse(m.enviada_em);
    if (m.direcao === 'inbound') { r.recebidas++; if (r.entradaT == null) r.entradaT = t; }
    else if (m.origem === 'workflow') r.automacao++;
    else { r.enviadas++; const dono = m.user_id || donoPadrao; r.donos.set(dono, (r.donos.get(dono) || 0) + 1); }
  }
  const out = [];
  for (const r of porDia.values()) {
    r.ultimaEm = ultima.enviada_em;
    if (r.entradaT != null) {
      const pessoa = humanas.find((h) => h.t > r.entradaT);
      const bot = robo.find((h) => h.t > r.entradaT);
      r.pessoaMin = pessoa ? (pessoa.t - r.entradaT) / MIN : null;
      r.respondida = !!(pessoa || bot);
      r.porPessoa = !!pessoa;
      r.soAutomacao = !pessoa && !!bot;
      r.esperando = esperando;
      r.novas = primeiraEhCliente && diaDe(ms[0].enviada_em) === r.dia;
      r.respondedor = pessoa ? (pessoa.user || donoPadrao) : null;
    }
    out.push(r);
  }
  return out;
}

function kpis(rs) {
  const cli = rs.filter((r) => r.entradaT != null);
  const tempos = cli.filter((r) => r.pessoaMin != null).map((r) => r.pessoaMin);
  const n = cli.length;
  return {
    recebidas: rs.reduce((s, r) => s + r.recebidas, 0), clientes: n, novas: cli.filter((r) => r.novas).length,
    enviadas: rs.reduce((s, r) => s + r.enviadas, 0), automacao: rs.reduce((s, r) => s + r.automacao, 0),
    respondidas: cli.filter((r) => r.respondida).length, por_pessoa: cli.filter((r) => r.porPessoa).length, so_automacao: cli.filter((r) => r.soAutomacao).length,
    sem_resposta: cli.filter((r) => !r.respondida).length, aguardando: cli.filter((r) => r.esperando).length,
    respondidas_pct: pct(cli.filter((r) => r.respondida).length, n), pessoa_pct: pct(cli.filter((r) => r.porPessoa).length, n),
    primeira_resposta_min: tempos.length ? Math.round(mediana(tempos)) : null,
    ate_1h_pct: tempos.length ? pct(tempos.filter((t) => t <= 60).length, tempos.length) : null,
  };
}

async function calcular(dia) {
  if (usaMock()) return { dia, disponivel: false, motivo: 'Sem acesso ao banco de mensagens (modo de exemplo).' };
  const hoje = hojeBrt();
  const de = addDias(dia, -13), ate = addDias(dia, 1) > hoje ? hoje : addDias(dia, 1);
  const ateTexto = dia > hoje ? hoje : dia;

  // Tudo em paralelo: estrutura das mensagens, textos do cliente do dia, análises da IA e contatos.
  const [wa, ig, textosWa, textosIg, leves, completas, ctx, igAnalises] = await Promise.all([
    estrutura('WhatsApp', de, ate), estrutura('IG', de, ate),
    textosDoCliente('WhatsApp', dia, ateTexto), textosDoCliente('IG', dia, ateTexto),
    sb('wa_analises', { select: 'conversation_id,inicio,resolvido,nota,oportunidade_venda,alerta', inicio: `gte.${de}T03:00:00Z`, order: 'inicio.desc' }).catch(() => []),
    sb('wa_analises', { select: 'conversation_id,inicio,categoria,resolvido,nota,alerta,oportunidade_venda,sentimento,resumo,motivo,proxima_acao,pontos_fortes,pontos_melhoria', inicio: `gte.${addDias(dia, -2)}T03:00:00Z`, order: 'inicio.desc' }).catch(() => []),
    carregarContatos(),
    sb('ig_analises', { select: 'conversation_id,ultima_msg_em,etapa,qualificado,interesse_produto,objecao,personalizacao,qualificacao,convite,followup,nota,resumo,proxima_acao,mensagem_sugerida,pontos_melhoria', ultima_msg_em: `gte.${addDias(dia, -2)}T03:00:00Z`, order: 'ultima_msg_em.desc' }).catch(() => []),
  ]);
  const { contatos } = ctx;
  const iaIg = new Map();
  for (const a of igAnalises) if (!iaIg.has(a.conversation_id)) iaIg.set(a.conversation_id, a);
  const ETAPAS_IG = { respondeu: 'Só respondeu', conversa: 'Conversa sem produto', qualificado: 'Qualificado', convite_feito: 'Convite feito', agendado: 'Agendado', recusou: 'Recusou', esfriou: 'Esfriou' };
  const fimDados = [wa, ig].flatMap((l) => (l.length ? [Date.parse(l[l.length - 1].enviada_em)] : [])).reduce((a, b) => Math.max(a, b), 0) || Date.now();
  const agora = usaSnapshot() ? fimDados : Date.now();

  // Texto da última fala do cliente no dia, por conversa.
  const ultimoTexto = new Map();
  for (const m of [...textosWa, ...textosIg]) ultimoTexto.set(m.conversation_id, m.corpo);

  // Registros por conversa e por dia
  const recs = [];
  for (const [canal, lista] of [['whatsapp', wa], ['instagram', ig]]) {
    const porConv = new Map();
    for (const m of lista) { if (!m.conversation_id) continue; (porConv.get(m.conversation_id) || porConv.set(m.conversation_id, []).get(m.conversation_id)).push(m); }
    for (const [id, ms] of porConv) {
      const contact_id = ms.find((m) => m.contact_id)?.contact_id || null;
      recs.push(...registros({ id, canal, contact_id, ms }, contatos.get(contact_id)?.responsavel_id || SEM_ID));
    }
  }

  // Análises da IA: a mais recente de cada conversa.
  const iaLeve = new Map(), iaCompleta = new Map();
  for (const a of leves) if (!iaLeve.has(a.conversation_id)) iaLeve.set(a.conversation_id, a);
  for (const a of completas) if (!iaCompleta.has(a.conversation_id)) iaCompleta.set(a.conversation_id, a);

  const dias14 = []; for (let i = 13; i >= 0; i--) dias14.push(addDias(dia, -i));

  const canais = {};
  for (const canal of ['whatsapp', 'instagram', 'geral']) {
    const base = canal === 'geral' ? recs : recs.filter((r) => r.canal === canal);
    const porDia = new Map(dias14.map((d) => [d, []]));
    for (const r of base) porDia.get(r.dia)?.push(r);
    const hojeRs = porDia.get(dia) || [];
    const k = kpis(hojeRs);

    const serie = dias14.slice(6).map((d) => { const x = kpis(porDia.get(d)); return { dia: d, recebidas: x.recebidas, clientes: x.clientes, por_pessoa: x.por_pessoa, sem_resposta: x.sem_resposta, respondidas_pct: x.respondidas_pct, primeira_resposta_min: x.primeira_resposta_min }; });
    const anteriores = serie.slice(0, 7);
    const media = (c) => { const v = anteriores.map((x) => x[c]).filter((x) => x != null); return v.length ? r1(v.reduce((s, x) => s + x, 0) / v.length) : null; };

    // Semana contra a semana anterior (7 dias cada)
    const semana = (ds) => {
      const rs = ds.flatMap((d) => porDia.get(d)); const x = kpis(rs);
      const ids = new Set(rs.filter((r) => r.entradaT != null).map((r) => r.id));
      const ias = canal === 'instagram' ? [] : [...ids].map((id) => iaLeve.get(id)).filter(Boolean);
      const notas = ias.filter((a) => a.nota != null).map((a) => a.nota);
      return { clientes: x.clientes, por_pessoa: x.por_pessoa, pessoa_pct: x.pessoa_pct, sem_resposta: x.sem_resposta, primeira_resposta_min: x.primeira_resposta_min, analisadas: ias.length, resolvidas_pct: pct(ias.filter((a) => a.resolvido).length, ias.length), nota: notas.length ? r1(avg(notas)) : null, oportunidades: ias.filter((a) => a.oportunidade_venda && !a.resolvido).length };
    };

    // IA do dia
    const idsDia = new Set(hojeRs.filter((r) => r.entradaT != null).map((r) => r.id));
    const iaDia = canal === 'instagram' ? [] : [...idsDia].map((id) => iaLeve.get(id)).filter(Boolean);
    const notasDia = iaDia.filter((a) => a.nota != null).map((a) => a.nota);
    const ia = { analisadas: iaDia.length, resolvidas: iaDia.filter((a) => a.resolvido).length, resolvidas_pct: pct(iaDia.filter((a) => a.resolvido).length, iaDia.length), interesse_compra: iaDia.filter((a) => a.oportunidade_venda && !a.resolvido).length, alertas: iaDia.filter((a) => a.alerta && !['nenhum', 'cliente_sem_resposta'].includes(a.alerta)).length, nota: notasDia.length ? r1(avg(notasDia)) : null };

    // Por hora e por atendente (só do dia)
    const porHora = Array.from({ length: 24 }, (_, h) => ({ hora: `${String(h).padStart(2, '0')}h`, recebidas: 0, respostas: 0 }));
    const fontes = canal === 'geral' ? [wa, ig] : [canal === 'whatsapp' ? wa : ig];
    for (const l of fontes) for (const m of l) {
      if (diaDe(m.enviada_em) !== dia) continue;
      const h = +brt(m.enviada_em).slice(11, 13);
      if (m.direcao === 'inbound') porHora[h].recebidas++; else if (m.origem !== 'workflow') porHora[h].respostas++;
    }
    const atend = new Map();
    for (const r of hojeRs) {
      for (const [dono, n] of r.donos) { const a = atend.get(dono) || { id: dono, conversas: 0, mensagens: 0, tempos: [] }; a.mensagens += n; atend.set(dono, a); }
      if (r.porPessoa) { const a = atend.get(r.respondedor) || { id: r.respondedor, conversas: 0, mensagens: 0, tempos: [] }; a.conversas++; a.tempos.push(r.pessoaMin); atend.set(r.respondedor, a); }
    }
    const atendentes = [...atend.values()].map((a) => ({ id: a.id, nome: a.id === SEM_ID || a.id === 'sem-responsavel' ? 'Sem identificação (celular)' : nameOf(a.id), conversas: a.conversas, mensagens: a.mensagens, primeira_resposta_min: a.tempos.length ? Math.round(mediana(a.tempos)) : null })).sort((a, b) => b.conversas - a.conversas || b.mensagens - a.mensagens);

    // Casos do dia: todo cliente que escreveu, com o que a IA já disse quando existe.
    const casos = hojeRs.filter((r) => r.entradaT != null).map((r) => {
      const ct = contatos.get(r.contact_id); const rot = rotular(ct?.nome);
      const a = r.canal === 'instagram' ? null : iaCompleta.get(r.id);
      const g = r.canal === 'instagram' ? iaIg.get(r.id) : null;
      const dono = r.respondedor || ct?.responsavel_id || SEM_ID;
      return {
        id: r.id, canal: r.canal, contato: tituloDe(rot, r.contact_id), telefone: ct?.telefone || null, email: ct?.email || null,
        hora: brt(new Date(r.entradaT).toISOString()).slice(11, 16), mensagens_cliente: r.recebidas, enviadas: r.enviadas, automacao: r.automacao,
        estado: r.porPessoa ? 'pessoa' : r.soAutomacao ? 'automacao' : 'sem_resposta', esperando: r.esperando, atendente: nomeDono(dono),
        primeira_resposta_min: r.pessoaMin != null ? Math.round(r.pessoaMin) : null,
        espera_min: r.esperando ? Math.round((agora - Date.parse(r.ultimaEm)) / MIN) : null,
        ultima_msg: ultimoTexto.has(r.id) ? limparTexto(ultimoTexto.get(r.id)) : null,
        ia: g ? { tipo: 'ig', nota: g.nota, etapa: g.etapa, etapa_rot: ETAPAS_IG[g.etapa] || g.etapa, qualificado: !!g.qualificado, produto: g.interesse_produto, objecao: g.objecao, personalizacao: g.personalizacao, qualificacao: g.qualificacao, convite: g.convite, followup: g.followup, resumo: g.resumo, proxima_acao: g.proxima_acao, mensagem_sugerida: g.mensagem_sugerida, melhorias: g.pontos_melhoria || [] } : a ? { nota: a.nota, resolvido: !!a.resolvido, categoria: a.categoria, sentimento: a.sentimento, alerta: a.alerta && a.alerta !== 'nenhum' ? a.alerta : null, oportunidade: !!a.oportunidade_venda, resumo: a.resumo, motivo: a.motivo, proxima_acao: a.proxima_acao || null, fortes: a.pontos_fortes || [], melhorias: a.pontos_melhoria || [] } : null,
      };
    }).sort((a, b) => (b.esperando - a.esperando) || ((b.espera_min || 0) - (a.espera_min || 0)) || b.hora.localeCompare(a.hora));

    canais[canal] = {
      ...k, ia, por_hora: porHora, serie, atendentes, casos,
      lista_lentas: casos.filter((c) => c.primeira_resposta_min > 60).sort((a, b) => b.primeira_resposta_min - a.primeira_resposta_min).slice(0, 15).map((c) => ({ id: c.id, canal: c.canal, contato: c.contato, minutos: c.primeira_resposta_min, dono: c.atendente })),
      ontem: anteriores[6], media_7: { recebidas: media('recebidas'), clientes: media('clientes'), por_pessoa: media('por_pessoa'), respondidas_pct: media('respondidas_pct'), primeira_resposta_min: media('primeira_resposta_min') },
      semana: { atual: semana(dias14.slice(7)), anterior: semana(dias14.slice(0, 7)) },
    };
  }
  const insights = leitura(canais, dia);
  for (const k of Object.keys(canais)) canais[k].insights = insights[k];
  canais.geral.casos = null; // o Geral junta os casos dos dois canais na própria tela: não repete a lista no envio
  return { dia, hoje, disponivel: true, parcial: dia === hoje, dados_ate: new Date(fimDados).toISOString(), canais };
}

function leitura(c, dia) {
  const w = c.whatsapp, g = c.instagram;
  const fim = dia === hojeBrt() ? ' até agora' : '';
  const t = (min) => (min >= 60 ? `${r1(min / 60)} h` : `${min} min`);
  const canal = (x, nome, verbo) => {
    const out = [];
    if (!x.clientes) return [{ tom: 'info', texto: `Nenhum cliente ${verbo} no ${nome}${fim}.` }];
    out.push({ tom: 'info', texto: `${x.clientes} clientes ${verbo} no ${nome}${fim} (${x.recebidas} mensagens, ${x.novas} conversas novas)${x.media_7.clientes != null ? `; a média dos 7 dias anteriores é ${x.media_7.clientes} por dia` : ''}.` });
    if (x.por_pessoa === 0) out.push({ tom: 'atencao', texto: `Ninguém da equipe respondeu a nenhum dos ${x.clientes} clientes. ${x.so_automacao} receberam só automação e ${x.sem_resposta} não receberam nada.` });
    else if (x.pessoa_pct < 50) out.push({ tom: 'atencao', texto: `Só ${x.pessoa_pct}% dos clientes foram respondidos por uma pessoa (${x.por_pessoa} de ${x.clientes}). ${x.so_automacao} receberam só automação e ${x.sem_resposta} não receberam nada.` });
    else out.push({ tom: 'info', texto: `${x.pessoa_pct}% dos clientes foram respondidos por uma pessoa (${x.por_pessoa} de ${x.clientes}); ${x.so_automacao} receberam só automação.` });
    if (x.primeira_resposta_min != null) out.push({ tom: x.primeira_resposta_min > 30 ? 'atencao' : 'info', texto: `A primeira resposta de uma pessoa levou ${t(x.primeira_resposta_min)} na mediana (${x.ate_1h_pct}% em até 1 h)${x.media_7.primeira_resposta_min != null ? `; nos 7 dias anteriores, ${t(x.media_7.primeira_resposta_min)}` : ''}.` });
    if (x.aguardando) out.push({ tom: 'atencao', texto: `${x.aguardando} clientes estão esperando resposta. Use o filtro "Esperando" na lista abaixo.` });
    const pico = x.por_hora.map((h, i) => [i, h.recebidas]).sort((a, b) => b[1] - a[1])[0];
    if (pico && pico[1] >= 5) out.push({ tom: 'info', texto: `Pico de mensagens às ${pico[0]}h (${pico[1]} recebidas). Vale conferir se há gente respondendo nesse horário.` });
    return out;
  };
  const ia = (x) => (x.clientes ? [{ tom: 'info', texto: `A IA já analisou ${x.ia.analisadas} das ${x.clientes} conversas do dia${x.ia.analisadas ? `: ${x.ia.resolvidas_pct}% resolvidas e ${x.ia.interesse_compra} com interesse de compra sem fechar` : ''}. Ela analisa cada conversa 2 h depois que ela para, então o dia de hoje fecha só amanhã.` }] : []);
  const geral = [];
  if (!w.clientes && !g.clientes) geral.push({ tom: 'info', texto: `Nenhum cliente escreveu neste dia${fim}.` });
  else {
    geral.push({ tom: 'info', texto: `${w.clientes + g.clientes} clientes escreveram${fim}: ${w.clientes} no WhatsApp e ${g.clientes} no Instagram. ${w.recebidas + g.recebidas} mensagens recebidas no total.` });
    if (w.clientes) geral.push(w.por_pessoa === 0 ? { tom: 'atencao', texto: `No WhatsApp, ninguém da equipe respondeu a nenhum dos ${w.clientes} clientes do dia.` } : { tom: w.pessoa_pct < 50 ? 'atencao' : 'info', texto: `No WhatsApp, ${w.pessoa_pct}% dos clientes foram respondidos por uma pessoa, em ${w.primeira_resposta_min != null ? t(w.primeira_resposta_min) : '—'} na mediana.` });
    if (g.clientes) geral.push({ tom: g.pessoa_pct < 50 ? 'atencao' : 'info', texto: `No Instagram, ${g.pessoa_pct}% dos ${g.clientes} clientes foram respondidos por uma pessoa, em ${g.primeira_resposta_min != null ? t(g.primeira_resposta_min) : '—'} na mediana.` });
    const ag = w.aguardando + g.aguardando;
    if (ag) geral.push({ tom: 'atencao', texto: `${ag} clientes estão esperando resposta (${w.aguardando} no WhatsApp, ${g.aguardando} no Instagram).` });
    geral.push(...ia(w).map((i) => ({ ...i, texto: 'WhatsApp: ' + i.texto })));
  }
  return { geral, whatsapp: [...canal(w, 'WhatsApp', 'escreveram'), ...ia(w)], instagram: canal(g, 'Instagram', 'responderam ou escreveram') };
}
