# Changelog

Tutte le modifiche rilevanti a questo progetto sono documentate qui.
Una riga per modifica; il formato segue [Keep a Changelog](https://keepachangelog.com/it/1.0.0/),
il versionamento segue [Semantic Versioning](https://semver.org/lang/it/).

## [Unreleased]

### Aggiunto
- Collaboratori creati dall'interfaccia (nome + password), salvati in Redis o nel file locale.
- Dialog "Collaboratori" cliccando il proprio nome in alto a destra, con avviso che per condividere il tool serve un host online.
- Intestazione "Catalogo · <store collegato>", presa dallo store Shopify configurato.
- Marchio CatalogFlow / by Code Grind Studio animato durante il caricamento del catalogo.
- Link "Changelog" e screenshot reale del catalogo nei README (EN/IT/FR).
- App per macOS con icona (`scripts/mac/crea-app.command`): doppio click, avvia il server e apre il browser.
- Collegamento sul Desktop su Windows con icona (`Crea collegamento sul Desktop.bat`).
- Icona dell'app (shopping bag) in SVG/PNG/ICNS/ICO in `assets/icon/`.
- Avvio: barra a una sola passata, conteggio dei prodotti in tempo reale e marchio animato.
- Tutorial guidato in sovrimpressione: non si apre più da solo, saltabile e riapribile dal pulsante in alto a destra.
- Prodotti di esempio finti nel tutorial (id `demo-*`), per mostrare selezione rapida, modifica prodotto e modifica di gruppo senza toccare il catalogo reale.
- Avviso accanto al pulsante "Tutorial" dopo ogni accesso dalla schermata di login, con stato in un cookie riscritto dal login (`/api/app/tour`): una volta per accesso, non a ogni ricarica né a ogni accensione del server.

### Sicurezza
- Scritture protette da CSRF: le richieste che modificano qualcosa (creare o revocare collaboratori, cambiare o cancellare prodotti) sono accettate solo se arrivano dal catalogo stesso (controllo su `Origin`/`Host`, `Sec-Fetch-Site` come rete di sicurezza) e con corpo JSON. In più, chi presenta la sessione deve dichiarare da dove viene (`Origin` oppure `Sec-Fetch-Site`): una scrittura senza provenienza viene rifiutata, mentre l'accesso (che non ha ancora sessione) resta apribile da script. Prima una pagina estranea poteva far partire queste richieste dal browser dell'utente.
- Header di sicurezza su ogni risposta: `frame-ancestors` (CSP) limita l'incorporamento in iframe a PersonalOS — allargabile senza toccare il codice con la variabile d'ambiente `FRAME_ANCESTORS` — più `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`, `Permissions-Policy` e niente intestazione `X-Powered-By`.
- Dopo il login si può atterrare solo su percorsi interni: il parametro `next` di un link estraneo (`https://…`, `//…`, `/\…`) non porta più fuori dal catalogo.
- Un nome di collaboratore che ripulirebbe allo stesso id di un accesso esistente (amministratore compreso, es. "Admin" con admin chiamato `admin`) viene rifiutato: un collaboratore non può più nascere con l'identità dell'admin.
- Freno ai tentativi di password: dopo 10 errori dallo stesso indirizzo l'accesso resta in attesa 15 minuti (429 con tempo di attesa), ogni tentativo sbagliato finisce nel log attività; un accesso riuscito azzera il conteggio. Vive nello storage condiviso quando c'è, altrimenti nella memoria del processo.
- Il logout revoca davvero la sessione: il cookie di sessione porta un'epoca (`<utente>.<epoca>.<firma>`) e il logout la incrementa, così il cookie — anche se copiato altrove — smette di funzionare su API e pagine. Richiede lo storage condiviso: senza, l'epoca resta 0 e il logout resta solo locale (nessun blocco, solo nessuna revoca).

### Modificato
- Tutorial ripulito: un solo passo per ricerca e filtri, titoli più chiari, pannello più grande con barra di avanzamento e scorciatoie da tastiera; rimossi il passo introduttivo e quello finale.
- Tutorial: il pannello si posiziona dove c'è spazio libero (accanto all'area, o nell'angolo in basso quando l'area è una finestra grande).
- Sessione senza scadenza: niente più rientro ogni 30 minuti, si resta dentro finché l'accesso non viene revocato.
- Titolo "Catalogo · <store collegato>" anche nella pagina di login.
- README: testata centrata con badge, link rapidi e screenshot hero.
- Guide Shopify (EN/IT/FR): testata centrata con link di ritorno al README.
- Il nome utente in alto a destra è ora un pulsante, non più una scritta statica.

### Corretto
- Il login accetta anche le password dei collaboratori creati dalla UI, oltre a quelle nelle env var.
- App macOS: il launcher sceglie sempre un Node arm64, per non finire sotto Rosetta (errore `lightningcss.darwin-x64.node`).
- Chiusura dell'app macOS: viene spento anche il processo `next dev` figlio di `npm`.
- App macOS: niente più finestra modale all'avvio (solo una notifica che sparisce).
- Rimosso l'indicatore fluttuante del dev tools in basso a sinistra (`devIndicators: false`).
- Un accesso revocato perde effetto immediato, anche con la sessione già aperta.

## [1.0.0] - 2026-09-16

### Aggiunto
- Prima release pubblica open source (MIT).
- Catalogo prodotti Shopify in un'unica tabella, con ricerca, filtri e modifica in blocco.
- Taglie e varianti: creazione, rinomina, riordino ed eliminazione per prodotto.
- Immagini prodotto: riordino ed eliminazione da Shopify.
- Metafield `custom.fornitore_url`, `custom.modello`, `custom.gruppo` in lettura e scrittura.
- Vista Gruppi con suggerimenti automatici di raggruppamento.
- Log attività con chi ha fatto cosa, per sessione, e barra di avanzamento dell'import.
- Accesso multi-utente a sola password (fino a 10 utenti in env var), senza email né database.
- Guida di configurazione dell'app Shopify con screenshot, in inglese, italiano e francese.
- README in inglese, italiano e francese, più `.env.example` documentato.
- Avvio con doppio click su macOS e Windows (`Avvia CatalogFlow.command` / `.bat`).
- Docker (`Dockerfile` + `docker-compose.yml`) e deploy su Vercel.

### Corretto
- Autenticazione Shopify con `client credentials grant`: il token da 24 h si rinnova da solo, niente `shpat_` statico da copiare.
- Deploy su Vercel: `output: "standalone"` solo fuori da Vercel, per non rompere il build remoto.
