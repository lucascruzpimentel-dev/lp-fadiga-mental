import { useState } from 'react';
import MetaAds from './MetaAds.jsx';
import WhatsApp from './WhatsApp.jsx';

const TABS = [['meta', 'Meta Ads'], ['wa', 'WhatsApp']];

export default function App() {
  const [tab, setTab] = useState(() => {
    try { return localStorage.getItem('tab') || 'meta'; } catch { return 'meta'; }
  });
  const pick = (t) => { setTab(t); try { localStorage.setItem('tab', t); } catch { /* sem storage */ } };
  return (
    <>
      <nav className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl gap-1 px-4">
          {TABS.map(([id, label]) => (
            <button key={id} onClick={() => pick(id)}
              className={`border-b-2 px-4 py-3 text-sm font-medium ${tab === id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
              {label}
            </button>
          ))}
        </div>
      </nav>
      {tab === 'meta' ? <MetaAds /> : <WhatsApp />}
    </>
  );
}
