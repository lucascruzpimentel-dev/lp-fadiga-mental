// Visão do dia: o que aconteceu de verdade nas mensagens (wa_mensagens), por canal e no geral.
// Diferente da aba de casos, que depende da análise da IA (feita 2 h depois que a conversa para), aqui a conta é direta:
// quantos clientes escreveram, quantos foram respondidos por pessoa ou só por automação, quem respondeu, quem espera.
import { sb, nameOf, NOMES_GHL } from './whatsapp.js';
import { usaSnapshot } from './snapshot.js';
import { usaMock, brt, diaDe, hojeBrt, addDias, pct, r1 } from './atendimentos.js';
import { carregarOportunidades } from './vendas.js';
import { rotular } from './instagram.js';

const H = 3600e3, MIN = 60e3;
const CANAL = { WhatsApp: 'whatsapp', IG: 'instagram', FB: 'instagram' };
const canalDe = (m) => CANAL[m.tipo_mensagem] || 'outros';
const mediana = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
const sa = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const APRESENTA = /(?:[Aa]qui (?:e|é) (?:a|o)|[Ss]ou (?:a|o)|[Mm]eu nome (?:e|é)|[Mm]e chamo)\s+([A-ZÀ-Ú][a-zà-ú]+)/;
const SEM_ID = 'sem-identificacao';
const nomeDono = (id) => (id === SEM_ID || id === 'sem-responsavel' ? null : nameOf(id));

let contatosCache = { t: 0, v: new Map() };
async function contatos() {
  if (Date.now() - contatosCache.t < 300e3) return contatosCache.v;
  const m = new Map();
  try { for (const c of await sb('ghl_contatos', { select: 'id,nome,telefone,email,responsavel_id' })) m.set(c.id, c); } catch { /* tabela ainda não existe */ }
  for (const o of await carregarOportunidades()) {
    if (!o.contact_id) continue;
    const c = m.get(o.contact_id) || {};
    m.set(o.contact_id, { ...c, nome: c.nome || o.contato_nome, telefone: c.telefone || o.contato_telefone, email: c.email || o.contato_email, responsavel_id: c.responsavel_id || o.responsavel_id });
  }
  contatosCache = { t: Date.now(), v: m };
  return m;
}

let cache = { chave: '', t: 0, v: null };
export async function visaoDia(dia) {
  if (cache.v && cache.chave === dia && Date.now() - cache.t < 120e3) return cache.v;
  const v = await calcular(dia);
  cache = { chave: dia, t: Date.now(), v };
  return v;
}

