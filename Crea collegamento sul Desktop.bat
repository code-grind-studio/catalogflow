@echo off
REM ---------------------------------------------------------------------------
REM  Crea il collegamento "CatalogFlow" sul Desktop di Windows (icona inclusa).
REM  Doppio click su questo file: basta una volta sola.
REM ---------------------------------------------------------------------------
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\crea-collegamento.ps1"
if errorlevel 1 (
  echo.
  echo [!] Non sono riuscito a creare il collegamento. Copia qui sotto il messaggio.
)
pause
