// Aba WhatsApp: lê SOMENTE o projeto Supabase de WhatsApp (WA_*).
const env = process.env;
const URL_ = env.WA_SUPABASE_URL;
const KEY = env.WA_SUPABASE_SERVICE_ROLE_KEY;
const PAGE = 1000;

async function sb(table, params = {}) {
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) [].concat(v).forEach((x) => q.append(k, x));
    const r = await fetch(`${URL_}/rest/v1/${table}?${q}`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Range: `${from}-${from + PAGE - 1}` },
    });
    if (!r.ok) throw new Error(`${table}: HTTP ${r.status}`);
    const page = await r.json();
    out.push(...page);
    if (page.length < PAGE) break;
  }
  return out;
}

// Nomes dos vendedores: WA_ATENDENTES='{"idDoUsuarioGHL":"Nome", ...}'
let NAMES = {};
try { NAMES = JSON.parse(env.WA_ATENDENTES || '{}'); } catch { /* ignora JSON inválido */ }
const nameOf = (id) => NAMES[id] || `Vendedor ${id.slice(0, 4)}…`;

// Temas recorrentes nos "pontos de melhoria" gerados pela análise de cada conversa.
const THEMES = [
  { key: 'tempo', re: /primeira resposta|demor|tempo de resposta|responder mais r|rapidez|lent/i, label: 'Tempo de resposta',
    tip: 'Responda o primeiro contato em poucos minutos: quem espera esfria. Use respostas rápidas e alertas de conversa nova.' },
  { key: 'followup', re: /retom|follow|acompanh|insist|reengaj|sem resposta/i, label: 'Follow-up / retomada',
    tip: 'Crie uma cadência de retomada (ex.: 1 dia, 3 dias, 7 dias) para quem parou de responder, sempre com um motivo novo para voltar.' },
  { key: 'link', re: /link|passo a passo|instru|explicar como|enviar.*(informa|material)/i, label: 'Faltou link ou instrução clara',
    tip: 'Envie o link e o próximo passo na mesma mensagem, em linguagem simples, para o cliente não precisar perguntar de novo.' },
  { key: 'qualif', re: /pergunt|qualific|entender|necessidade|descobr|contexto|perfil/i, label: 'Qualificação do cliente',
    tip: 'Faça 1 ou 2 perguntas antes de oferecer (objetivo, momento, perfil do atleta) para personalizar a proposta.' },
  { key: 'cta', re: /convite|cta|fechar|conclus|oferec|incentiv|urg|valor|pre[cç]o|investimento|inscri|convers/i, label: 'Condução para a decisão',
    tip: 'Termine cada mensagem com um convite claro (inscrever, reservar, agendar) e quebre objeções de valor com benefícios concretos.' },
  { key: 'tom', re: /personaliz|empat|acolh|tom |cumpriment|nome do/i, label: 'Personalização e acolhimento',
    tip: 'Chame pelo nome, reconheça a situação do cliente e evite respostas padronizadas.' },
  { key: 'clareza', re: /clare|objetiv|resum|detalh|confus|incomplet|informa/i, label: 'Clareza das informações',
    tip: 'Seja objetivo: respostas curtas, uma ideia por mensagem e informações completas (data, local, valor) logo de início.' },
];
const themeOf = (text) => THEMES.find((t) => t.re.test(text))?.key || 'outros';

const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const r1 = (n) => (n == null ? null : +n.toFixed(1));
const pct = (n, d) => (d ? +((n / d) * 100).toFixed(1) : 0);