async function calcular(dia) {
  if (usaMock()) return { dia, disponivel: false, motivo: 'Sem acesso ao banco de mensagens (modo de exemplo).' };
  try { for (const u of await sb('ghl_usuarios', { select: 'id,nome' })) if (u.nome) NOMES_GHL[u.id] = u.nome; } catch { /* tabela ainda não existe */ }
  const idPorNome = {};
  for (const [id, nome] of Object.entries(NOMES_GHL)) if (id !== 'sem-responsavel') idPorNome[sa(String(nome).split(' ')[0])] = id;

  // Janela: 7 dias antes (comparação e série) e até 2 dias depois (uma resposta pode vir no dia seguinte).
  const de = addDias(dia, -7), ate = addDias(dia, 2);
  const msgs = await sb('wa_mensagens', {
    select: 'conversation_id,contact_id,tipo_mensagem,direcao,origem,user_id,corpo,enviada_em',
    enviada_em: [`gte.${de}T03:00:00Z`, `lte.${ate}T02:59:59Z`], order: 'enviada_em.asc',
  });
  const fimDados = msgs.length ? Math.max(...msgs.map((m) => Date.parse(m.enviada_em))) : Date.now();
  // Com snapshot, "agora" é o fim dos dados, senão toda espera ganharia as horas desde a cópia.
  const agora = usaSnapshot() ? fimDados : Date.now();
  const nomes = await contatos();

  const porConv = new Map();
  for (const m of msgs) { if (!m.conversation_id || canalDe(m) === 'outros') continue; (porConv.get(m.conversation_id) || porConv.set(m.conversation_id, []).get(m.conversation_id)).push(m); }
  const convs = [...porConv].map(([id, ms]) => ({ id, canal: canalDe(ms[0]), contact_id: ms.find((m) => m.contact_id)?.contact_id || null, ms }));

  // Quem atende a conversa quando a mensagem não traz o usuário (celular): quem se apresenta, senão o responsável no CRM.
  const donoDe = (c) => {
    for (const m of c.ms) if (m.direcao === 'outbound' && m.origem !== 'workflow' && m.user_id) return m.user_id;
    for (const m of c.ms) if (m.direcao === 'outbound' && m.origem !== 'workflow') { const x = APRESENTA.exec(String(m.corpo || '')); if (x && idPorNome[sa(x[1])]) return idPorNome[sa(x[1])]; }
    return nomes.get(c.contact_id)?.responsavel_id || SEM_ID;
  };

  // Resumo de um dia para um conjunto de conversas: só o que tem mensagem do cliente naquele dia conta como "cliente escreveu".
  function resumir(lista, d, detalhado = false) {
    const noDia = (m) => diaDe(m.enviada_em) === d;
    let recebidas = 0, enviadas = 0, automacao = 0;
    const clientes = [], tempos = [], porHora = Array.from({ length: 24 }, () => ({ recebidas: 0, respostas: 0 }));
    const porAtendente = new Map();
    const aguardando = [], lentas = [];
    let novas = 0;
    for (const c of lista) {
      const doDia = c.ms.filter(noDia);
      if (!doDia.length) continue;
      for (const m of doDia) {
        const h = +brt(m.enviada_em).slice(11, 13);
        if (m.direcao === 'inbound') { recebidas++; porHora[h].recebidas++; }
        else if (m.origem === 'workflow') automacao++;
        else { enviadas++; porHora[h].respostas++; }
      }
      const entrada = doDia.find((m) => m.direcao === 'inbound');
      if (!entrada) continue;
      if (c.ms[0] === doDia[0] && c.ms[0].direcao === 'inbound') novas++;
      const t0 = Date.parse(entrada.enviada_em);
      const depois = c.ms.filter((m) => m.direcao === 'outbound' && Date.parse(m.enviada_em) > t0);
      const pessoa = depois.find((m) => m.origem !== 'workflow');
      const bot = depois.find((m) => m.origem === 'workflow');
      const ultima = c.ms[c.ms.length - 1];
      const esperando = ultima.direcao === 'inbound';
      const dono = pessoa?.user_id || donoDe(c);
      const item = { id: c.id, canal: c.canal, respondida: !!(pessoa || bot), por_pessoa: !!pessoa, so_automacao: !pessoa && !!bot, esperando, dono };
      clientes.push(item);
      if (pessoa) {
        const min = (Date.parse(pessoa.enviada_em) - t0) / MIN;
        tempos.push(min);
        const a = porAtendente.get(dono) || { id: dono, conversas: 0, mensagens: 0, tempos: [] };
        a.conversas++; a.tempos.push(min); porAtendente.set(dono, a);
        if (detalhado && min > 60) lentas.push({ ...identidade(c), minutos: Math.round(min), dono: nomeDono(dono) });
      }
      if (detalhado && esperando) {
        aguardando.push({ ...identidade(c), desde: ultima.enviada_em, espera_min: Math.round((agora - Date.parse(ultima.enviada_em)) / MIN), ultima_msg: String(ultima.corpo || '').replace(/\s+/g, ' ').trim().slice(0, 160) || '(mídia)', dono: nomeDono(dono), mensagens_cliente: doDia.filter((m) => m.direcao === 'inbound').length });
      }
    }
    for (const c of lista) for (const m of c.ms.filter(noDia)) if (m.direcao === 'outbound' && m.origem !== 'workflow') {
      const dono = m.user_id || donoDe(c);
      const a = porAtendente.get(dono) || { id: dono, conversas: 0, mensagens: 0, tempos: [] };
      a.mensagens++; porAtendente.set(dono, a);
    }
    const n = clientes.length;
    const out = {
      recebidas, clientes: n, novas, enviadas, automacao,
      respondidas: clientes.filter((x) => x.respondida).length,
      por_pessoa: clientes.filter((x) => x.por_pessoa).length,
      so_automacao: clientes.filter((x) => x.so_automacao).length,
      sem_resposta: clientes.filter((x) => !x.respondida).length,
      aguardando: clientes.filter((x) => x.esperando).length,
      respondidas_pct: pct(clientes.filter((x) => x.respondida).length, n),
      pessoa_pct: pct(clientes.filter((x) => x.por_pessoa).length, n),
      primeira_resposta_min: tempos.length ? Math.round(mediana(tempos)) : null,
      ate_1h_pct: tempos.length ? pct(tempos.filter((t) => t <= 60).length, tempos.length) : null,
    };
    if (detalhado) {
      out.por_hora = porHora.map((x, h) => ({ hora: `${String(h).padStart(2, '0')}h`, ...x }));
      out.atendentes = [...porAtendente.values()].map((a) => ({ id: a.id, nome: a.id === SEM_ID ? 'Sem identificação (celular)' : nameOf(a.id), conversas: a.conversas, mensagens: a.mensagens, primeira_resposta_min: a.tempos.length ? Math.round(mediana(a.tempos)) : null })).sort((a, b) => b.conversas - a.conversas || b.mensagens - a.mensagens);
      out.lista_aguardando = aguardando.sort((a, b) => b.espera_min - a.espera_min).slice(0, 60);
      out.lista_lentas = lentas.sort((a, b) => b.minutos - a.minutos).slice(0, 15);
    }
    return out;
  }
  const identidade = (c) => {
    const k = nomes.get(c.contact_id);
    const r = rotular(k?.nome);
    return { id: c.id, canal: c.canal, contato: r.nome || (r.perfil ? `@${r.perfil}` : c.contact_id ? `Contato …${String(c.contact_id).slice(-4)}` : '—'), telefone: k?.telefone || null, email: k?.email || null };
  };

  // Resolução e interesse de compra vêm da IA, quando ela já analisou a conversa.
  const ids = new Set(convs.filter((c) => c.ms.some((m) => m.direcao === 'inbound' && diaDe(m.enviada_em) === dia)).map((c) => c.id));
  let analises = [];
  try {
    // Uma conversa pode ter começado dias antes; pega as análises da última semana e casa pelo id da conversa.
    analises = (await sb('wa_analises', { select: 'conversation_id,resolvido,oportunidade_venda,alerta,categoria,inicio', inicio: `gte.${addDias(dia, -7)}T03:00:00Z`, order: 'inicio.desc' })).filter((a) => ids.has(a.conversation_id));
  } catch { /* sem análises */ }
  const ultimaPorConv = new Map();
  for (const a of analises) if (!ultimaPorConv.has(a.conversation_id)) ultimaPorConv.set(a.conversation_id, a);
  const ia = (canal) => {
    const l = [...ultimaPorConv.values()].filter((a) => canal === 'geral' || porConv.get(a.conversation_id)?.[0] && canalDe(porConv.get(a.conversation_id)[0]) === canal);
    const cat = {};
    for (const a of l) if (a.categoria) cat[a.categoria] = (cat[a.categoria] || 0) + 1;
    return { analisadas: l.length, resolvidas: l.filter((a) => a.resolvido).length, resolvidas_pct: pct(l.filter((a) => a.resolvido).length, l.length), interesse_compra: l.filter((a) => a.oportunidade_venda && !a.resolvido).length, alertas: l.filter((a) => a.alerta && !['nenhum', 'cliente_sem_resposta'].includes(a.alerta)).length, categorias: Object.entries(cat).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, n]) => ({ categoria: k, n })) };
  };

  const canais = {};
  for (const canal of ['whatsapp', 'instagram', 'geral']) {
    const lista = canal === 'geral' ? convs : convs.filter((c) => c.canal === canal);
    const hoje = resumir(lista, dia, true);
    const serie = [];
    for (let i = 7; i >= 0; i--) { const d = addDias(dia, -i); const r = resumir(lista, d); serie.push({ dia: d, recebidas: r.recebidas, clientes: r.clientes, por_pessoa: r.por_pessoa, sem_resposta: r.sem_resposta, respondidas_pct: r.respondidas_pct, primeira_resposta_min: r.primeira_resposta_min }); }
    const anteriores = serie.slice(0, 7);
    const media = (k) => { const v = anteriores.map((x) => x[k]).filter((x) => x != null); return v.length ? r1(v.reduce((s, x) => s + x, 0) / v.length) : null; };
    canais[canal] = { ...hoje, ia: ia(canal), serie, ontem: anteriores[6], media_7: { recebidas: media('recebidas'), clientes: media('clientes'), por_pessoa: media('por_pessoa'), respondidas_pct: media('respondidas_pct'), primeira_resposta_min: media('primeira_resposta_min') } };
  }
  const g = canais.geral;
  g.lista_aguardando = [...canais.whatsapp.lista_aguardando, ...canais.instagram.lista_aguardando].sort((a, b) => b.espera_min - a.espera_min).slice(0, 60);

  const insights = leitura(canais, dia);
  for (const k of Object.keys(canais)) canais[k].insights = insights[k];
  return { dia, hoje: hojeBrt(), disponivel: true, parcial: dia === hojeBrt(), dados_ate: new Date(fimDados).toISOString(), canais };
}

