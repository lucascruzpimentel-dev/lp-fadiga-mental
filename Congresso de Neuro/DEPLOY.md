# Publicar no Vercel (URL: atletacampeaotreinamentos.com/inscricao-congresso-neurociencia-no-esporte)

## Opção A: Projeto só do Congresso (recomendado)

1. **Add New** → **Project** → importe o repositório.
2. **Root Directory**: clique em **Edit** e selecione **Congresso de Neuro**.
3. **Build Command** e **Output Directory**: deixe em branco.
4. **Deploy**.
5. **Settings** → **Domains** → adicione **atletacampeaotreinamentos.com**.
6. Ao adicionar, defina o **path**: **/inscricao-congresso-neurociencia-no-esporte**.

## Opção B: Mesmo projeto do site principal (deploy da raiz)

Se o domínio atletacampeaotreinamentos.com já usa um projeto que faz deploy **da raiz do repositório** (Root Directory em branco):

- O arquivo **vercel.json na raiz** do repo já está configurado para essa URL.
- Faça push das alterações e aguarde o deploy (1–2 min).

## Se ainda der 404

1. No Vercel, abra o projeto que está ligado a **atletacampeaotreinamentos.com**.
2. Em **Settings** → **General**, confira o **Root Directory**:
   - Se for **Congresso de Neuro**: a URL /inscricao-congresso-neurociencia-no-esporte deve ser configurada em **Domains** (com path). Use a Opção A.
   - Se estiver **em branco**: o deploy é da raiz; o **vercel.json da raiz** deve estar no repositório e no último deploy. Use a Opção B.
3. Em **Deployments**, abra o último deploy e veja se **vercel.json** aparece nos arquivos (na raiz ou em Congresso de Neuro, conforme o caso).
