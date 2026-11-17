# Modelo de proposta · Atleta Campeão na Prática

Cada proposta tem duas versões geradas a partir da mesma pasta:

| Versão | Arquivo | Para quê |
| --- | --- | --- |
| Link | `propostas/<clube>/index.html` | Enviar por WhatsApp. Tem o briefing respondível, que volta pronto no WhatsApp do AC. |
| Documento | `propostas/<clube>/proposta-print.html` → `proposta-<clube>.pdf` | Anexar em e-mail ou imprimir. A última página é o briefing em papel. |

## Criar a proposta de outro clube

1. Duplicar `propostas/hipica-campinas/` com o nome do novo clube (ex.: `propostas/clube-x/`).
2. Nos dois HTML, trocar o logo do clube (`<clube>/assets/`), a seção "Por que o clube" (conquistas recentes do site oficial do clube, com a fonte), a comissão técnica, os exemplos "Na quadra" dos temas (adaptar ao esporte) e também: nome do clube, modalidade/equipe/faixa etária, data, comissão técnica, formato sugerido, temas e o link do briefing.
3. Se a proposta for paga, trocar o bloco "A contrapartida" / "Sem cobrança de cachê" por um bloco de investimento.
4. Gerar o PDF com o servidor local ligado (`python3 -m http.server 8742` na raiz):
   `bash propostas/gerar-pdf.sh clube-x`
5. Publicar (commit na main) e enviar o link `atletacampeaotreinamentos.com/propostas/clube-x/`.

As fotos e logos ficam em `propostas/assets/` e são compartilhadas por todas as propostas.
As páginas têm `noindex` para não aparecer no Google.

Visual: segue o design system do AC (`atendimento-individual-ac/design_system.html`): fundo #0A0A0A, ouro #DAA525, azul #02337A, Barlow 900 + Inter, botões em pílula. A cor do clube aparece só no card "Por que o clube" e no selo do logo.
A seção "Sobre a Mayra" (arquivo pessoal + linha do tempo) é igual para todas as propostas.
