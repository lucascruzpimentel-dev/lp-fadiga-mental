// Leitura das mensagens (wa_mensagens) feita para ser rápida e dividida entre as telas.
// - "estrutura": só quem falou e quando (sem o texto, que é o que pesa). Basta para contar e medir tempos.
// - "textos do cliente": só as mensagens recebidas, com o texto (para detectar assunto e mostrar a última fala).
// Cada dia é guardado em cache separado: dias passados não mudam, então a segunda tela que pede o mesmo período
// não vai ao banco de novo, e abrir "ontem" depois de "hoje" só busca o que falta.
import { sb } from './whatsapp.js';
import { diaDe, addDias, hojeBrt } from './atendimentos.js';

const MIN = 60e3;
const CAMPOS_ESTRUTURA = 'conversation_id,contact_id,direcao,origem,user_id,enviada_em';
const CAMPOS_TEXTO = 'conversation_id,contact_id,corpo,enviada_em';
const caches = new Map(); // `${tipo}|${tipoDeLeitura}` -> Map(dia -> { t, p })

// Dias passados valem por mais tempo; hoje atualiza quase em tempo real.
function validade(dia) {
  const h = hojeBrt();
  if (dia < addDias(h, -1)) return 30 * MIN;
  if (dia === addDias(h, -1)) return 5 * MIN;
  return 45e3;
}

async function buscarFaixa(tipo, leitura, a, b) {
  const filtro = { tipo_mensagem: `eq.${tipo}`, enviada_em: [`gte.${a}T03:00:00Z`, `lte.${addDias(b, 1)}T02:59:59.999Z`], order: 'enviada_em.asc' };
  if (leitura === 'texto') return sb('wa_mensagens', { select: CAMPOS_TEXTO, direcao: 'eq.inbound', ...filtro });
  return sb('wa_mensagens', { select: CAMPOS_ESTRUTURA, ...filtro });
}

async function dias(tipo, leitura, de, ate) {
  const chave = `${tipo}|${leitura}`;
  const mapa = caches.get(chave) || caches.set(chave, new Map()).get(chave);
  const lista = [];
  for (let d = de; d <= ate; d = addDias(d, 1)) lista.push(d);
  // Dias que faltam (ou venceram), agrupados em faixas contínuas: uma consulta por faixa.
  const faltam = lista.filter((d) => { const e = mapa.get(d); return !e || Date.now() - e.t > validade(d); });
  for (let i = 0; i < faltam.length;) {
    let j = i;
    while (j + 1 < faltam.length && faltam[j + 1] === addDias(faltam[j], 1)) j++;
    const a = faltam[i], b = faltam[j];
    const faixa = buscarFaixa(tipo, leitura, a, b);
    for (let k = i; k <= j; k++) {
      const d = faltam[k];
      const p = faixa.then((rows) => rows.filter((m) => diaDe(m.enviada_em) === d));
      p.catch(() => { if (mapa.get(d)?.p === p) mapa.delete(d); });
      mapa.set(d, { t: Date.now(), p });
    }
    i = j + 1;
  }
  for (const d of [...mapa.keys()]) if (d < addDias(hojeBrt(), -120)) mapa.delete(d);
  return (await Promise.all(lista.map((d) => mapa.get(d).p))).flat();
}

export const estrutura = (tipo, de, ate) => dias(tipo, 'estrutura', de, ate);
export const textosDoCliente = (tipo, de, ate) => dias(tipo, 'texto', de, ate);

// Texto da última mensagem de algumas conversas (para listas curtas). Uma ou duas consultas, no máximo.
export async function ultimasMensagens(ids, desde) {
  const out = new Map();
  const unicos = [...new Set(ids)].filter((x) => /^[\w-]{3,80}$/.test(x));
  const blocos = [];
  for (let i = 0; i < unicos.length; i += 60) blocos.push(unicos.slice(i, i + 60));
  const paginas = await Promise.all(blocos.map((b) => sb('wa_mensagens', {
    select: 'conversation_id,direcao,corpo,enviada_em', conversation_id: `in.(${b.join(',')})`, enviada_em: `gte.${desde}T03:00:00Z`, order: 'enviada_em.asc',
  })));
  for (const m of paginas.flat()) out.set(m.conversation_id, m); // a última lida (ordem crescente) é a mais recente
  return out;
}

export const limparTexto = (t, n = 160) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, n) || '(mídia)';
