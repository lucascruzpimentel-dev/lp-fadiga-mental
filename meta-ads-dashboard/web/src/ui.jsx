// Peças visuais compartilhadas: ícones, anel de nota, cartões de indicador, avatar, esqueleto.
import { useEffect, useState } from 'react';
import { getJson } from './api.js';

const PATHS = {
  money: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  cart: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z',
  percent: 'M9 14l6-6M9.5 8.5h.01M14.5 13.5h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  ticket: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z',
  clock: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  check: 'M5 13l4 4L19 7',
  checkCircle: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  chat: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z',
  folder: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
  alert: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  trend: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
  copy: 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z',
  printer: 'M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z',
  phone: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
  sparkles: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z',
  bulb: 'M9 21h6m-3-18a6 6 0 00-3.5 10.9c.6.5 1 1.2 1 2v.1h5v-.1c0-.8.4-1.5 1-2A6 6 0 0012 3z',
  chevron: 'M19 9l-7 7-7-7',
  users: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
  chart: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  mail: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  close: 'M6 18L18 6M6 6l12 12',
  whatsapp: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
};

export function Icon({ name, className = 'h-5 w-5' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

// Cor por faixa de nota: verde, âmbar, vermelho.
export const corNota = (n) => (n == null ? '#94a3b8' : n >= 8 ? '#10b981' : n >= 6 ? '#f59e0b' : '#f43f5e');

// Anel de nota (0 a 10) com o número no centro.
export function Gauge({ value, size = 104, escuro = false }) {
  const r = 42, c = 2 * Math.PI * r;
  const v = value == null ? 0 : Math.max(0, Math.min(10, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="-rotate-90" width={size} height={size}>
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="9" stroke={escuro ? 'rgb(255 255 255 / .14)' : '#e2e8f0'} />
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="9" strokeLinecap="round" stroke={corNota(value)} strokeDasharray={c} strokeDashoffset={c * (1 - v / 10)} className="gauge-arc" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`num text-3xl font-extrabold leading-none ${escuro ? 'text-white' : 'text-slate-900'}`}>{value ?? '—'}</span>
        <span className={`mt-0.5 text-[10px] font-semibold uppercase tracking-wider ${escuro ? 'text-slate-400' : 'text-slate-400'}`}>de 10</span>
      </div>
    </div>
  );
}

const GRADIENTES = ['from-indigo-500 to-violet-500', 'from-emerald-500 to-teal-500', 'from-amber-500 to-orange-500', 'from-sky-500 to-blue-600', 'from-rose-500 to-pink-500', 'from-fuchsia-500 to-purple-600'];
export function Avatar({ nome = '?', className = 'h-12 w-12 text-base' }) {
  const ini = nome.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  const g = GRADIENTES[[...nome].reduce((s, ch) => s + ch.charCodeAt(0), 0) % GRADIENTES.length];
  return <span className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-bold text-white ${g} ${className}`}>{ini}</span>;
}

// Variação contra o período anterior, em pílula colorida.
export function DeltaChip({ atual, anterior, melhor = true, formato = (v) => v, sufixo = 'vs período anterior' }) {
  if (atual == null || anterior == null || anterior === 0) return <span className="invisible text-xs">.</span>;
  const d = atual - anterior;
  if (!d) return <span className="text-xs text-slate-400">igual ao período anterior</span>;
  const bom = (d > 0) === melhor;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${bom ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
      <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path d={d > 0 ? 'M10 4l6 8H4z' : 'M10 16l-6-8h12z'} /></svg>
      {formato(Math.abs(+d.toFixed(1)))} <span className="font-normal opacity-70">{sufixo}</span>
    </span>
  );
}

// Cartão de indicador: ícone, rótulo, valor grande e variação.
export function Stat({ icon, label, value, hint, tom = 'indigo', children, className = '' }) {
  const TONS = { indigo: 'bg-indigo-50 text-indigo-600', emerald: 'bg-emerald-50 text-emerald-600', amber: 'bg-amber-50 text-amber-600', rose: 'bg-rose-50 text-rose-600', sky: 'bg-sky-50 text-sky-600', violet: 'bg-violet-50 text-violet-600' };
  return (
    <div className={`card card-hover p-4 ${className}`}>
      <div className="flex items-center gap-2.5">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${TONS[tom]}`}><Icon name={icon} className="h-[18px] w-[18px]" /></span>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      </div>
      <p className="num mt-3 text-[1.65rem] font-bold leading-none">{value}</p>
      <div className="mt-2 min-h-5 text-xs text-slate-500">{hint}{children}</div>
    </div>
  );
}

