# Deploy automático (Vercel + GitHub)

## Como funciona

1. **Você faz alterações** nas pastas das LPs (`obrigado-congresso`, `Congresso de Neuro`, `fadiga-mental`, etc.).
2. **Envia para o GitHub** (commit + push na branch `main`).
3. **A Vercel** detecta o push e faz o build/deploy sozinha (em 1–2 min).

Não é preciso rodar nada na Vercel manualmente: **push = deploy**.

---

## Formas de subir (do mais automático ao manual)

### 1. Script rápido (recomendado)

No terminal, na raiz do projeto:

```bash
./deploy.sh "Descrição do que mudou"
```

Ou só `./deploy.sh` para usar a mensagem padrão.

O script:
- Adiciona as pastas das LPs + `vercel.json`
- Faz commit com a mensagem que você passou
- Dá push para `main`

Na primeira vez, dê permissão de execução:

```bash
chmod +x deploy.sh
```

### 2. Pelo Cursor

Peça: *“Faz o deploy”* ou *“Sobe as alterações para o GitHub”*.  
O assistente pode rodar `git add`, `commit` e `push` pelos arquivos que você alterou.

### 3. Manual (git)

```bash
git add obrigado-congresso/ "Congresso de Neuro/" fadiga-mental/ vercel.json
git commit -m "Sua mensagem"
git push origin main
```

---

## URLs após o deploy

- Congresso (inscrição): `atletacampeaotreinamentos.com/inscricao-congresso-neurociencia-no-esporte`
- Obrigado (upgrade): `atletacampeaotreinamentos.com/obrigado-congresso-neuro-upgrade`
- Fadiga mental: conforme configurado no projeto Vercel (ex.: path `/fadiga-mental`)
