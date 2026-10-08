// Login por senha única, validada no Supabase (função verify_dashboard_password).
// O navegador nunca recebe hash nem chave: só um cookie de sessão assinado (HttpOnly).
import crypto from 'node:crypto';

const env = process.env;
const SECRET = env.DASHBOARD_SESSION_SECRET;
const SB_URL = env.META_SUPABASE_URL;
const SB_KEY = env.META_SUPABASE_SERVICE_ROLE_KEY;
const TTL = 12 * 3600; // segundos
const MAX_FAILS = 5, WINDOW_MIN = 15;
export const authEnabled = env.AUTH_DISABLED !== '1'; // AUTH_DISABLED=1 só para desenvolvimento local

const sign = (p) => crypto.createHmac('sha256', SECRET).update(p).digest('base64url');
const makeToken = () => {
  const p = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + TTL })).toString('base64url');
  return `${p}.${sign(p)}`;
};
function validToken(t) {
  if (!t || !SECRET) return false;
  const [p, sig] = t.split('.');
  if (!p || !sig) return false;
  const want = Buffer.from(sign(p)), got = Buffer.from(sig);
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return false;
  try { return JSON.parse(Buffer.from(p, 'base64url').toString()).exp > Date.now() / 1000; } catch { return false; }
}
const cookies = (req) => Object.fromEntries((req.headers.cookie || '').split(';').map((c) => c.trim().split('=')).filter((c) => c[0]).map(([k, ...v]) => [k, v.join('=')]));
const isAuthed = (req) => !authEnabled || validToken(cookies(req).session);

export function requireAuth(req, res, next) {
  if (isAuthed(req)) return next();
  res.status(401).json({ error: 'não autenticado' });
}
export const session = (req, res) => res.json({ ok: isAuthed(req), login: authEnabled });

const sbFetch = (path, init = {}) => fetch(`${SB_URL}/rest/v1/${path}`, {
  ...init, headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json', ...init.headers },
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function login(req, res) {
  if (!authEnabled) return res.json({ ok: true });
  if (!SECRET || !SB_URL || !SB_KEY) return res.status(503).json({ error: 'Login não configurado no servidor.' });
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!password || password.length > 200) return res.status(400).json({ error: 'Informe a senha.' });
  // req.ip vem do proxy confiável (trust proxy = 1); o primeiro x-forwarded-for seria forjável pelo visitante.
  const ip = req.ip || 'desconhecido';
  try {
    const since = new Date(Date.now() - WINDOW_MIN * 60e3).toISOString();
    const q = new URLSearchParams({ select: 'id', ip: `eq.${ip}`, ok: 'eq.false', limit: String(MAX_FAILS) });
    q.append('created_at', `gte.${since}`);
    const fails = await sbFetch(`dashboard_login_attempts?${q}`);
    if (!fails.ok) throw new Error('tentativas');
    if ((await fails.json()).length >= MAX_FAILS) return res.status(429).json({ error: `Muitas tentativas. Tente de novo em ${WINDOW_MIN} minutos.` });

    const r = await sbFetch('rpc/verify_dashboard_password', { method: 'POST', body: JSON.stringify({ p_password: password }) });
    if (!r.ok) throw new Error('verificação');
    const ok = (await r.json()) === true;
    await sbFetch('dashboard_login_attempts', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ ip, ok }) });
    if (!ok) { await sleep(500); return res.status(401).json({ error: 'Senha incorreta.' }); }

    res.setHeader('Set-Cookie', `session=${makeToken()}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${TTL}${req.secure ? '; Secure' : ''}`);
    res.json({ ok: true });
  } catch (e) {
    console.error('login:', e.message);
    res.status(502).json({ error: 'Não foi possível validar a senha. Confira se supabase/dashboard_auth.sql foi executado.' });
  }
}

export function logout(_req, res) {
  res.setHeader('Set-Cookie', 'session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
  res.json({ ok: true });
}