// Título de seção com ícone e linha de contexto.
export function Secao({ id, icone, titulo, dica, direita }) {
  return (
    <div id={id} className="flex flex-wrap items-end justify-between gap-2">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white"><Icon name={icone} className="h-[18px] w-[18px]" /></span>
        <div>
          <h2 className="text-lg font-bold leading-tight tracking-tight">{titulo}</h2>
          {dica && <p className="text-sm text-slate-500">{dica}</p>}
        </div>
      </div>
      {direita}
    </div>
  );
}

// Controle segmentado (abas pequenas).
export function Segmentado({ opcoes, valor, onChange, className = '' }) {
  return (
    <div className={`inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 ${className}`} role="tablist">
      {opcoes.map(([k, rot]) => (
        <button key={k} role="tab" aria-selected={valor === k} onClick={() => onChange(k)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${valor === k ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200' : 'text-slate-600 hover:text-slate-900'}`}>{rot}</button>
      ))}
    </div>
  );
}

export function Meter({ pct, cor = '#6366f1', className = '' }) {
  return <div className={`meter ${className}`}><i style={{ width: `${Math.max(2, Math.min(100, pct))}%`, background: cor }} /></div>;
}

export function Esqueleto({ className = '' }) { return <div className={`skeleton ${className}`} />; }

export function BotaoCopiar({ texto, rotulo = 'Copiar' }) {
  const [ok, setOk] = useState(false);
  const copiar = async () => {
    try { await navigator.clipboard.writeText(texto); setOk(true); setTimeout(() => setOk(false), 1600); } catch { /* sem permissão da área de transferência */ }
  };
  return (
    <button onClick={copiar} className="no-print inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50">
      <Icon name={ok ? 'check' : 'copy'} className="h-3.5 w-3.5" /> {ok ? 'Copiado' : rotulo}
    </button>
  );
}

// Botão pequeno que copia um dado (telefone, e-mail, texto) e confirma.
export function CopiarCampo({ texto, rotulo, icone = 'copy', className = '' }) {
  const [ok, setOk] = useState(false);
  const copiar = async (e) => {
    e.stopPropagation();
    try { await navigator.clipboard.writeText(texto); setOk(true); setTimeout(() => setOk(false), 1500); } catch { /* sem permissão da área de transferência */ }
  };
  return (
    <button onClick={copiar} title={`Copiar ${rotulo}`} className={`no-print inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 transition hover:border-indigo-300 hover:text-indigo-600 ${className}`}>
      <Icon name={ok ? 'check' : icone} className="h-3.5 w-3.5" /> {ok ? 'Copiado' : rotulo}
    </button>
  );
}

// Painel lateral para ver o detalhe de um item sem sair da página.
export function Gaveta({ aberta, onClose, children }) {
  useEffect(() => {
    if (!aberta) return undefined;
    const esc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [aberta, onClose]);
  if (!aberta) return null;
  return (
    <div className="no-print fixed inset-0 z-30 flex justify-end bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose}>
      <aside className="fade-up h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button onClick={onClose} aria-label="Fechar" className="sticky top-3 z-10 float-right mr-3 mt-3 rounded-full bg-white p-2 text-slate-500 shadow ring-1 ring-slate-200 hover:text-slate-900"><Icon name="close" className="h-4 w-4" /></button>
        {children}
      </aside>
    </div>
  );
}

// Conversa em balões, carregada quando o componente aparece.
export function Conversa({ id }) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState('');
  useEffect(() => {
    setD(null); setErro('');
    getJson(`/api/atendimentos/conversa?${new URLSearchParams({ id })}`).then(setD).catch((e) => setErro(e.message));
  }, [id]);
  if (erro) return <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">Não consegui carregar a conversa: {erro}</p>;
  if (!d) return <div className="space-y-2"><Esqueleto className="h-10 w-2/3" /><Esqueleto className="ml-auto h-10 w-2/3" /><Esqueleto className="h-10 w-1/2" /></div>;
  if (!d.texto_disponivel || !d.mensagens.length) return <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">O texto desta conversa não está gravado no banco. Use o resumo.</p>;
  return (
    <div className="max-h-[28rem] space-y-2 overflow-y-auto rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
      {d.mensagens.map((m, i) => (
        <div key={i} className={`flex ${m.de === 'cliente' ? 'justify-start' : 'justify-end'}`}>
          <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm ${m.de === 'cliente' ? 'rounded-tl-sm bg-white ring-1 ring-slate-200' : m.de === 'automação' ? 'rounded-tr-sm bg-violet-100' : 'rounded-tr-sm bg-indigo-100'}`}>
            <p className="text-[11px] font-semibold text-slate-500">{m.quem} · {m.quando}</p>
            <p className="whitespace-pre-wrap break-words text-slate-800">{m.texto || <em className="text-slate-400">(mídia ou mensagem sem texto)</em>}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
