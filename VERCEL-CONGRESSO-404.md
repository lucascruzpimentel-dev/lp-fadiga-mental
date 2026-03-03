# Como fazer a URL /inscricao-congresso-neurociencia-no-esporte funcionar no Vercel

Se continua dando **404**, o domínio provavelmente está apontando para um projeto cujo deploy **não inclui** a pasta `inscricao-congresso-neurociencia-no-esporte`. Use um **projeto só para essa página**:

---

## Passo a passo (projeto dedicado)

1. **Vercel** → **Add New** → **Project**.
2. **Import** o mesmo repositório (ex.: lp-fadiga-mental).
3. Em **Configure Project**:
   - **Root Directory**: clique em **Edit** e digite exatamente:  
     `inscricao-congresso-neurociencia-no-esporte`
   - **Build Command**: deixe em branco.
   - **Output Directory**: deixe em branco.
4. **Deploy**.
5. Depois do deploy: **Settings** → **Domains** → **Add**:
   - Domínio: `atletacampeaotreinamentos.com`
   - **Path**: marque/adicione o path: `inscricao-congresso-neurociencia-no-esporte`
6. Salve. O Vercel vai usar esse projeto **só** para essa URL.

---

## Por que isso resolve

- O projeto passa a ter como “raiz” só o conteúdo da pasta `inscricao-congresso-neurociencia-no-esporte` (o `index.html` e a pasta `assets/`).
- Quem acessa `atletacampeaotreinamentos.com/inscricao-congresso-neurociencia-no-esporte` cai nesse projeto e recebe o `index.html` da raiz do projeto = a LP do congresso.

O site principal em `atletacampeaotreinamentos.com` continua sendo o outro projeto; esse novo projeto responde **apenas** por essa URL.
