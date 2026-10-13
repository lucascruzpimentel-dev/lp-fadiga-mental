// Escolha de período (Hoje, Ontem, últimos N dias ou datas livres), compartilhada entre as telas do Instagram.
// A escolha fica guardada: abrir outra tela do Instagram usa o mesmo período.
import { useState } from 'react';

export const iso = (d) => d.toISOString().slice(0, 10);
export const hojeBrt = () => iso(new Date(Date.now() - 3 * 3600e3));
export const addDias = (d, n) => iso(new Date(new Date(d + 'T12:00:00Z').getTime() + n * 864e5));
export const br = (d) => d.slice(8, 10) + '/' + d.slice(5, 7);
const SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
export const nomeDia = (d) => `${SEMANA[new Date(d + 'T12:00:00Z').getUTCDay()]}, ${br(d)}`;

export const ROTULOS = { hoje: 'Hoje', ontem: 'Ontem', 7: '7 dias', 14: '14 dias', 30: '30 dias', 60: '60 dias', 90: '90 dias', custom: 'Escolher datas' };

// Período -> parâmetros da consulta ao servidor.
export const consulta = (p) => {
  if (p.tipo === 'hoje') return 'dias=1';
  if (p.tipo === 'ontem') { const o = addDias(hojeBrt(), -1); return `de=${o}&ate=${o}`; }
  if (p.tipo === 'custom') return `de=${p.de}&ate=${p.ate}`;
  return `dias=${p.tipo}`;
};

const CHAVE = 'ig_periodo';
export const periodoInicial = (permitidos) => {
  try { const x = JSON.parse(localStorage.getItem(CHAVE)); if (x?.tipo && permitidos.includes(String(x.tipo))) return x; } catch { /* sem storage */ }
  return { tipo: permitidos.includes('30') ? '30' : permitidos.includes('7') ? '7' : permitidos[0] };
};
export const guardarPeriodo = (p) => { try { localStorage.setItem(CHAVE, JSON.stringify(p)); } catch { /* sem storage */ } };

// Estado do período já ligado ao armazenamento local.
export function usePeriodo(permitidos) {
  const [periodo, setP] = useState(() => periodoInicial(permitidos));
  const set = (p) => { setP(p); guardarPeriodo(p); };
  return [periodo, set];
}

// Botões do período e, em "Escolher datas", os campos De e até. `escuro` combina com a faixa escura do topo do Instagram.
export function SeletorPeriodo({ periodo, setPeriodo, permitidos, escuro = false, maxDias = 180 }) {
  const hoje = hojeBrt();
  const escolher = (k) => setPeriodo(k === 'custom' ? { tipo: 'custom', de: periodo.de || addDias(hoje, -6), ate: periodo.ate || hoje } : { tipo: k });
  const caixa = escuro ? 'bg-white/10' : 'bg-slate-100';
  const ativo = escuro ? 'bg-white text-slate-900 shadow-sm' : 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200';
  const inativo = escuro ? 'text-slate-200 hover:bg-white/10' : 'text-slate-600 hover:text-slate-900';
  const campo = escuro ? 'border-white/20 bg-white/10 text-white [color-scheme:dark]' : 'border-slate-200 bg-white text-slate-800';
  const rotulo = escuro ? 'text-slate-300' : 'text-slate-500';
  const atalho = escuro ? 'bg-white/10 text-slate-200 hover:bg-white/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200';
  const min = (a) => addDias(a, -maxDias);
  return (
    <div className="no-print space-y-2">
      <div className={`inline-flex flex-wrap gap-1 rounded-xl p-1 ${caixa}`} role="tablist" aria-label="Período">
        {permitidos.map((k) => (
          <button key={k} role="tab" aria-selected={String(periodo.tipo) === String(k)} onClick={() => escolher(k)} className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${String(periodo.tipo) === String(k) ? ativo : inativo}`}>{ROTULOS[k]}</button>
        ))}
      </div>
      {periodo.tipo === 'custom' && (
        <div className={`relative flex w-full flex-wrap items-center gap-2 rounded-xl p-2 text-sm ${caixa}`}>
          <span className={rotulo}>De</span>
          <input type="date" value={periodo.de} min={min(periodo.ate || hoje)} max={periodo.ate || hoje} onChange={(e) => e.target.value && setPeriodo({ ...periodo, de: e.target.value })} className={`rounded-lg border px-2 py-1 ${campo}`} />
          <span className={rotulo}>até</span>
          <input type="date" value={periodo.ate} min={periodo.de} max={hoje} onChange={(e) => e.target.value && setPeriodo({ ...periodo, ate: e.target.value })} className={`rounded-lg border px-2 py-1 ${campo}`} />
          {[['7 dias', 6], ['30 dias', 29]].map(([rot, n]) => <button key={rot} onClick={() => setPeriodo({ tipo: 'custom', de: addDias(periodo.ate || hoje, -n), ate: periodo.ate || hoje })} className={`rounded-lg px-2.5 py-1 ${atalho}`}>últimos {rot}</button>)}
        </div>
      )}
    </div>
  );
}
