// fetch para o Supabase que NUNCA deixa valores de variáveis (chaves) aparecerem em mensagens de erro.
// O erro original do Node pode conter o valor do header, então é descartado e trocado por texto seguro.
export async function safeFetch(url, init, label) {
  try {
    return await fetch(url, init);
  } catch (e) {
    if (e instanceof TypeError && /header/i.test(e.message)) {
      throw new Error(`${label}: chave do Supabase com formato inválido (a variável deve conter só a chave, sem nome, espaços ou quebras de linha)`);
    }
    throw new Error(`${label}: falha de conexão com o Supabase`);
  }
}
