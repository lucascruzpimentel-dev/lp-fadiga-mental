// Contatos do HighLevel (nome, telefone, e-mail, responsável) e as oportunidades de cada um, num lugar só e com cache.
// Usado pela visão do dia e pelo Instagram, para não buscar a mesma coisa duas vezes.
import { sb, NOMES_GHL } from './whatsapp.js';
import { carregarOportunidades } from './vendas.js';

// O HighLevel nomeia quem chega por DM como o @ do Instagram, ou com o nome de exibição do perfil. Separa um do outro.
const pareceUsuario = (t) => /^[a-z0-9._]{3,}$/.test(t) || (/^\S+$/.test(t) && /[._\d]/.test(t));
export function rotular(bruto) {
  const t = String(bruto || '').trim().replace(/^@/, '');
  if (!t) return { nome: null, perfil: null };
  return pareceUsuario(t) ? { nome: null, perfil: t } : { nome: t, perfil: null };
}
export const tituloDe = (r, contactId) => r.nome || (r.perfil ? `@${r.perfil}` : contactId ? `Contato …${String(contactId).slice(-4)}` : '—');

let cache = { t: 0, p: null };
// { contatos: Map(id -> {nome, telefone, email, responsavel_id}), opps: [...], porContato: Map(id -> [opps]) }
export function carregarContatos() {
  if (cache.p && Date.now() - cache.t < 300e3) return cache.p;
  const p = (async () => {
    const [usuarios, contatosRows, opps] = await Promise.all([
      sb('ghl_usuarios', { select: 'id,nome' }).catch(() => []),
      sb('ghl_contatos', { select: 'id,nome,telefone,email,responsavel_id' }).catch(() => []),
      carregarOportunidades(),
    ]);
    for (const u of usuarios) if (u.nome) NOMES_GHL[u.id] = u.nome;
    const contatos = new Map(contatosRows.map((c) => [c.id, c]));
    const porContato = new Map();
    for (const o of opps) {
      if (!o.contact_id) continue;
      (porContato.get(o.contact_id) || porContato.set(o.contact_id, []).get(o.contact_id)).push(o);
      const c = contatos.get(o.contact_id) || { id: o.contact_id };
      contatos.set(o.contact_id, { ...c, nome: c.nome || o.contato_nome, telefone: c.telefone || o.contato_telefone, email: c.email || o.contato_email, responsavel_id: c.responsavel_id || o.responsavel_id });
    }
    return { contatos, opps, porContato };
  })();
  p.catch(() => { if (cache.p === p) cache = { t: 0, p: null }; });
  cache = { t: Date.now(), p };
  return p;
}
