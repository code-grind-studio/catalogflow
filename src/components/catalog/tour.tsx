"use client";

import * as React from "react";
import {
  ArrowLeftRight, ArrowUpDown, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ExternalLink, Filter,
  Hash, History, Image as ImageIcon, Layers, LayoutGrid, LayoutList, ListChecks, MousePointer2,
  MousePointerClick, Pencil, RefreshCw, Save, Search, ShoppingBag, Trash2, UserMinus, UserPlus, Users, X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Tutorial guidato: mette in evidenza un'area per volta e spiega a cosa serve.
 * Accanto al pulsante "Tutorial" compare un avviso dopo ogni accesso dalla
 * schermata di login (stato nel cookie `catalogflow_tour`, vedi /api/app/tour).
 * Il tutorial NON si apre più da solo: si apre dal pulsante "Tutorial" o
 * cliccando l'avviso, e in entrambi i casi l'avviso si chiude.
 *
 * Gli ultimi passi usano i PRODOTTI DI ESEMPIO (id "demo-*", vedi
 * lib/catalog/demo.ts): appaiono solo qui dentro e l'API non li manda mai a
 * Shopify, quindi si possono mostrare modifica prodotto, modifica di gruppo e
 * selezione rapida senza toccare il catalogo vero.
 */

type Azione =
  | "accendiEsempi" // fa comparire la sezione con i prodotti finti
  | "selezionaEsempi" // spunta 3 prodotti finti -> compare la barra in basso
  | "apriModifica" // apre la scheda di modifica su un prodotto finto
  | "apriGruppo" // apre la modifica di gruppo sui 3 finti
  | "pulisci" // chiude le finestre e toglie la selezione
  | "vistaBrand" // passa alla vista "solo marchi"
  | "vistaProdotti"; // torna alla vista con i prodotti

interface Gesto {
  icona: LucideIcon;
  verbo: string;
  effetto: string;
}

interface Step {
  /** Selettore CSS dell'area da evidenziare. */
  target: string;
  title: string;
  text: string;
  /** Icona del passo, mostrata accanto al titolo. */
  icona: LucideIcon;
  /** I gesti da provare, come righe "icona + cosa fai -> cosa succede". */
  gesti?: Gesto[];
  /** Riga finale in tono minore: avvisi ed eccezioni. */
  nota?: string;
  /** Se l'area non è ancora nell'HTML (sezioni chiuse), il tutorial apre la prima sezione. */
  apriSezione?: boolean;
  /** Cosa prepara il tutorial prima di mostrare questo passo. */
  azione?: Azione;
  /** Passo dimostrativo: mostra il bollino "prodotti finti". */
  demo?: boolean;
}

const STEPS: Step[] = [
  {
    target: '[data-tour="filtri"]',
    icona: Search,
    title: "Cerca e filtra il catalogo",
    text: "Tutti i comandi per trovare un prodotto stanno in questa riga.",
    gesti: [
      { icona: Search, verbo: "Scrivi nella ricerca", effetto: "filtra mentre scrivi: nome, marchio, modello, tipo e tag" },
      { icona: Filter, verbo: "Menu accanto", effetto: "restringi a una categoria, a un marchio o a un modello" },
      { icona: CheckCircle2, verbo: "Menu Stato", effetto: "solo i pubblicati, oppure anche bozze e archiviati" },
      { icona: ArrowUpDown, verbo: "Menu Ordina", effetto: "per nome, categoria o prezzo: fa saltare all'occhio i valori sbagliati" },
    ],
    nota: "I menu si popolano con i tuoi dati: se una voce non ha senso per i tuoi prodotti, non la trovi.",
  },
  {
    target: 'select[aria-label="Per riga"]',
    icona: LayoutGrid,
    title: "Quante card per riga",
    text: "Due densità possibili: 10 o 12 prodotti per riga.",
    gesti: [
      { icona: LayoutGrid, verbo: "Passa a 10 per riga", effetto: "anteprime più grandi, comode per controllare le foto" },
      { icona: LayoutGrid, verbo: "Passa a 12 per riga", effetto: "vedi più prodotti insieme, per confrontare in fretta" },
    ],
  },
  {
    target: '[data-tour="vista"]',
    icona: LayoutGrid,
    azione: "vistaBrand",
    title: "Prima vista: solo i marchi",
    text: "Il pulsante accanto ai filtri cambia il modo di guardare il catalogo. Con \"Solo brand\" togli di mezzo i prodotti e resti con l'elenco dei marchi.",
    gesti: [
      { icona: LayoutGrid, verbo: "Click su \"Solo brand\"", effetto: "il catalogo diventa un elenco di marchi, senza anteprime" },
      { icona: MousePointerClick, verbo: "Click su un marchio", effetto: "vai dritto ai suoi prodotti, senza scorrere tutto" },
    ],
    nota: "Si usa quando il catalogo è lungo e sai già cosa stai cercando.",
  },
  {
    target: '[data-tour="vista"]',
    icona: LayoutList,
    azione: "vistaProdotti",
    title: "Seconda vista: i prodotti",
    text: "Lo stesso pulsante riporta alla vista normale, quella con le card dei prodotti.",
    gesti: [
      { icona: LayoutList, verbo: "Click su \"Vedi prodotti\"", effetto: "torni alla griglia con le anteprime" },
      { icona: LayoutGrid, verbo: "Filtri e raggruppamenti", effetto: "restano quelli che avevi impostato" },
    ],
    nota: "Le due viste sono lo stesso catalogo: cambia solo quanto scendi nel dettaglio.",
  },
  {
    target: '[title^="Ricarica il catalogo"]',
    icona: RefreshCw,
    title: "Sincronizza con lo store",
    text: "Rilegge i prodotti direttamente da Shopify, dove stanno i dati veri.",
    gesti: [
      { icona: RefreshCw, verbo: "Click sull'icona", effetto: "riallinea la pagina dopo una modifica fatta dall'app di Shopify o dal telefono" },
      { icona: Hash, verbo: "Numero accanto", effetto: "visibili / totali: quanti prodotti stai guardando adesso" },
    ],
    nota: "Se il catalogo è grande ci mette qualche secondo: la barra in alto mostra a che punto è.",
  },
  {
    target: '[title^="Collaboratori"]',
    icona: Users,
    title: "Il tuo accesso e i collaboratori",
    text: "In alto a destra c'è il tuo accesso: da qui decidi chi può usare il catalogo.",
    gesti: [
      { icona: MousePointerClick, verbo: "Click sul tuo nome", effetto: "apri la finestra degli accessi" },
      { icona: UserPlus, verbo: "Nuovo collaboratore", effetto: "un nome e una password: nessuna email, nessun account da creare" },
      { icona: UserMinus, verbo: "Revoca", effetto: "toglie l'accesso subito, anche a sessione aperta" },
    ],
    nota: "Per farlo usare a un'altra persona il programma deve girare su un indirizzo online: l'avviso è dentro quella finestra.",
  },
  {
    target: '[title^="Vedi chi ha modificato"]',
    icona: History,
    title: "Il log delle modifiche",
    text: "Ogni modifica viene registrata: chi, cosa, quando.",
    gesti: [
      { icona: MousePointerClick, verbo: "Click sul registro", effetto: "le modifiche raggruppate per sessione di lavoro" },
      { icona: ArrowLeftRight, verbo: "Prima / dopo", effetto: "per ogni campo, il valore di prima accanto a quello nuovo" },
    ],
    nota: "Serve a sapere chi ha cambiato qualcosa senza doverlo chiedere.",
  },
  {
    target: '[data-tour="brand"]',
    icona: Layers,
    title: "I gruppi di prodotti",
    text: "I prodotti sono raggruppati — di solito per marchio e poi per tipo — così arrivi a quello che cerchi senza scorrere tutto.",
    gesti: [
      { icona: ChevronDown, verbo: "Click sulla barra", effetto: "comprimi o riapri il gruppo" },
      { icona: Hash, verbo: "Numeri sulla barra", effetto: "quanti prodotti e quante varianti di modello ci sono dentro" },
    ],
    nota: "I raggruppamenti seguono i dati dei tuoi prodotti: se non usi i marchi, valgono comunque le altre suddivisioni.",
  },
  {
    target: '[data-tour="demo-card"]',
    icona: ImageIcon,
    demo: true,
    azione: "accendiEsempi",
    title: "La card: cosa contiene",
    text: "Anteprima, nome e prezzo. La barra colorata a sinistra segnala il gruppo del prodotto, il triangolo in alto a destra un prodotto non pubblicato.",
    gesti: [
      { icona: ImageIcon, verbo: "Anteprima", effetto: "la foto principale del prodotto" },
      { icona: ShoppingBag, verbo: "Nome e prezzo", effetto: "il click sul nome apre il prodotto sul sito, in un'altra scheda" },
      { icona: CheckCircle2, verbo: "Cerchietto", effetto: "il comando per selezionare il prodotto: sugli esempi resta sempre in vista" },
    ],
  },
  {
    target: '[data-tour="demo-card"] button[title^="Seleziona"]',
    icona: MousePointer2,
    demo: true,
    title: "La card: i tre click",
    text: "La stessa card fa tre cose diverse a seconda di dove clicchi: qui è evidenziato il cerchietto della selezione.",
    gesti: [
      { icona: ImageIcon, verbo: "Click sull'anteprima", effetto: "apri la scheda di modifica del prodotto" },
      { icona: ExternalLink, verbo: "Click sul nome", effetto: "apri il prodotto sul sito" },
      { icona: CheckCircle2, verbo: "Click sul cerchietto", effetto: "selezioni il prodotto per lavorare su più prodotti insieme" },
      { icona: MousePointer2, verbo: "Trascina sulle card", effetto: "selezioni tante card in una volta, senza cliccarle una per una" },
    ],
  },
  {
    target: '[data-tour="edit-dialog"]',
    icona: Pencil,
    demo: true,
    azione: "apriModifica",
    title: "Modifica di un prodotto",
    text: "Si apre cliccando l'anteprima del prodotto. Da qui cambi i dati del prodotto, il prezzo e lo stato; se i tuoi prodotti hanno taglie o varianti, c'è un editor dedicato che le rinomina, le riordina e le crea.",
    gesti: [
      { icona: Pencil, verbo: "Cambia un campo", effetto: "va su Shopify alla prima conferma: non c'è un \"salva tutto\" separato" },
      { icona: Save, verbo: "Salvataggio", effetto: "in basso a destra, con Annulla accanto" },
      { icona: Trash2, verbo: "Elimina prodotto", effetto: "in basso a sinistra, chiede sempre conferma" },
    ],
    nota: "Questa è una scheda di esempio: quello che cambi qui non esce dalla pagina.",
  },
  {
    target: '[data-tour="tray"]',
    icona: ListChecks,
    demo: true,
    azione: "selezionaEsempi",
    title: "Selezione rapida: la barra in basso",
    text: "Appena selezioni qualcosa compare una barra in fondo alla pagina: mostra quanti e quali prodotti hai preso, con le miniature. Per te ho selezionato 3 prodotti di esempio.",
    gesti: [
      { icona: MousePointer2, verbo: "Trascina sulle card", effetto: "selezioni tanti prodotti al volo" },
      { icona: ImageIcon, verbo: "Click su una miniatura", effetto: "torni a quel prodotto nella pagina" },
      { icona: X, verbo: "Pulisci", effetto: "azzera la selezione" },
    ],
  },
  {
    target: '[data-tour="select-all-btn"]',
    icona: ListChecks,
    demo: true,
    title: "Selezione rapida: tutta la lista in un colpo",
    text: "Quando devi lavorare su tanti prodotti non serve selezionarli uno per uno.",
    gesti: [
      { icona: ListChecks, verbo: "Seleziona tutti i filtrati", effetto: "prende in blocco tutto quello che i filtri hanno lasciato in vista" },
      { icona: Filter, verbo: "Filtra prima", effetto: "marchio, tipo o stato: così il blocco contiene solo quello che ti serve" },
      { icona: X, verbo: "Pulisci", effetto: "butta via tutto e riparti da zero" },
    ],
  },
  {
    target: '[data-tour="bulk-dialog"]',
    icona: ListChecks,
    demo: true,
    azione: "apriGruppo",
    title: "Modifica di gruppo",
    text: "L'ultimo passo: con più prodotti selezionati cambi in una volta sola i campi che hanno in comune — gruppo, marchio, tipo, stagioni e stato.",
    gesti: [
      { icona: Users, verbo: "Modifica di gruppo", effetto: "si apre dalla barra in basso, quando hai più prodotti selezionati" },
      { icona: Pencil, verbo: "Imposta un campo", effetto: "si applica a tutti i prodotti selezionati" },
      { icona: ListChecks, verbo: "Seleziona tutti i filtrati", effetto: "lavori su gruppi interi invece che un prodotto alla volta" },
    ],
    nota: "Restano fuori prezzo e taglie di proposito: su quelli un errore costa caro. Anche qui è tutto di esempio.",
  },
];

/* ---------------------------------------------------------------- esecuzione passi */

function trova(sel: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(sel);
}

/** Riprova ogni 120 ms finché l'elemento non c'è (o finiscono i tentativi). */
function quando(sel: string, fai: (el: HTMLElement) => void, tentativi = 25) {
  let n = 0;
  const tick = () => {
    const el = trova(sel);
    if (el) {
      fai(el);
      return;
    }
    if (++n < tentativi) window.setTimeout(tick, 120);
  };
  tick();
}

/** Segna/toglie la selezione cliccando i cerchietti delle card di esempio. */
function selezionaEsempi(quanti: number, deseleziona = false) {
  const card = document.querySelectorAll<HTMLElement>('[data-tour="demo-card"]');
  let fatti = 0;
  card.forEach((c) => {
    if (fatti >= quanti) return;
    const bottone = c.querySelector<HTMLButtonElement>('button[title^="Seleziona"]');
    if (!bottone) return;
    const attivo = bottone.getAttribute("aria-pressed") === "true";
    if (deseleziona ? attivo : !attivo) {
      bottone.click();
      fatti += 1;
    }
  });
}

/** Cambia la vista del catalogo: true = solo marchi, false = prodotti. */
function impostaVista(soloMarchi: boolean) {
  const b = document.querySelector<HTMLElement>('[data-tour="vista"]');
  if (!b) return;
  const inMarchi = (b.textContent ?? "").includes("Vedi prodotti");
  if (inMarchi !== soloMarchi) b.click();
}

function pulisci() {
  // prima chiude le finestre aperte (modifica prodotto / gruppo), poi toglie la
  // selezione: la barra in basso non esiste mentre una finestra è aperta.
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  window.setTimeout(() => {
    document.querySelector<HTMLElement>('[data-tour="tray"] button[title="Deseleziona tutto"]')?.click();
  }, 300);
}

function esegui(azione: Azione | undefined) {
  if (!azione) return;
  switch (azione) {
    case "accendiEsempi":
      window.dispatchEvent(new CustomEvent("catalogflow:esempi", { detail: { on: true } }));
      break;
    case "selezionaEsempi":
      // se è rimasta aperta la scheda di modifica, prima si chiude
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      window.setTimeout(() => {
        quando('[data-tour="demo-card"]', () => selezionaEsempi(3));
      }, 320);
      break;
    case "vistaBrand":
    case "vistaProdotti":
      quando('[data-tour="vista"]', () => impostaVista(azione === "vistaBrand"));
      break;
    case "apriModifica":
      // prima toglie la selezione (altrimenti il click sull'immagine seleziona
      // invece di aprire la scheda), poi apre la scheda del primo esempio
      {
        const t = trova('[data-tour="tray"] button[title="Deseleziona tutto"]');
        if (t) t.click();
        window.setTimeout(() => {
          quando('[data-tour="demo-card"]', (card) => {
            card.querySelector<HTMLButtonElement>('button[title="Modifica prodotto"]')?.click();
          });
        }, 260);
      }
      break;
    case "apriGruppo": {
      // chiude l'eventuale scheda aperta, riseleziona i 3 esempi e apre la modifica di gruppo
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      window.setTimeout(() => {
        quando('[data-tour="demo-card"]', () => {
          selezionaEsempi(3);
          window.setTimeout(() => quando('[data-tour="bulk-edit-btn"]', (b) => b.click()), 400);
        });
      }, 420);
      break;
    }
    case "pulisci":
      pulisci();
      break;
  }
}

/* ---------------------------------------------------------------- componente */

export function TourHost() {
  const [open, setOpen] = React.useState(false);
  const [index, setIndex] = React.useState(0);
  const [rect, setRect] = React.useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [hover, setHover] = React.useState(false);
  const [vw, setVw] = React.useState(1280);
  const [vh, setVh] = React.useState(800);
  const finestraApertaRef = React.useRef(false);

  const step = STEPS[index];
  const ultimo = index === STEPS.length - 1;

  /* ---------------- apertura: solo su richiesta (pulsante o avviso) ---------------- */
  React.useEffect(() => {
    const onRichiesta = () => {
      setIndex(0);
      setOpen(true);
    };
    window.addEventListener("catalogflow:tour", onRichiesta);
    return () => window.removeEventListener("catalogflow:tour", onRichiesta);
  }, []);

  /* ---------------- misure della finestra ---------------- */
  React.useEffect(() => {
    const aggiorna = () => {
      setVw(window.innerWidth);
      setVh(window.innerHeight);
    };
    aggiorna();
    window.addEventListener("resize", aggiorna);
    return () => window.removeEventListener("resize", aggiorna);
  }, []);

  /* ---------------- esecuzione dell'azione del passo ---------------- */
  React.useEffect(() => {
    if (!open) return;
    finestraApertaRef.current = ["apriModifica", "apriGruppo"].includes(step.azione ?? "");
    esegui(step.azione);
  }, [open, step]);

  /* ---------------- misura dell'area evidenziata ---------------- */
  const tentativiRef = React.useRef(0);
  const apertoRef = React.useRef(false);
  React.useEffect(() => {
    if (!open) return;
    tentativiRef.current = 0;
    apertoRef.current = false;
    const misura = () => {
      const el = document.querySelector(step.target);
      if (!el) {
        // le sezioni dei prodotti partono chiuse e si montano solo avvicinandosi
        // (lazy): se l'area non c'è, il tutorial apre la prima sezione e riscende.
        setRect(null);
        if (step.apriSezione && !apertoRef.current) {
          apertoRef.current = true;
          (document.querySelector('[data-tour="brand"]') as HTMLElement | null)?.click();
          return;
        }
        if (tentativiRef.current < 20) {
          tentativiRef.current += 1;
          window.scrollBy({ top: 500, behavior: "auto" });
        }
        return;
      }
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        return; // rimisuriamo al prossimo giro, dopo lo scroll
      }
      setRect({ x: r.x, y: r.y, w: r.width, h: r.height });
    };
    misura();
    const id = window.setInterval(misura, 350); // il layout si assesta (immagini, lazy section)
    window.addEventListener("resize", misura);
    window.addEventListener("scroll", misura, true);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", misura);
      window.removeEventListener("scroll", misura, true);
    };
  }, [open, step]);

  /* ---------------- hover sull'area evidenziata ---------------- */
  React.useEffect(() => {
    if (!open || !rect) return;
    const onMove = (e: MouseEvent) => {
      const p = 10;
      setHover(
        e.clientX >= rect.x - p && e.clientX <= rect.x + rect.w + p && e.clientY >= rect.y - p && e.clientY <= rect.y + rect.h + p
      );
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [open, rect]);

  /* ---------------- chiusura ---------------- */
  const chiudi = React.useCallback(() => {
    pulisci();
    window.dispatchEvent(new CustomEvent("catalogflow:esempi", { detail: { on: false } }));
    setOpen(false);
  }, []);

  const avanti = React.useCallback(() => (ultimo ? chiudi() : setIndex((i) => i + 1)), [ultimo, chiudi]);
  const indietro = () => setIndex((i) => Math.max(0, i - 1));

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // con una finestra di esempio aperta, Esc la chiude e non il tutorial
      if (e.key === "Escape" && finestraApertaRef.current) return;
      if (e.key === "ArrowRight" || e.key === "Enter") avanti();
      else if (e.key === "ArrowLeft") indietro();
      else if (e.key === "Escape") chiudi();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, avanti, chiudi]);

  if (!open) return null;

  const progresso = ((index + 1) / STEPS.length) * 100;

  /* ---- posizione del riquadro: sfrutta lo spazio libero (sotto, sopra o di lato) ---- */
  const PAD = 8;
  const MARGINE = 16;
  const larghezza = Math.min(vw > 1500 ? 620 : 560, vw - 32);
  const altezzaStimata = 340;

  let left: number;
  let top: number;

  if (!rect) {
    left = (vw - larghezza) / 2;
    top = vh / 2 - 140;
  } else {
    const spazioSotto = vh - (rect.y + rect.h);
    const spazioDestra = vw - (rect.x + rect.w);
    const spazioSinistra = rect.x;
    const diLato = spazioDestra > larghezza + 24 || spazioSinistra > larghezza + 24;

    const areaGrande = rect.h > vh * 0.6 || (rect.w > vw * 0.55 && rect.h > vh * 0.3);

    if (areaGrande) {
      // area grande (una finestra di modifica): riquadro nell'angolo in basso a
      // sinistra, così restano visibili titolo, campi e pulsanti di salvataggio
      left = MARGINE;
      top = Math.max(MARGINE, vh - altezzaStimata - MARGINE);
    } else if (diLato) {
      const aDestra = spazioDestra >= spazioSinistra;
      left = aDestra
        ? Math.min(rect.x + rect.w + MARGINE, vw - larghezza - MARGINE)
        : Math.max(MARGINE, rect.x - larghezza - MARGINE);
      top = Math.min(Math.max(MARGINE, rect.y + rect.h / 2 - altezzaStimata / 2), Math.max(MARGINE, vh - altezzaStimata - MARGINE));
    } else {
      const sotto = spazioSotto >= altezzaStimata + MARGINE;
      left = Math.min(Math.max(MARGINE, rect.x + rect.w / 2 - larghezza / 2), Math.max(MARGINE, vw - larghezza - MARGINE));
      top = sotto
        ? Math.min(rect.y + rect.h + PAD + 14, vh - altezzaStimata - MARGINE)
        : Math.max(MARGINE, rect.y - altezzaStimata - MARGINE + PAD);
    }
  }


  return (
    <>
      {/* area evidenziata: bordo luminoso + alone scuro su tutto il resto */}
      {rect ? (
        <div
          className={cn(
            "pointer-events-none fixed z-[70] border-2 transition-all duration-200",
            hover ? "border-white" : "border-white/70"
          )}
          style={{
            left: rect.x - PAD,
            top: rect.y - PAD,
            width: rect.w + PAD * 2,
            height: rect.h + PAD * 2,
            boxShadow: "0 0 0 9999px rgba(9, 9, 11, 0.72)",
          }}
        >
          <span className="animate-tour-pulse absolute inset-0 border border-white/70" />
        </div>
      ) : (
        <div className="fixed inset-0 z-[70] bg-neutral-950/80" />
      )}

      {/* riquadro con la spiegazione */}
      <div
        className="animate-tour-in fixed z-[71] overflow-hidden border border-border bg-background shadow-2xl"
        style={{ left, top, width: larghezza }}
        role="dialog"
        aria-label={`Tutorial, passo ${index + 1} di ${STEPS.length}`}
      >
        {/* barra di avanzamento: quanto manca alla fine */}
        <div className="h-0.5 w-full bg-border/60">
          <div className="h-full bg-foreground transition-[width] duration-300" style={{ width: `${progresso}%` }} />
        </div>
        <div className="relative p-5">
          <div className="flex items-start gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                  <step.icona className="size-3" />
                  Passo {index + 1} di {STEPS.length}
                </span>
                {step.demo && (
                  <span className="text-[11px] text-muted-foreground">prodotti di esempio</span>
                )}
              </div>
              <h2 className="mt-1.5 text-lg leading-snug font-semibold">{step.title}</h2>
            </div>
            <button
              onClick={chiudi}
              className="ml-auto shrink-0 text-muted-foreground hover:text-foreground"
              title="Chiudi il tutorial"
              aria-label="Chiudi il tutorial"
            >
              <X className="size-4" />
            </button>
          </div>

          <p className="mt-2.5 text-[13px] leading-relaxed text-muted-foreground">{step.text}</p>

          {step.gesti && step.gesti.length > 0 && (
            <div className="mt-4 border-t border-border">
              {step.gesti.map((g) => (
                <div key={g.verbo} className="grid grid-cols-[18px_142px_1fr] items-center gap-3 border-b border-border py-2">
                  <g.icona className="size-3.5 text-muted-foreground" />
                  <span className="text-[12.5px] leading-snug font-medium">{g.verbo}</span>
                  <span className="text-[12.5px] leading-snug text-muted-foreground">{g.effetto}</span>
                </div>
              ))}
            </div>
          )}

          {step.nota && <p className="mt-3 text-[11.5px] leading-relaxed text-muted-foreground/80">{step.nota}</p>}

          <div className="mt-4 flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={indietro}
              disabled={index === 0}
              className="h-7 rounded-none px-2 text-[11px]"
            >
              <ChevronLeft className="size-3" />
              Indietro
            </Button>
            <Button size="sm" onClick={avanti} className="h-7 rounded-none px-3 text-[11px]">
              {ultimo ? "Fine" : "Avanti"}
              {!ultimo && <ChevronRight className="size-3" />}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
