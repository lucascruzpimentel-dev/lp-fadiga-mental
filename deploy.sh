#!/usr/bin/env bash
# Deploy LP: adiciona alterações, faz commit e push para main (Vercel faz o deploy automático)
# Uso: ./deploy.sh "sua mensagem de commit"
#      ./deploy.sh   (usa mensagem padrão)

set -e
cd "$(dirname "$0")"

MSG="${1:-Deploy: atualizações nas LPs}"

echo "📦 Adicionando alterações..."
git add \
  "index.html" \
  "obrigado-congresso/" \
  "Congresso de Neuro/" \
  "congresso-neuro-vip-pass/" \
  "curso-telas/" \
  "fadiga-mental/" \
  "inscricao-congresso-neurociencia-no-esporte/" \
  "pos-graduacao-neurociencia-no-esporte/" \
  vercel.json \
  deploy.sh \
  2>/dev/null || true

if git diff --staged --quiet; then
  echo "✅ Nada para enviar (working tree limpo ou sem arquivos das pastas de LP)."
  exit 0
fi

echo "📝 Commit: $MSG"
git commit -m "$MSG"

echo "🚀 Push para origin main..."
git push origin main

echo "✅ Deploy disparado. A Vercel deve publicar em 1–2 min."
