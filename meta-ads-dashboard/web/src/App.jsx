import { useEffect, useState } from 'react';
import MetaAds from './MetaAds.jsx';
import WhatsApp from './WhatsApp.jsx';
import Atendimento from './Atendimento.jsx';
import Login from './Login.jsx';

const TABS = [['meta', 'Meta Ads'], ['atend', 'Atendimento'], ['wa', 'WhatsApp · custos']];

export default function App() {
  const [authed, setAuthed] = useState(null); // null = verificando
  useEffect(() => {
    fetch('/api/session').then((r) => r.json()).then((j) => setAuthed(!!j.ok)).catch(() => setAuthed(false));
    const expired = () => setAuthed(false);
    window.addEventListener('auth-expired', expired);
    return () => window.removeEventListener('auth-expired', expired);
  }, []);
  const logout = () => fetch('/api/logout', { method: 'POST' }).finally(() => setAuthed(false));
  const [tab, setTab] = useState(() => {
    try { return localStorage.getItem('tab') || 'meta'; } catch { return 'meta'; }
  });
  const pick = (t) => { setTab(t); try { localStorage.setItem('tab', t); } catch { /* sem storage */ } };
  if (authed === null) return null;
  if (!authed) return <Login onDone={() => setAuthed(true)} />;
  return (
    <>
      <nav className="no-print sticky top-0 z-10 border-b border-slate-200/70 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl gap-1 px-4">
          {TABS.map(([id, label]) => (
            <button key={id} onClick={() => pick(id)}
              className={`border-b-2 px-4 py-3 text-sm font-semibold transition ${tab === id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
              {label}
            </button>
          ))}
          <button onClick={logout} className="ml-auto px-3 py-3 text-sm text-slate-500 hover:text-slate-800">Sair</button>
        </div>
      </nav>
      {tab === 'meta' ? <MetaAds /> : tab === 'atend' ? <Atendimento /> : <WhatsApp />}
    </>
  );
}
