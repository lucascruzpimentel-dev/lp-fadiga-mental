// Custo de mensagens a partir do volume que a Meta informa por categoria (tabela wa_custos_meta).
// Mensagens com tipo FREE_* (atendimento dentro da janela, entrada por anúncio) não são cobradas.
const r2 = (n) => +n.toFixed(2);
const gratis = (tipo) => String(tipo || '').toUpperCase().startsWith('FREE');

export function custosMeta(linhas, price) {
  const precoDe = (cat) => ({ UTILITY: price.utility, MARKETING: price.marketing, AUTHENTICATION: price.authentication, SERVICE: price.service })[String(cat).toUpperCase()] ?? 0;

  const porTipo = new Map();
  const porDia = new Map();
  for (const l of linhas) {
    const cobrada = !gratis(l.tipo);
    const preco = cobrada ? precoDe(l.categoria) : 0;
    const k = `${l.categoria}|${l.tipo}`;
    const t = porTipo.get(k) || { categoria: l.categoria, tipo: l.tipo, cobrada, preco, volume: 0, custo: 0 };
    t.volume += l.volume; t.custo += l.volume * preco;
    porTipo.set(k, t);

    const d = porDia.get(l.dia) || { dia: l.dia, utility: 0, marketing: 0, authentication: 0, service_cobrada: 0, gratis: 0, custo: 0 };
    if (!cobrada) d.gratis += l.volume;
    else {
      const c = String(l.categoria).toLowerCase();
      if (c === 'service') d.service_cobrada += l.volume;
      else if (c in d) d[c] += l.volume;
    }
    d.custo += l.volume * preco;
    porDia.set(l.dia, d);
  }

  const detalhe = [...porTipo.values()].map((t) => ({ ...t, custo: r2(t.custo) })).sort((a, b) => b.custo - a.custo || b.volume - a.volume);
  const diario = [...porDia.values()].map((d) => ({ ...d, custo: r2(d.custo) })).sort((a, b) => a.dia.localeCompare(b.dia));
  const volume = detalhe.reduce((s, t) => s + t.volume, 0);
  const cobradas = detalhe.filter((t) => t.cobrada).reduce((s, t) => s + t.volume, 0);
  return {
    detalhe, diario,
    totais: { volume, cobradas, gratis: volume - cobradas, custo: r2(detalhe.reduce((s, t) => s + t.custo, 0)) },
  };
}

export function resumoTemplates(templates) {
  const cont = (campo, lista) => lista.reduce((m, t) => ((m[t[campo] || '—'] = (m[t[campo] || '—'] || 0) + 1), m), {});
  const aprovados = templates.filter((t) => t.status === 'APPROVED');
  return {
    total: templates.length,
    por_status: cont('status', templates),
    aprovados_por_categoria: cont('categoria', aprovados),
    aprovados: aprovados
      .map((t) => ({ nome: t.nome, categoria: t.categoria, idioma: t.idioma }))
      .sort((a, b) => a.categoria.localeCompare(b.categoria) || a.nome.localeCompare(b.nome)),
  };
}
