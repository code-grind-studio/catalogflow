#!/bin/bash
# ---------------------------------------------------------------------------
# Crea CatalogFlow.app: un'app vera (icona + nome) da mettere sul Desktop, nel
# Launchpad o nel Dock, che avvia il catalogo con un doppio click.
#
# Uso:
#   doppio click su questo file            -> crea l'app nella cartella del progetto
#   ./scripts/mac/crea-app.command --desktop -> la crea anche sul Desktop
# ---------------------------------------------------------------------------
set -euo pipefail

PROGETTO="$(cd "$(dirname "$0")/../.." && pwd)"
DESTINAZIONE="$PROGETTO"
[ "${1:-}" = "--desktop" ] && DESTINAZIONE="$HOME/Desktop"

APP="$DESTINAZIONE/CatalogFlow.app"
ICONA="$PROGETTO/assets/icon/CatalogFlow.icns"
LAUNCHER="$PROGETTO/scripts/mac/CatalogFlow-launcher.sh"

echo "CatalogFlow — creazione app per macOS"
echo "  progetto : $PROGETTO"
echo "  app      : $APP"

if [ ! -f "$ICONA" ]; then
  echo "[!] Manca l'icona: $ICONA"
  echo "    Rigenerala con:  python3 scripts/mac/genera-icone.py"
  exit 1
fi

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$ICONA" "$APP/Contents/Resources/CatalogFlow.icns"

cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleName</key>
	<string>CatalogFlow</string>
	<key>CFBundleDisplayName</key>
	<string>CatalogFlow</string>
	<key>CFBundleExecutable</key>
	<string>CatalogFlow</string>
	<key>CFBundleIconFile</key>
	<string>CatalogFlow</string>
	<key>CFBundleIdentifier</key>
	<string>studio.codegrind.catalogflow</string>
	<key>CFBundleInfoDictionaryVersion</key>
	<string>6.0</string>
	<key>CFBundlePackageType</key>
	<string>APPL</string>
	<key>CFBundleShortVersionString</key>
	<string>1.1.0</string>
	<key>CFBundleVersion</key>
	<string>1.1.0</string>
	<key>LSMinimumSystemVersion</key>
	<string>11.0</string>
	<key>NSHighResolutionCapable</key>
	<true/>
	<key>LSUIElement</key>
	<false/>
</dict>
</plist>
PLIST

# il percorso del progetto viene "cotto" dentro l'app: è l'unica cosa che
# l'app deve sapere per avviare il catalogo.
sed "s|__PROGETTO__|$PROGETTO|g" "$LAUNCHER" > "$APP/Contents/MacOS/CatalogFlow"
chmod +x "$APP/Contents/MacOS/CatalogFlow"

# fa ricaricare a Finder l'icona appena creata
touch "$APP"
/usr/bin/plutil -lint "$APP/Contents/Info.plist" >/dev/null && echo "  Info.plist: valido"

echo "Fatto. Apri il catalogo con un doppio click su: $APP"
[ "$DESTINAZIONE" != "$PROGETTO" ] && echo "Per tenerla nel Dock: trascina l'app dal Desktop sul Dock."
