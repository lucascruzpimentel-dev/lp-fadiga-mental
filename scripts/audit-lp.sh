#!/usr/bin/env bash
# Auditoria de performance e integridade das LPs em produção.
# Uso: ./scripts/audit-lp.sh

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RED='\033[0;31m'
YEL='\033[1;33m'
GRN='\033[0;32m'
NC='\033[0m'

P0=0
P1=0

log_p0() { echo -e "${RED}[P0]${NC} $*"; P0=$((P0 + 1)); }
log_p1() { echo -e "${YEL}[P1]${NC} $*"; P1=$((P1 + 1)); }
log_ok() { echo -e "${GRN}[OK]${NC} $*"; }

LP_DIRS=(
  "obrigado-congresso"
  "Congresso de Neuro"
  "congresso-neuro-vip-pass"
  "congresso-psicologia-vip-pass"
  "curso-telas"
  "fadiga-mental"
  "inscricao-congresso-neurociencia-no-esporte"
  "pos-graduacao-neurociencia-no-esporte"
  "pos-psicologia-do-esporte-e-coaching"
  "sessao-individual-jiu-jitsu"
  "treinador-mental-atletas"
)

echo "=== Auditoria de LPs — $(date '+%Y-%m-%d %H:%M') ==="
echo

for dir in "${LP_DIRS[@]}"; do
  if [[ ! -d "$dir" ]]; then
    log_p0 "Pasta ausente: $dir"
    continue
  fi

  html_files=()
  while IFS= read -r -d '' f; do
    html_files+=("$f")
  done < <(find "$dir" -maxdepth 2 -name '*.html' \
    ! -path '*/materiais/*' \
    ! -path '*/material/*' \
    ! -iname '*design-system*' \
    ! -iname '*design_system*' \
    -print0 2>/dev/null)

  if [[ ${#html_files[@]} -eq 0 ]]; then
    log_p1 "Sem HTML em $dir"
    continue
  fi

  for html in "${html_files[@]}"; do
    rel="${html#$ROOT/}"
    size_kb=$(($(wc -c < "$html" | tr -d ' ') / 1024))

    if [[ $size_kb -gt 500 ]]; then
      log_p0 "$rel — HTML ${size_kb} KB (>500 KB)"
    elif [[ $size_kb -gt 200 ]]; then
      log_p1 "$rel — HTML ${size_kb} KB (>200 KB)"
    fi

    if grep -qE '<img[^>]+src="data:image/(avif|png|jpeg|jpg|webp)' "$html" 2>/dev/null; then
      count=$(grep -oE '<img[^>]+src="data:image/(avif|png|jpeg|jpg|webp)' "$html" | wc -l | tr -d ' ')
      log_p0 "$rel — $count imagem(ns) raster base64 em <img> (extrair para assets/)"
    fi

    if grep -q 'code.iconify.design' "$html" && ! grep -q 'defer.*iconify\|iconify.*defer' "$html"; then
      log_p1 "$rel — Iconify sem defer"
    fi

    if grep -q 'player.vimeo.com/api/player.js' "$html" && ! grep -q 'defer.*player\.js\|player\.js.*defer' "$html"; then
      log_p1 "$rel — Vimeo player.js sem defer"
    fi

    # Paths com espaço ou acento em assets locais
    if grep -oE '(src|href)="[^"]*assets/[^"]*"' "$html" 2>/dev/null | grep -qE '%| |ç|ã|é|í|ó|ú|â|ê|ô|à'; then
      log_p1 "$rel — paths de assets com espaço/acento (risco 404 Linux)"
    fi

    # Verificar assets locais referenciados (ignora comentários e placeholders de vídeo)
    while IFS= read -r ref; do
      [[ -z "$ref" ]] && continue
      [[ "$ref" == http* ]] && continue
      [[ "$ref" == //* ]] && continue
      [[ "$ref" == *video-neurociencia.mp4* ]] && continue
      [[ "$ref" == *".mp4" ]] && continue

      html_dir=$(dirname "$html")
      if [[ "$ref" == /* ]]; then
        asset_path="${ref#/}"
      else
        asset_path="$html_dir/$ref"
      fi

      # Decodificar URL encoding para checagem no disco
      decoded=$(python3 -c "import sys, urllib.parse; print(urllib.parse.unquote(sys.argv[1]))" "$asset_path" 2>/dev/null || echo "$asset_path")

      if [[ ! -f "$asset_path" && ! -f "$decoded" ]]; then
        log_p0 "$rel — asset ausente: $ref"
      fi
    done < <(grep -v '<!--' "$html" 2>/dev/null | grep -oE '(src|href)="[^"]+"' \
      | sed -E 's/^(src|href)="([^"]+)"/\2/' \
      | grep -E '^(assets/|/[^/]+/assets/)' || true)
  done

  asset_size=$(du -sk "$dir" 2>/dev/null | awk '{print $1}')
  if [[ -n "${asset_size:-}" && $asset_size -gt 20480 ]]; then
    log_p1 "$dir — pasta total ${asset_size} KB (>20 MB)"
  fi
done

# index.html raiz
if [[ -f index.html ]]; then
  size_kb=$(($(wc -c < index.html | tr -d ' ') / 1024))
  [[ $size_kb -gt 200 ]] && log_p1 "index.html — ${size_kb} KB"
fi

echo
echo "=== Resumo ==="
echo -e "P0 (bloqueante): ${RED}$P0${NC}"
echo -e "P1 (recomendado): ${YEL}$P1${NC}"

if [[ $P0 -eq 0 && $P1 -eq 0 ]]; then
  log_ok "Nenhum problema encontrado."
  exit 0
elif [[ $P0 -eq 0 ]]; then
  exit 0
else
  exit 1
fi
