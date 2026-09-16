@echo off
REM ---------------------------------------------------------------
REM  CatalogFlow - avvio con doppio click su Windows
REM  Prima volta: installa le dipendenze (serve Node.js 20+)
REM ---------------------------------------------------------------
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo.
  echo [!] Node.js non risulta installato.
  echo     Installalo da https://nodejs.org (versione LTS) oppure con:
  echo       winget install OpenJS.NodeJS.LTS
  echo     Poi chiudi questa finestra e riprova.
  echo.
  pause
  exit /b 1
)

if not exist ".env.local" (
  echo.
  echo [!] Manca il file .env.local
  echo     1^) copia .env.example in .env.local
  echo     2^) aprilo con Blocco note e riempi i valori
  echo        ^(vedi docs\SHOPIFY-SETUP.it.md per le credenziali Shopify^)
  echo.
  choice /c SN /m "Vuoi che lo copi io adesso"
  if errorlevel 2 exit /b 1
  copy /y ".env.example" ".env.local" >nul
  echo     Copiato. Aprilo con:  notepad .env.local
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Prima volta: installo le dipendenze, ci vuole un minuto...
  call npm install
  if errorlevel 1 (
    echo [!] npm install non e' riuscito. Controlla i messaggi sopra.
    pause
    exit /b 1
  )
)

echo.
echo Avvio CatalogFlow su http://localhost:3000 ...
start "" http://localhost:3000
call npm run dev
pause
