// Node "Code" do n8n: transforma a resposta de pricing_analytics em linhas para wa_custos_meta.
// Agrupa por dia (fuso de Brasília: o dia da Meta começa às 03:00 UTC), categoria e tipo de preço.
const resp = $input.first().json;
const pontos = (resp.pricing_analytics?.data ?? []).flatMap((d) => d.data_points ?? []);
const mapa = new Map();
for (const p of pontos) {
  const dia = new Date(p.start * 1000).toISOString().slice(0, 10);
  const categoria = p.pricing_category ?? 'DESCONHECIDA';
  const tipo = p.pricing_type ?? 'REGULAR';
  const k = `${dia}|${categoria}|${tipo}`;
  mapa.set(k, { dia, categoria, tipo, volume: (mapa.get(k)?.volume ?? 0) + (p.volume ?? 0) });
}
const agora = new Date().toISOString();
// Um único item com todas as linhas: o HTTP Request grava tudo em uma chamada.
return [{ json: { linhas: [...mapa.values()].map((r) => ({ ...r, atualizado_em: agora })) } }];
