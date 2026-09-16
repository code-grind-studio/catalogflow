#!/bin/bash
# Deploy di CatalogFlow su Vercel.
# Prerequisito: aver già fatto `vercel login` (autorizzazione via browser).
#
# Uso:
#   bash scripts/deploy.sh
# (legge le variabili da .env.local: riempilo prima di lanciarlo)
set -euo pipefail
cd "$(dirname "$0")/.."

if ! vercel whoami >/dev/null 2>&1; then
  echo "Non sei loggato su Vercel. Esegui prima: vercel login"
  exit 1
fi

echo "== Link/crea progetto Vercel =="
vercel link --yes

echo "== Imposta variabili ambiente (produzione) =="
while IFS='=' read -r key value; do
  [[ -z "$key" || "$key" == \#* ]] && continue
  echo "  -> $key"
  # rimuove eventuale valore precedente, poi lo aggiunge da stdin (non appare nei log)
  vercel env rm "$key" production --yes >/dev/null 2>&1 || true
  printf '%s' "$value" | vercel env add "$key" production >/dev/null
done < .env.local

echo "== Deploy in produzione =="
vercel --prod

echo
echo "Fatto. L'URL di produzione è quello stampato qui sopra."
