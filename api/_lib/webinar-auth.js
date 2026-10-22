// Login do painel de webinars: senha única (ADMIN_PASSWORD) -> token assinado (HMAC) com validade.
const crypto = require('crypto');

const TTL_MS = 7 * 24 * 3600 * 1000;

function secret() {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) throw new Error('ADMIN_PASSWORD is not configured');
  return pw + ':' + (process.env.SUPABASE_SERVICE_ROLE_KEY || '');
}

function sign(payload) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('hex');
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function login(password) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || typeof password !== 'string') return null;
  // compara HMACs (mesmo tamanho) para não vazar o tamanho da senha
  if (!safeEqual(sign(password), sign(expected))) return null;
  const exp = String(Date.now() + TTL_MS);
  return exp + '.' + sign(exp);
}

function verify(token) {
  if (typeof token !== 'string') return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return safeEqual(sig, sign(exp));
}

module.exports = { login, verify };
