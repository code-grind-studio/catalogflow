# Changelog

Tutte le modifiche rilevanti a questo progetto sono documentate qui.
Il formato segue [Keep a Changelog](https://keepachangelog.com/it/1.0.0/),
il versionamento segue [Semantic Versioning](https://semver.org/lang/it/).

## [Unreleased]

## [1.0.0] - 2026-09-16

### Aggiunto
- Prima release pubblica open source (MIT).
- Catalogo prodotti sincronizzato con Shopify (lettura + modifica bulk).
- Autenticazione a password condivisa multi-utente (admin + soci), via env var.
- Deploy Docker (`Dockerfile` + `docker-compose.yml`) oltre al deploy Vercel.
- Vista Gruppi con suggerimenti automatici di raggruppamento prodotti.
- Log attività e barra di avanzamento import in tempo reale.
- Guida di configurazione dell'app Shopify con screenshot, in tre lingue
  (`docs/SHOPIFY-SETUP.md`, `.it.md`, `.fr.md`).
- README in inglese, italiano e francese, e `.env.example` documentato.

### Modificato
- Autenticazione Shopify: **client credentials grant** (Client ID + Secret del Dev
  Dashboard) con token da 24 h rinnovato automaticamente, al posto del token statico
  `shpat_`. Il flusso "custom app → copia il token" non è più disponibile in Shopify:
  le app si creano nel Dev Dashboard e vanno installate sullo store una volta
  (senza installazione Shopify risponde `400 Oauth error app_not_installed`).
