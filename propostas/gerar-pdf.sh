#!/usr/bin/env bash
# Gera o PDF de uma proposta a partir do proposta-print.html da pasta do clube.
# Uso: bash propostas/gerar-pdf.sh hipica-campinas
# Precisa do servidor local rodando na porta 8742 (python3 -m http.server 8742 na raiz do repo).
set -e
CLUBE="${1:?informe a pasta do clube, ex.: hipica-campinas}"
DIR="$(cd "$(dirname "$0")" && pwd)/$CLUBE"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless=new --disable-gpu --no-pdf-header-footer --virtual-time-budget=6000 \
  --run-all-compositor-stages-before-draw \
  --print-to-pdf="$DIR/proposta-$CLUBE.pdf" \
  "http://localhost:8742/propostas/$CLUBE/proposta-print.html" 2>/dev/null
echo "PDF gerado: $DIR/proposta-$CLUBE.pdf"
