# LP Curso Leonardo Fortes — Neurociência da Fadiga no Esporte

Landing pages estáticas do curso **Neurociência da Fadiga no Esporte** (Instituto Atleta Campeão).

## Estrutura do projeto

```
├── lp_fadiga_mental.html      # LP principal
├── 02_lp_fadiga_mental.html   # LP alternativa (estilo The Neuro Academy)
├── design-system.html         # Design system de referência
├── README.md
│
├── assets/                    # Mídia pública (imagens e vídeo das LPs)
│   ├── images/               # Logos, professor, mockups, módulos, certificado
│   └── video/                # Vídeos usados nas páginas
│
├── docs/                      # Documentação e conteúdo de apoio
│   ├── prompts/              # Prompts usados na criação/revisão das seções
│   └── referencias/          # Links úteis e referências
│
└── bkp/                       # Backups de versões anteriores
```

## Páginas

- **lp_fadiga_mental.html** — Versão principal da landing page.
- **02_lp_fadiga_mental.html** — Versão alternativa com tema claro.
- **design-system.html** — Referência visual (cores, tipografia, componentes). Usa sua própria pasta `assets/` quando existir na raiz.

As LPs usam caminhos relativos para carregar imagens e vídeo a partir de `assets/images/` e `assets/video/`.

## Incluir nova mídia

- **Imagens (logo, fotos, mockups, etc.):** coloque em `assets/images/` e referencie nos HTMLs como `assets/images/nome-do-arquivo.ext`.
- **Vídeos:** coloque em `assets/video/` e referencie como `assets/video/nome-do-arquivo.mp4`.

Assim os links relativos continuam funcionando com as páginas na raiz do projeto.

## Como visualizar

Abra os arquivos `.html` diretamente no navegador ou use um servidor local (ex.: `npx serve .`) para garantir que recursos e caminhos relativos carreguem corretamente.
