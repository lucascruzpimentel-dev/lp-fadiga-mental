# LP Recursos Atleta Campeão

Referência das landing pages e URLs do projeto. Deploy é automático via push na branch `main` — ver [DEPLOY-AUTOMATICO.md](DEPLOY-AUTOMATICO.md).

---

## Páginas em produção

| URL (produção) | Arquivo no repositório | Finalidade |
|----------------|------------------------|------------|
| `/obrigado-congresso-neuro-upgrade` | `obrigado-congresso/obrigado_congresso_neuro.html` | Obrigado pós-inscrição no congresso + oferta do Passe Profissional (R$ 47) |
| `/congresso-neuro-vip-pass` | `congresso-neuro-vip-pass/congresso-neuro-vip-pass.html` | Base — anúncio do congresso + oferta do Passe Profissional (gravações, certificado, Zoom) |

---

## Outras pastas do projeto

- **Congresso de Neuro** — `Congresso de Neuro/lp_congresso_neuro.html` — LP de inscrição/captura do congresso.
- **fadiga-mental** — LP do curso Neurociência da Fadiga no Esporte.
- **inscricao-congresso-neurociencia-no-esporte** — Inscrição/captura do congresso (redirect em `vercel.json`).

---

## Assets compartilhados

A página `/congresso-neuro-vip-pass` usa as mesmas imagens da página de obrigado, em caminho absoluto: `/obrigado-congresso/assets/` (logo, certificado, fotos dos palestrantes, mockup). Não duplicar assets na pasta `congresso-neuro-vip-pass`.
