// Chamadas à API. Se a sessão expirar (401), avisa o App para voltar à tela de login.
export async function getJson(url) {
  const r = await fetch(url, { credentials: 'same-origin' });
  if (r.status === 401) {
    window.dispatchEvent(new Event('auth-expired'));
    throw new Error('Sessão expirada. Entre novamente.');
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Erro ${r.status}`);
  return j;
}