function leitura(c, dia) {
  const w = c.whatsapp, g = c.instagram;
  const fim = (dia === hojeBrt()) ? ' até agora' : '';
  const t = (min) => (min >= 60 ? `${r1(min / 60)} h` : `${min} min`);
  const canal = (x, nome, verbo) => {
    const out = [];
    if (!x.clientes) return [{ tom: 'info', texto: `Nenhum cliente ${verbo} no ${nome}${fim}.` }];
    out.push({ tom: 'info', texto: `${x.clientes} clientes ${verbo} no ${nome}${fim} (${x.recebidas} mensagens, ${x.novas} conversas novas)${x.media_7.clientes != null ? `; a média dos 7 dias anteriores é ${x.media_7.clientes} por dia` : ''}.` });
    if (x.por_pessoa === 0) out.push({ tom: 'atencao', texto: `Ninguém da equipe respondeu a nenhum dos ${x.clientes} clientes. ${x.so_automacao} receberam só automação e ${x.sem_resposta} não receberam nada.` });
    else if (x.pessoa_pct < 50) out.push({ tom: 'atencao', texto: `Só ${x.pessoa_pct}% dos clientes foram respondidos por uma pessoa (${x.por_pessoa} de ${x.clientes}). ${x.so_automacao} receberam só automação e ${x.sem_resposta} não receberam nada.` });
    else out.push({ tom: 'info', texto: `${x.pessoa_pct}% dos clientes foram respondidos por uma pessoa (${x.por_pessoa} de ${x.clientes}); ${x.so_automacao} receberam só automação.` });
    if (x.primeira_resposta_min != null) out.push({ tom: x.primeira_resposta_min > 30 ? 'atencao' : 'info', texto: `A primeira resposta de uma pessoa levou ${t(x.primeira_resposta_min)} na mediana (${x.ate_1h_pct}% em até 1 h)${x.media_7.primeira_resposta_min != null ? `; nos 7 dias anteriores, ${t(x.media_7.primeira_resposta_min)}` : ''}.` });
    if (x.aguardando) out.push({ tom: 'atencao', texto: `${x.aguardando} clientes estão esperando resposta agora. A lista está abaixo, do mais antigo para o mais recente.` });
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
    if (ag) geral.push({ tom: 'atencao', texto: `${ag} clientes estão esperando resposta agora (${w.aguardando} no WhatsApp, ${g.aguardando} no Instagram).` });
    geral.push(...ia(w).map((i) => ({ ...i, texto: 'WhatsApp: ' + i.texto })));
  }
  return { geral, whatsapp: [...canal(w, 'WhatsApp', 'escreveram'), ...ia(w)], instagram: canal(g, 'Instagram', 'responderam ou escreveram') };
}
