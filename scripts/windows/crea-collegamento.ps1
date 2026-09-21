# ---------------------------------------------------------------------------
#  Crea il collegamento "CatalogFlow" sul Desktop di Windows, con l'icona
#  dell'app. Va eseguito una volta sola (doppio click su
#  "Crea collegamento sul Desktop.bat", oppure da PowerShell:
#     powershell -ExecutionPolicy Bypass -File scripts\windows\crea-collegamento.ps1)
# ---------------------------------------------------------------------------
$ErrorActionPreference = "Stop"

# cartella del progetto = due livelli sopra questo script
$progetto = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$destinazione = Join-Path $progetto "Avvia CatalogFlow.bat"
$icona = Join-Path $progetto "assets\icon\CatalogFlow.ico"

if (-not (Test-Path $destinazione)) {
    Write-Host "[!] Non trovo 'Avvia CatalogFlow.bat' in $progetto" -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $icona)) {
    Write-Host "[!] Non trovo l'icona $icona" -ForegroundColor Red
    exit 1
}

$desktop = [Environment]::GetFolderPath("Desktop")
$lnk = Join-Path $desktop "CatalogFlow.lnk"

$shell = New-Object -ComObject WScript.Shell
$collegamento = $shell.CreateShortcut($lnk)
$collegamento.TargetPath = $destinazione
$collegamento.WorkingDirectory = $progetto
$collegamento.IconLocation = "$icona,0"
$collegamento.Description = "CatalogFlow - gestione catalogo Shopify"
$collegamento.WindowStyle = 1
$collegamento.Save()

Write-Host "Fatto: collegamento creato in $lnk" -ForegroundColor Green
Write-Host "Trascinalo dove vuoi (Desktop, barra delle applicazioni) o pinnato su Start."
