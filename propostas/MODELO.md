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

Estrutura: o Atleta Campeão é o protagonista. Capa → o que entregamos (treinamento sob medida + temas do esporte) → o treinamento na prática (fotos reais de palestras + pilares atletas, treinadores, pais) → Sobre a Mayra (fotos patinando, títulos) → Sobre o Atleta Campeão (números, formatos, logos) → a parceria (o treino é nosso, a contrapartida é a gravação) → briefing. Não elogiar o clube cliente.

Visual: seções escuras (#0D0D0D) e creme (#F3ECE0) alternadas, Montserrat (fonte das capas @atletacampeao) com títulos em caixa alta, dourado #DAA525, pouco texto (um item por linha), logo pequena. Nada de Georgia/serif, Inter ou página toda branca.
A seção "Sobre a Mayra" e "Sobre o Atleta Campeão" são iguais para todas as propostas.
