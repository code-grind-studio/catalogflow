#!/bin/bash
# ---------------------------------------------------------------------------
# Eseguito da CatalogFlow.app (doppio click sull'icona).
# Avvia il server del catalogo, apre il browser e resta attivo finché non
# premi "Ferma CatalogFlow": alla chiusura spegne anche il server.
# __PROGETTO__ viene sostituito dal percorso reale dal generatore dell'app.
# ---------------------------------------------------------------------------
set -u

PROGETTO="__PROGETTO__"
PORTA=3000
URL="http://localhost:$PORTA"
LOG="$PROGETTO/catalogflow.log"

notifica() {
  osascript -e "display dialog \"$1\" buttons {\"OK\"} default button \"OK\" with title \"CatalogFlow\" with icon ${2:-note}" >/dev/null 2>&1
}

# avviso non bloccante: sparisce da solo, non c'è niente da chiudere
avvisa() {
  osascript -e "display notification \"$1\" with title \"CatalogFlow\"" >/dev/null 2>&1
}

cd "$PROGETTO" || exit 1

# --- Node/npm: un'app lanciata dal Finder non eredita il PATH del terminale ---
# L'ordine conta: prima i Node "locali" e arm64, mai un binario x86-64 su Apple
# Silicon (sotto Rosetta Next cerca i binari nativi sbagliati, es. lightningcss).
scegli_node() {
  for p in "$HOME/.hermes/node/bin" "$HOME/.local/bin" /opt/homebrew/bin /usr/local/bin /usr/bin; do
    [ -x "$p/node" ] && [ -x "$p/npm" ] || continue
    if [ "$(uname -m)" = "arm64" ] && file -b "$p/node" 2>/dev/null | grep -q "^Mach-O 64-bit executable x86_64"; then
      continue
    fi
    export PATH="$p:$PATH"
    return 0
  done
  return 1
}

# La scelta va fatta SEMPRE, non solo quando npm "manca": un PATH ereditato con
# un Node x86-64 davanti porterebbe Next sotto Rosetta (e ai binari nativi
# sbagliati, es. lightningcss.darwin-x64.node). I Node elencati per primi sono
# arm64 puri, quindi girano nativi anche se il processo padre è tradotto.
scegli_node || { notifica "Non trovo Node.js. Installalo da nodejs.org (versione LTS) e riprova." caution; exit 1; }

echo "--- avvio $(date '+%Y-%m-%d %H:%M:%S') — node: $(command -v node) ($(node -p 'process.arch'))" >>"$LOG"

if [ ! -f ".env.local" ]; then
  notifica "Manca il file .env.local. Copia .env.example in .env.local e riempi i valori (password e credenziali Shopify)." caution
  open "$PROGETTO"
  exit 1
fi

# --- server già attivo? apri solo il browser ---
if curl -s -o /dev/null -m 1 "$URL"; then
  open "$URL"
  exit 0
fi

# --- avvio del server ---
if [ ! -d node_modules ]; then
  osascript -e 'display notification "Prima volta: installo le dipendenze, ci vuole un minuto." with title "CatalogFlow"' >/dev/null 2>&1
  npm install >>"$LOG" 2>&1
fi

npm run dev >>"$LOG" 2>&1 &
SERVER_PID=$!

# qualunque sia il modo in cui l'app si chiude (Esci dal Dock, kill, chiusura
# di sessione): il server viene spento con lei. "npm run dev" lascia vivo il
# figlio "next dev", quindi dopo aver chiuso npm chiudiamo anche chi tiene la porta.
spegni() {
  kill "$SERVER_PID" 2>/dev/null
  pkill -P "$SERVER_PID" 2>/dev/null
  # chi ascolta sulla porta (solo il listener: le connessioni del browser no)
  for pid in $(lsof -ti tcp:"$PORTA" -sTCP:LISTEN 2>/dev/null); do kill "$pid" 2>/dev/null; done
  sleep 1
  for pid in $(lsof -ti tcp:"$PORTA" -sTCP:LISTEN 2>/dev/null); do kill -9 "$pid" 2>/dev/null; done
}
trap spegni EXIT INT TERM

# aspetta che risponda (max 90s: la prima compilazione è la più lenta)
for _ in $(seq 1 90); do
  if curl -s -o /dev/null -m 1 "$URL"; then break; fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    # Next non permette due dev server sulla stessa cartella: se ce n'è già uno
    # acceso per questo progetto, apriamo quello (ma solo se risponde davvero).
    ALTRA=$(grep -o "http://localhost:[0-9]*" "$LOG" 2>/dev/null | tail -1)
    if [ -n "$ALTRA" ] && curl -s -o /dev/null -m 2 "$ALTRA"; then
      open "$ALTRA"
      avvisa "CatalogFlow era già acceso: ho aperto $ALTRA"
      exit 0
    fi
    notifica "Il server non è partito. Apri il log per capire: $LOG" caution
    open -R "$LOG"
    exit 1
  fi
  sleep 1
done

open "$URL"

# Nessuna finestra da chiudere: un avviso che sparisce da solo e basta.
osascript -e 'display notification "Catalogo aperto nel browser. Per spegnere il server: click destro sull icona di CatalogFlow nel Dock, poi Esci." with title "CatalogFlow"' >/dev/null 2>&1

# L'app resta viva finché il server è acceso (nessun dialogo bloccante):
# per spegnere tutto basta uscire dall'app, dal menu del Dock o con ⌘Q.
wait "$SERVER_PID"

exit 0
