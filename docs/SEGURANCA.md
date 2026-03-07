# Camadas de segurança — LPs e contas

Guia prático para reduzir risco de hack, phishing e perda de dados.

---

## 1. Autenticação em duas etapas (2FA) — obrigatório

**Onde ativar:**

| Serviço | Onde ativar | Por quê |
|--------|----------------|--------|
| **GitHub** | Settings → Password and authentication → Two-factor authentication | Quem tiver sua senha não consegue entrar sem o 2º fator (app ou SMS). |
| **Vercel** | Account Settings → Security → Two-Factor Authentication | Protege os deploys e o domínio. |
| **E-mail** (Gmail/Outlook) | Configurações da conta → Segurança → Verificação em 2 etapas | E-mail é a “chave mestra”: recuperação de senha de tudo passa por ele. |
| **Cloudflare** (domínio atletacampeaotreinamentos.com) | My Profile → Authentication → Two-Factor Authentication | Evita que alguém mude o DNS ou “roube” o domínio. |

**Dica:** Prefira app de autenticação (Google Authenticator, Authy, 1Password) em vez de só SMS (SMS pode ser desviado).

---

## 2. Proteção contra phishing

- **Não clique em links de “atualizar senha” ou “confirmar conta” que vêm por e-mail**, a menos que você mesmo tenha pedido a recuperação. Sempre abra o site **digitando o endereço** ou usando um favorito.
- **Desconfie de mensagens urgentes** (“sua conta será bloqueada em 1 hora”, “confirme agora”). Empresas sérias não pedem senha ou 2FA por link em e-mail.
- **Verifique o endereço (URL)** antes de digitar senha: `github.com`, `vercel.com`, etc. — e não algo como `github-com.xyz` ou `vercel-secure.other.com`.
- Se alguém pedir **código de 2FA** por telefone, e-mail ou chat: **nunca passe**. Ninguém legítimo pede isso.

---

## 3. Senhas e tokens

- **Senha forte e única** para GitHub, Vercel e e-mail (não reutilize em outros sites).
- **Nunca commitar** no repositório:
  - Senhas, API keys, tokens do Facebook/Meta, chaves da Vercel.
- **Secrets:** use **variáveis de ambiente** na Vercel (Settings → Environment Variables) para qualquer chave que o site precise em produção. O código só lê a variável; o valor fica só na Vercel.

---

## 4. GitHub (repositório)

- Repositório **privado** (como você já considerou).
- **2FA** na conta (ver item 1).
- Revise **Collaborators** de tempos em tempos (Settings → Collaborators): só pessoas de confiança com o mínimo de acesso necessário.
- Se usar **Personal Access Token** para deploy/API: crie um token com escopo limitado e não compartilhe. Rotacione se desconfiar que vazou.

---

## 5. Vercel (deploy) e Cloudflare (domínio)

**Vercel**
- **2FA** na conta.
- Garanta que só você (ou sua equipe de confiança) tenha acesso ao projeto.
- De vez em quando confira **Deployments** para ver se não há deploys de quem você não reconhece.

**Cloudflare** (atletacampeaotreinamentos.com)
- **2FA** na conta: My Profile (ícone de perfil) → **Authentication** → **Two-Factor Authentication**.
- Quem acessa a Cloudflare controla o DNS (para onde o domínio aponta). Com 2FA, mesmo que alguém descubra a senha, não altera os registros sem o segundo fator.
- Se o domínio estiver registrado na própria Cloudflare (Registrar), ative também **Domain Lock** (trava de transferência) no painel do domínio, para ninguém conseguir transferir o domínio para outro registrador sem sua autorização.

---

## 6. Não perder tudo (backup e recuperação)

- **Código:** já está versionado no Git. O repositório no GitHub é seu “backup” principal. Com repo privado + 2FA, o risco de apagar ou perder por hack diminui.
- **Cópia local:** você já tem uma cópia no seu Mac (a pasta do projeto). Manter `git push` em dia garante que o GitHub tenha a versão mais recente.
- **Chaves e segredos:** anote em lugar seguro (gerenciador de senhas, cofre) onde estão:
  - Domínio (Cloudflare — login em dash.cloudflare.com)
  - Conta Vercel
  - Conta GitHub
  - E-mail principal
  Assim, se perder o acesso a um serviço, você sabe onde recuperar.

---

## 7. Checklist rápido

- [ ] 2FA no e-mail
- [ ] 2FA no GitHub
- [ ] 2FA na Vercel
- [ ] 2FA na Cloudflare (domínio)
- [ ] Repositório privado
- [ ] Nenhuma senha ou API key no código (só variáveis de ambiente na Vercel)
- [ ] Não clicar em links de “recuperar senha” vindos de e-mail suspeito
- [ ] Saber que o domínio está na Cloudflare e como acessar (dash.cloudflare.com)

---

Resumo: as “camadas” que mais protegem são **2FA em tudo**, **repositório privado**, **nada de segredos no código** e **cuidado com phishing**. Isso já reduz muito o risco de ser hackeado e de perder o projeto.
