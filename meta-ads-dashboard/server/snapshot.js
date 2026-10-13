// Modo de teste com dados reais: com SNAPSHOT_DIR, as consultas ao Supabase leem arquivos JSON locais (<tabela>.json).
// Só interpreta os filtros que o dashboard usa: eq, gte, lte, not.is.null e order. Em produção isto não é usado.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.env.SNAPSHOT_DIR;
export const usaSnapshot = () => !!dir;
const cache = new Map();

const comoValor = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) ? Date.parse(v) : v);

export function consultarSnapshot(tabela, params = {}) {
  const arq = join(dir, `${tabela}.json`);
  if (!existsSync(arq)) throw new Error(`sem snapshot de ${tabela}`);
  if (!cache.has(arq)) cache.set(arq, JSON.parse(readFileSync(arq, 'utf8')));
  let rows = cache.get(arq);
  for (const [col, bruto] of Object.entries(params)) {
    if (['select', 'order', 'limit', 'offset'].includes(col)) continue;
    for (const f of [].concat(bruto)) {
      const [op, ...resto] = String(f).split('.');
      const alvo = resto.join('.');
      if (op === 'eq') rows = rows.filter((r) => String(r[col]) === alvo);
      else if (op === 'gte') rows = rows.filter((r) => r[col] != null && comoValor(r[col]) >= comoValor(alvo));
      else if (op === 'lte') rows = rows.filter((r) => r[col] != null && comoValor(r[col]) <= comoValor(alvo));
      else if (op === 'not' && alvo === 'is.null') rows = rows.filter((r) => r[col] != null);
    }
  }
  if (params.order) {
    const [col, dir_] = String(params.order).split('.');
    rows = [...rows].sort((a, b) => (comoValor(a[col]) > comoValor(b[col]) ? 1 : -1) * (dir_ === 'desc' ? -1 : 1));
  }
  return rows;
}