export async function whatsappReport(since, until) {
  if (!URL_ || !KEY) throw new Error('credenciais do Supabase de WhatsApp ausentes (WA_SUPABASE_URL / WA_SUPABASE_SERVICE_ROLE_KEY)');
  const warnings = [];
  const inicio = [`gte.${since}T00:00:00`, `lte.${until}T23:59:59`];

  const [custos, precos, painel, analises] = await Promise.all([
    sb('wa_custos_diarios', { select: '*', dia: [`gte.${since}`, `lte.${until}`], order: 'dia.asc' }),
    sb('wa_precos', { select: '*' }),
    sb('wa_painel_atendimento', { select: '*', dia: [`gte.${since}`, `lte.${until}`], order: 'dia.asc' }),
    sb('wa_analises', {
      select: 'inicio,categoria,sentimento,resolvido,nota,atendentes,oportunidade_venda,alerta,primeira_resposta_seg,pontos_melhoria,qtd_enviadas_humano',
      inicio, order: 'inicio.asc',
    }),
  ]);

  // ---- Custos de templates ------------------------------------------------
  // Mensagens enviadas fora da janela de 24h são templates (cobrados). A categoria
  // (marketing/utility) não é registrada, então mostramos faixa: mínimo (tudo utility) a máximo (tudo marketing).
  const price = {};
  for (const p of precos) price[p.categoria] = p.preco ?? (env[`WA_PRICE_${p.categoria.toUpperCase()}`] ? Number(env[`WA_PRICE_${p.categoria.toUpperCase()}`]) : null);
  const usdBrl = env.WA_USD_BRL ? Number(env.WA_USD_BRL) : null;
  const byDay = new Map();
  for (const c of custos) {
    const d = byDay.get(c.dia) || { dia: c.dia, enviadas: 0, janela: 0, templates: 0 };
    d.enviadas += c.mensagens_enviadas; d.janela += c.dentro_janela_24h; d.templates += c.templates_fora_janela;
    byDay.set(c.dia, d);
  }
  const hasPrice = price.utility != null && price.marketing != null;
  const diario = [...byDay.values()].map((d) => ({
    ...d,
    custo_min: hasPrice ? +(d.templates * price.utility).toFixed(2) : null,
    custo_max: hasPrice ? +(d.templates * price.marketing).toFixed(2) : null,
  }));
  const tot = diario.reduce((t, d) => ({ enviadas: t.enviadas + d.enviadas, janela: t.janela + d.janela, templates: t.templates + d.templates }), { enviadas: 0, janela: 0, templates: 0 });
  if (!hasPrice) warnings.push('Preços dos templates não cadastrados: preencha a tabela wa_precos (utility e marketing) para ver o custo em dinheiro. Por enquanto mostramos só as quantidades.');
  const custos_out = {
    moeda: 'USD', usd_brl: usdBrl, precos: price, has_price: hasPrice, diario,
    totais: {
      ...tot,
      custo_min: hasPrice ? +(tot.templates * price.utility).toFixed(2) : null,
      custo_max: hasPrice ? +(tot.templates * price.marketing).toFixed(2) : null,
      pct_templates: pct(tot.templates, tot.enviadas),
    },
  };

  // ---- Visão geral do atendimento ----------------------------------------
  const w = (field, weight = 'atendimentos') => {
    const rows = painel.filter((p) => p[field] != null);
    const den = rows.reduce((s, p) => s + p[weight], 0);
    return den ? rows.reduce((s, p) => s + p[field] * p[weight], 0) / den : null;
  };
  const resolvidos = analises.filter((a) => a.resolvido).length;
  const abertos = analises.length - resolvidos;
  const semResposta = analises.filter((a) => a.alerta === 'cliente_sem_resposta').length;
  const oportAbertas = analises.filter((a) => a.oportunidade_venda && !a.resolvido).length;
  const count = (arr, f) => arr.reduce((m, a) => ((m[a[f]] = (m[a[f]] || 0) + 1), m), {});
  const visao = {
    atendimentos: analises.length,
    resolvidos, em_atendimento: abertos, sem_resposta_cliente: semResposta,
    oportunidades_abertas: oportAbertas,
    pct_resolvidos: pct(resolvidos, analises.length),
    nota_media: r1(avg(analises.filter((a) => a.nota != null).map((a) => a.nota))),
    primeira_resposta_min: r1(w('primeira_resposta_media_min')),
    negativos: analises.filter((a) => a.sentimento === 'negativo').length,
    categorias: Object.entries(count(analises, 'categoria')).map(([nome, n]) => ({ nome, n })).sort((a, b) => b.n - a.n),
    sentimentos: count(analises, 'sentimento'),
    diario: painel.map((p) => ({ dia: p.dia, atendimentos: p.atendimentos, nota: p.nota_media, resolvidos: p.pct_resolvidos, primeira_resposta_min: p.primeira_resposta_media_min })),
  };

  // ---- Avaliação por vendedor + temas de melhoria -------------------------
  const sellers = new Map();
  const themeAll = {};
  for (const a of analises) {
    const ids = a.atendentes?.length ? a.atendentes : ['_auto'];
    const themes = (a.pontos_melhoria || []).map(themeOf);
    themes.forEach((t) => (themeAll[t] = (themeAll[t] || 0) + 1));
    for (const id of ids) {
      const s = sellers.get(id) || { id, n: 0, notas: [], resolvidos: 0, resp: [], oport: 0, erros: 0, sem_resposta: 0, themes: {} };
      s.n++; if (a.nota != null) s.notas.push(a.nota);
      if (a.resolvido) s.resolvidos++;
      if (a.primeira_resposta_seg != null) s.resp.push(a.primeira_resposta_seg / 60);
      if (a.oportunidade_venda && !a.resolvido) s.oport++;
      if (['erro_do_atendente', 'informacao_incorreta'].includes(a.alerta)) s.erros++;
      if (a.alerta === 'cliente_sem_resposta') s.sem_resposta++;
      themes.forEach((t) => (s.themes[t] = (s.themes[t] || 0) + 1));
      sellers.set(id, s);
    }
  }
  const geral = { nota: visao.nota_media, resolvido: visao.pct_resolvidos, resp: avg(analises.filter((a) => a.primeira_resposta_seg != null).map((a) => a.primeira_resposta_seg / 60)) };
  const themeLabel = Object.fromEntries(THEMES.map((t) => [t.key, t]));

  const vendedores = [...sellers.values()].map((s) => {
    const nota = avg(s.notas), resp = avg(s.resp), pr = pct(s.resolvidos, s.n);
    const top = Object.entries(s.themes).filter(([k]) => k !== 'outros').sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([k, n]) => ({ tema: themeLabel[k].label, n }));
    const dicas = [];
    if (s.n >= 10) {
      if (resp != null && geral.resp != null && resp > geral.resp * 1.3 && resp > 10) dicas.push(`Primeira resposta demora ${r1(resp)} min (média da equipe ${r1(geral.resp)} min). ${themeLabel.tempo.tip}`);
      if (pr < geral.resolvido - 8) dicas.push(`Só ${pr}% das conversas são resolvidas (equipe: ${geral.resolvido}%). Revise o fechamento: termine sempre com próximo passo claro.`);
      if (nota != null && geral.nota != null && nota < geral.nota - 0.7) dicas.push(`Nota média ${r1(nota)} abaixo da equipe (${geral.nota}). Reveja conversas de nota baixa e padronize as boas respostas.`);
      if (s.oport >= 5) dicas.push(`${s.oport} oportunidades de venda ainda abertas. Priorize essas conversas hoje.`);
      if (s.erros) dicas.push(`${s.erros} conversa(s) com erro do atendente ou informação incorreta. Confirme valores, datas e links antes de enviar.`);
      const t0 = Object.entries(s.themes).filter(([k]) => k !== 'outros').sort((a, b) => b[1] - a[1])[0];
      if (t0 && t0[1] >= 5) dicas.push(`Ponto mais recorrente: ${themeLabel[t0[0]].label} (${t0[1]}×). ${themeLabel[t0[0]].tip}`);
    }
    return {
      id: s.id, nome: s.id === '_auto' ? 'Sem atendente humano registrado' : nameOf(s.id), conversas: s.n,
      nota: r1(nota), pct_resolvidos: pr, primeira_resposta_min: r1(resp),
      oportunidades_abertas: s.oport, erros: s.erros, sem_resposta: s.sem_resposta, melhorias: top, dicas,
    };
  }).sort((a, b) => b.conversas - a.conversas);

  const temas = Object.entries(themeAll).filter(([k]) => k !== 'outros').sort((a, b) => b[1] - a[1])
    .map(([k, n]) => ({ tema: themeLabel[k].label, n, dica: themeLabel[k].tip }));

  const sugestoes = [];
  if (semResposta > analises.length * 0.2) sugestoes.push({ tone: 'warn', text: `${semResposta} conversas (${pct(semResposta, analises.length)}%) terminaram sem resposta do cliente. Teste uma mensagem de retomada com novo motivo (prazo, bônus, dúvida frequente) 24h e 72h depois.` });
  if (oportAbertas) sugestoes.push({ tone: 'good', text: `${oportAbertas} conversas com oportunidade de venda ainda não resolvidas. É o melhor lugar para a equipe agir primeiro.` });
  if (temas[0]) sugestoes.push({ tone: 'info', text: `Tema que mais aparece nas avaliações: ${temas[0].tema} (${temas[0].n}×). ${temas[0].dica}` });
  if (visao.primeira_resposta_min > 10) sugestoes.push({ tone: 'bad', text: `Primeira resposta média de ${visao.primeira_resposta_min} min. Meta sugerida: abaixo de 5 min em horário comercial.` });
  if (hasPrice && tot.enviadas && pct(tot.templates, tot.enviadas) > 50) sugestoes.push({ tone: 'warn', text: `${pct(tot.templates, tot.enviadas)}% das mensagens saem fora da janela de 24h (templates pagos). Responder mais cedo mantém a conversa na janela gratuita.` });

  return { since, until, warnings, custos: custos_out, visao, vendedores, temas, sugestoes };
}
