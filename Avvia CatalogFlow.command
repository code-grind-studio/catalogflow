#!/bin/bash
# Doppio click per avviare CatalogFlow in locale.
cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  echo "Prima volta: installo le dipendenze..."
  npm install
fi

echo "Avvio CatalogFlow su http://localhost:3000 ..."
( sleep 2 && open http://localhost:3000 ) &
npm run dev
