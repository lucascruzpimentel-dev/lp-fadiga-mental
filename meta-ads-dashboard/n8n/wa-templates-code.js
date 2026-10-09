// Node "Code" do n8n: transforma message_templates em linhas para wa_templates.
const itens = $input.all().flatMap((i) => i.json.data ?? []);
const agora = new Date().toISOString();
return [{ json: { linhas: itens.map((t) => ({
    id: String(t.id),
    nome: t.name,
    idioma: t.language ?? null,
    categoria: t.category ?? null,
    status: t.status ?? null,
    corpo: (t.components ?? []).find((c) => c.type === 'BODY')?.text ?? null,
    qualidade: t.quality_score?.score ?? null,
    atualizado_em: agora,
  })) } }];
