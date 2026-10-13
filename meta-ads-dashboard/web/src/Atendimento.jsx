// Aba Atendimento: primeiro o canal (Geral, WhatsApp, Instagram), depois a visão dentro do canal.
// Geral junta os dois canais; WhatsApp e Instagram têm as suas próprias telas, porque os objetivos são diferentes
// (atender e resolver no WhatsApp; prospectar e agendar no Instagram).
import { useState } from 'react';
import Dia from './Dia.jsx';
import Gerencia from './Gerencia.jsx';
import Atendimentos from './Atendimentos.jsx';
import Equipe from './Equipe.jsx';
import Desempenho from './Desempenho.jsx';
import Instagram from './Instagram.jsx';
import { Icon } from './ui.jsx';

const CANAIS = [['geral', 'Geral', 'chart'], ['whatsapp', 'WhatsApp', 'whatsapp'], ['instagram', 'Instagram', 'chat']];
const SUBS = {
  geral: [['dia', 'Visão do dia'], ['gerencia', 'Gerência'], ['equipe', 'Equipe']],
  whatsapp: [['dia', 'Dia'], ['casos', 'Casos analisados (IA)'], ['vendedor', 'Vendedor']],
  instagram: [['dia', 'Dia'], ['funil', 'Social selling']],
};

const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sem storage */ } };
const ler = (k, padrao) => { try { return localStorage.getItem(k) || padrao; } catch { return padrao; } };

export default function Atendimento() {
  const [canal, setCanal] = useState(() => (SUBS[ler('canal', 'geral')] ? ler('canal', 'geral') : 'geral'));
  const [sub, setSub] = useState(() => ler(`sub_${ler('canal', 'geral')}`, 'dia'));
  const [quem, setQuem] = useState('time'); // 'time' ou o id do vendedor
  const subs = SUBS[canal];
  const subAtual = subs.some(([id]) => id === sub) ? sub : subs[0][0];

  const irCanal = (c) => { setCanal(c); guardar('canal', c); setSub(ler(`sub_${c}`, 'dia')); };
  const irSub = (s) => { setSub(s); guardar(`sub_${canal}`, s); };
  const abrirVendedor = (id) => { setQuem(id); setCanal('whatsapp'); guardar('canal', 'whatsapp'); setSub('vendedor'); guardar('sub_whatsapp', 'vendedor'); };

  return (
    <div>
      <div className="no-print mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 pt-5">
        <div className="inline-flex gap-1 rounded-xl bg-slate-900 p-1" role="tablist" aria-label="Canal">
          {CANAIS.map(([id, label, icone]) => (
            <button key={id} role="tab" aria-selected={canal === id} onClick={() => irCanal(id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition ${canal === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-300 hover:text-white'}`}>
              <Icon name={icone} className="h-4 w-4" />{label}
            </button>
          ))}
        </div>
        <div className="inline-flex gap-1 rounded-xl bg-slate-200/60 p-1" role="tablist" aria-label="Visão">
          {subs.map(([id, label]) => (
            <button key={id} role="tab" aria-selected={subAtual === id} onClick={() => irSub(id)}
              className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition ${subAtual === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>{label}</button>
          ))}
        </div>
      </div>

      {subAtual === 'dia' && <Dia key={canal} canal={canal} />}
      {canal === 'geral' && subAtual === 'gerencia' && <Gerencia onAbrir={abrirVendedor} />}
      {canal === 'geral' && subAtual === 'equipe' && <Equipe onAbrir={abrirVendedor} />}
      {canal === 'whatsapp' && subAtual === 'casos' && <Atendimentos />}
      {canal === 'whatsapp' && subAtual === 'vendedor' && (
        <div className="mx-auto max-w-6xl space-y-6 px-4 pb-10 pt-4"><Desempenho quem={quem} setQuem={setQuem} /></div>
      )}
      {canal === 'instagram' && subAtual === 'funil' && <Instagram />}
    </div>
  );
}
