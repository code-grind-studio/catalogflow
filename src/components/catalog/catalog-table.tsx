"use client";

import * as React from "react";
import {
  RefreshCw, Search, X, Loader2, AlertTriangle, ChevronDown, ChevronRight,
  LayoutGrid, LayoutList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { CatalogProduct, Facets } from "@/lib/catalog/catalog";
import type { SuggestedGroup } from "@/lib/catalog/groups";
import { DEMO_BRAND, DEMO_PRODUCTS } from "@/lib/catalog/demo";
import { SENZA_CATEGORIA } from "@/lib/catalog/taxonomy";
import { EditProductDialog, DeleteProductDialog, BulkEditDialog } from "./product-dialogs";
import { ProductCard } from "./product-card";
import { SelectionTray } from "./selection-tray";
import { LazySection } from "./lazy-section";
import { TourHost } from "./tour";

/* ------------------------------------------------------------------- tipi */

type SortKey = "title" | "brand" | "tipo" | "price" | "id";

interface CatalogResponse {
  ok: boolean;
  count: number;
  generatedAt: string;
  products: CatalogProduct[];
  facets: Facets;
  suggestions?: SuggestedGroup[];
  error?: string;
}

/* -------------------------------------------------------------- helpers */

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Lettera iniziale per l'indice alfabetico rapido. */
function initialOf(brand: string): string {
  const c = brand.trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : "#";
}

/** Quanti modelli distinti (non vuoti) ci sono in un elenco di prodotti. */
function countModelli(items: CatalogProduct[]): number {
  return new Set(items.map((p) => p.modello).filter((m): m is string => !!m)).size;
}

/** " · 3 modelli" accanto al numero di prodotti. Niente output se il brand non ha modelli. */
function ModelliCount({ items }: { items: CatalogProduct[] }) {
  const n = countModelli(items);
  if (n === 0) return null;
  return <> · {n} modell{n === 1 ? "o" : "i"}</>;
}

/* ==================================================================== UI */

/**
 * Avvio: durata minima della schermata col marchio. La barra completa la sua
 * unica passata in questo tempo (o più, se il catalogo ci mette di più) e il
 * contatore dei prodotti avanza con lei.
 */
const STARTUP_MIN_MS = 2000;

export function CatalogView() {
  const [data, setData] = React.useState<CatalogResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState<{ loaded: number; estimatedTotal: number } | null>(null);
  /** Avvio: percentuale della barra (monotona: va solo avanti) e fine schermata. */
  const [barPct, setBarPct] = React.useState(0);
  /** Prodotti "scorsi" finora nell'animazione (0 → totale). */
  const [prodotti, setProdotti] = React.useState(0);
  const [startupDone, setStartupDone] = React.useState(false);
  /** Istante d'avvio: riempito nell'effetto, non durante il render (niente Date.now() nel render). */
  const startupRef = React.useRef({ start: 0 });

  React.useEffect(() => {
    startupRef.current = { start: Date.now() };
  }, []);

  const [query, setQuery] = React.useState("");
  const [brandFilter, setBrandFilter] = React.useState("");
  const [modelloFilter, setModelloFilter] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("ACTIVE");
  const [soloSenzaTipo, setSoloSenzaTipo] = React.useState(false);

  const [sortKey, setSortKey] = React.useState<SortKey>("title");
  const [sortAsc, setSortAsc] = React.useState(true);

  const [editing, setEditing] = React.useState<CatalogProduct | null>(null);
  const [deleting, setDeleting] = React.useState<CatalogProduct | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const [bulkPresetProducts, setBulkPresetProducts] = React.useState<CatalogProduct[] | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);
  const [cols, setCols] = React.useState<number>(10);

  /** Sezioni brand chiuse (il resto è aperto di default). */
  const [collapsedBrands, setCollapsedBrands] = React.useState<Set<string>>(new Set());
  /** true finché non abbiamo ancora applicato "tutte chiuse" al primo caricamento. */
  const collapsedInitialized = React.useRef(false);

  /** true = vista indice (solo riquadri con i nomi brand, niente prodotti). */
  const [brandGridView, setBrandGridView] = React.useState(false);

  /** Sezioni da montare forzatamente (quando si salta a un prodotto al loro interno). */
  const [forcedBrands, setForcedBrands] = React.useState<Set<string>>(new Set());

  /** Larghezza viewport: serve per stimare l'altezza delle sezioni non ancora montate. */
  const [viewportW, setViewportW] = React.useState(1600);
  React.useEffect(() => {
    const onResize = () => setViewportW(window.innerWidth);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /**
   * Avvio: barra e contatore sono UNA cosa sola, sempre in sincrono.
   *  - finché non sappiamo quanto manca, la barra avanza lentamente (non arriva mai a fondo);
   *  - quando il caricamento è in corso, barra e numero seguono il progresso reale;
   *  - quando è finito, la passata completa fino al bordo destro in almeno 2s;
   *  - a barra piena (e durata minima passata) si passa al catalogo.
   */
  React.useEffect(() => {
    const id = setInterval(() => {
      const elapsed = Date.now() - startupRef.current.start;

      const total = progress?.estimatedTotal || data?.products.length || 0;
      const loaded = progress?.loaded ?? 0;
      const inCorso = !!progress && progress.estimatedTotal > 0 && loaded < progress.estimatedTotal;

      let pct: number;
      if (inCorso && total > 0) {
        pct = (loaded / total) * 100; // progresso reale
      } else if (loading) {
        pct = Math.min(30, (elapsed / 1000) * 15); // non sappiamo ancora: avanzo lento
      } else {
        pct = (elapsed / STARTUP_MIN_MS) * 100; // caricamento finito: passata finale
      }
      pct = Math.min(99, Math.max(pct, barPct)); // mai indietro; 100 solo alla fine
      setBarPct(pct);

      // numero agganciato alla barra: scorre con lei, in tempo reale
      if (total > 0) setProdotti(Math.round((total * pct) / 100));

      if (!loading && elapsed >= STARTUP_MIN_MS) {
        if (barPct < 100) {
          setBarPct(100);
          setProdotti(total);
          return;
        }
        setStartupDone(true);
      }
    }, 100);
    return () => clearInterval(id);
  }, [barPct, data, loading, progress]);

  /**
   * Altezza stimata di una sezione (per i placeholder delle sezioni non ancora
   * montate). Se la stima è bassa la pagina "cresce" durante lo scroll; la
   * calcoliamo dalla larghezza reale della card alle colonne attive.
   */
  const estimateSectionHeight = (itemCount: number, columnCount: number) => {
    const containerW = Math.min(viewportW, 1800) - 48; // padding della pagina
    const gaps = (columnCount - 1) * 12;
    const cardW = Math.max(80, (containerW - gaps) / columnCount);
    const cardH = cardW + 95; // immagine quadrata + corpo testuale
    const rows = Math.ceil(itemCount / columnCount);
    return rows * cardH + Math.max(0, rows - 1) * 12 + 44; // + intestazione sezione
  };

  // ricorda la preferenza di densità tra una visita e l'altra
  React.useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("sd_cols") : null;
    const n = Number(saved);
    // solo le due densità previste: 10 o 12 per riga
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (n === 10 || n === 12) setCols(n);
  }, []);
  React.useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem("sd_cols", String(cols));
  }, [cols]);

  // classi statiche (Tailwind non genera classi dinamiche a runtime)
  const COLS_CLASS: Record<number, string> = {
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-3 lg:grid-cols-4",
    5: "grid-cols-3 lg:grid-cols-5",
    6: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6",
    8: "grid-cols-4 lg:grid-cols-8",
    10: "grid-cols-5 lg:grid-cols-10",
    12: "grid-cols-6 lg:grid-cols-12",
  };

  // stesso "per riga" applicato alla vista Solo brand: i riquadri sono più
  // larghi delle card prodotto, quindi con meno colonne a parità di N.
  const BRAND_GRID_COLS_CLASS: Record<number, string> = {
    6: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6",
    8: "grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8",
    10: "grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-10",
    12: "grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12",
  };

  /* ------------------------------------------------------------- fetch */

  const load = React.useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/catalog/products?suggest=1${refresh ? "&refresh=1" : ""}`);
      const json = (await res.json()) as CatalogResponse;
      if (!json.ok) throw new Error(json.error ?? "errore sconosciuto");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    void load(false);
  }, [load, reloadKey]);

  /** Polling del progresso di caricamento: attivo solo mentre siamo in loading/refreshing.
   *  Non serve "spegnere" progress a fine caricamento: è mostrato solo quando loading=true. */
  React.useEffect(() => {
    if (!loading && !refreshing) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await fetch("/api/catalog/products/progress");
        const j = (await r.json()) as { ok: boolean; active: boolean; loaded: number; estimatedTotal: number };
        if (!cancelled && j.ok) setProgress({ loaded: j.loaded, estimatedTotal: j.estimatedTotal });
      } catch {
        /* la barra resta com'era; non è critico */
      }
    };
    void tick();
    const id = setInterval(tick, 700);
    return () => { cancelled = true; clearInterval(id); };
  }, [loading, refreshing]);

  /* ------------------------------------------------------------ filtri */

  /* Prodotti di esempio del tutorial: compaiono solo mentre gira il tutorial
     (evento "catalogflow:esempi") e non vengono mai inviati a Shopify. */
  const [showDemo, setShowDemo] = React.useState(false);
  React.useEffect(() => {
    const onEsempi = (e: Event) => setShowDemo(Boolean((e as CustomEvent<{ on?: boolean }>).detail?.on));
    window.addEventListener("catalogflow:esempi", onEsempi);
    return () => window.removeEventListener("catalogflow:esempi", onEsempi);
  }, []);

  const products = React.useMemo(
    () => (showDemo ? [...DEMO_PRODUCTS, ...(data?.products ?? [])] : (data?.products ?? [])),
    [showDemo, data]
  );

  /** Modelli disponibili: dipendono dal BRAND scelto (categoria = brand, sottocategoria = modello). */
  const modelOptions = React.useMemo(() => {
    if (!brandFilter) return [];
    const merged = new Map<string, number>();
    for (const p of products) {
      if (!p.brands.includes(brandFilter) || !p.modello) continue;
      merged.set(p.modello, (merged.get(p.modello) ?? 0) + 1);
    }
    return [...merged.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => a.value.localeCompare(b.value, "it", { sensitivity: "base" }));
  }, [brandFilter, products]);

  const filtered = React.useMemo(() => {
    const q = normalize(query.trim());
    let out = products;

    if (brandFilter) out = out.filter((p) => p.brands.includes(brandFilter));
    if (modelloFilter) out = out.filter((p) => p.modello === modelloFilter);
    if (statusFilter) out = out.filter((p) => p.status === statusFilter);
    if (soloSenzaTipo) out = out.filter((p) => p.categoria === SENZA_CATEGORIA);
    if (q) {
      out = out.filter((p) =>
        normalize([p.title, p.brands.join(" "), p.categoria, p.modello ?? "", ...p.tags].join(" ")).includes(q)
      );
    }

    const dir = sortAsc ? 1 : -1;
    return [...out].sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";
      switch (sortKey) {
        case "title": av = normalize(a.title); bv = normalize(b.title); break;
        case "brand": av = normalize(a.brand ?? "zzz"); bv = normalize(b.brand ?? "zzz"); break;
        case "tipo": av = normalize(a.categoria); bv = normalize(b.categoria); break;
        case "price": av = parseFloat(a.priceMin ?? "0"); bv = parseFloat(b.priceMin ?? "0"); break;
        case "id": av = Number(a.numericId); bv = Number(b.numericId); break;
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [products, query, brandFilter, modelloFilter, statusFilter, soloSenzaTipo, sortKey, sortAsc]);

  /** Raggruppa il risultato filtrato in sezioni per brand, ordine alfabetico.
   *  Il raggruppamento ignora le maiuscole ("Alexander Mcqueen" e "Alexander
   *  McQueen" sono lo stesso brand): si tiene l'etichetta scritta meglio
   *  (quella con più occorrenze) come titolo della sezione. */
  const sections = React.useMemo(() => {
    const byKey = new Map<string, { labels: Map<string, number>; items: CatalogProduct[] }>();
    for (const p of filtered) {
      // un prodotto con più brand (collab) compare in OGNI sezione dei suoi brand
      const labels = p.brands.length > 0 ? p.brands : ["— Senza brand —"];
      for (const label of labels) {
        const key = label.toLowerCase();
        let entry = byKey.get(key);
        if (!entry) {
          entry = { labels: new Map(), items: [] };
          byKey.set(key, entry);
        }
        entry.labels.set(label, (entry.labels.get(label) ?? 0) + 1);
        entry.items.push(p);
      }
    }
    return [...byKey.values()]
      .map(({ labels, items }) => {
        // etichetta vincente: quella usata dal maggior numero di prodotti
        const brand = [...labels.entries()].sort((a, b) => b[1] - a[1])[0][0];
        // raggruppa per TIPO (categoria) e poi per modello DENTRO al brand — così
        // si vedono "tutte le scarpe" insieme, poi "tutte le giacche" ecc (stable sort:
        // rispetta l'ordinamento scelto dall'utente all'interno di ogni gruppo)
        const sortedItems = [...items].sort((a, b) => {
          const aDaClass = a.categoria === SENZA_CATEGORIA;
          const bDaClass = b.categoria === SENZA_CATEGORIA;
          if (aDaClass !== bDaClass) return aDaClass ? 1 : -1; // "da classificare" in fondo
          const cat = a.categoria.localeCompare(b.categoria, "it", { sensitivity: "base" });
          if (cat !== 0) return cat;
          return (a.modello ?? "").localeCompare(b.modello ?? "", "it", { sensitivity: "base" });
        });
        return { brand, items: sortedItems };
      })
      // "senza brand" sempre in fondo, il resto alfabetico italiano
      .sort((a, b) => {
        // la sezione dei prodotti di esempio (tutorial) sta sempre in cima
        const aDemo = a.brand === DEMO_BRAND;
        const bDemo = b.brand === DEMO_BRAND;
        if (aDemo !== bDemo) return aDemo ? -1 : 1;
        const aNone = a.brand.startsWith("—");
        const bNone = b.brand.startsWith("—");
        if (aNone !== bNone) return aNone ? 1 : -1;
        return a.brand.localeCompare(b.brand, "it", { sensitivity: "base" });
      });
  }, [filtered]);

  // di default, in vista prodotti, le sezioni brand partono TUTTE chiuse
  // (solo la prima volta che arrivano dati: dopo, l'utente decide).
  React.useEffect(() => {
    if (collapsedInitialized.current || sections.length === 0) return;
    collapsedInitialized.current = true;
    setCollapsedBrands(new Set(sections.map((s) => s.brand)));
  }, [sections]);

  /* --------------------------------------------------------- selezione */

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => setSelected(new Set(filtered.map((p) => p.id)));
  const clearSelection = () => setSelected(new Set());

  /**
   * Trascinamento stile "app Foto" di Apple: tieni premuto su una card e scorri
   * sopra le altre per selezionarle tutte in un gesto solo, senza cliccare una
   * per una. Non usiamo mouseenter per-card (Chromium ha una cattura implicita
   * del mouse sui <button> che lo blocca durante un drag): un mousemove globale
   * legge elementFromPoint e risale alla card più vicina via data-product-id.
   */
  const isMouseDown = React.useRef(false);
  const dragMode = React.useRef<"add" | "remove" | null>(null);
  const dragTouched = React.useRef<Set<string>>(new Set());
  const suppressClickFor = React.useRef<string | null>(null);

  const startDragSelect = (id: string) => {
    isMouseDown.current = true;
    dragMode.current = selected.has(id) ? "remove" : "add";
    dragTouched.current = new Set([id]);
    suppressClickFor.current = id;
    toggleSelect(id);
  };

  React.useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isMouseDown.current || !dragMode.current) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const card = el?.closest<HTMLElement>("[data-product-id]");
      const id = card?.dataset.productId;
      if (!id || dragTouched.current.has(id)) return;
      dragTouched.current.add(id);
      setSelected((prev) => {
        const next = new Set(prev);
        if (dragMode.current === "add") next.add(id);
        else next.delete(id);
        return next;
      });
    };
    const onUp = () => { isMouseDown.current = false; dragMode.current = null; dragTouched.current = new Set(); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  /** Il toggle "normale" (click), ma ignora il click che segue subito un mousedown già gestito dal drag. */
  const toggleSelectDedup = (id: string) => {
    if (suppressClickFor.current === id) {
      suppressClickFor.current = null;
      return;
    }
    toggleSelect(id);
  };

  /** Click sul titolo modello: se non sono TUTTI selezionati li seleziona tutti, altrimenti li deseleziona tutti. */
  const toggleSelectMany = (ids: string[]) => {
    setSelected((prev) => {
      const allSelected = ids.every((id) => prev.has(id));
      const next = new Set(prev);
      for (const id of ids) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  };

  const selectedProducts = React.useMemo(
    () => products.filter((p) => selected.has(p.id)),
    [products, selected]
  );

  const bulkTargetProducts = bulkPresetProducts ?? selectedProducts;

  const removeFromSelection = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const toggleBrand = (brand: string) => {
    setCollapsedBrands((prev) => {
      const next = new Set(prev);
      if (next.has(brand)) next.delete(brand);
      else next.add(brand);
      return next;
    });
  };

  /** Porta il prodotto in vista e lo evidenzia brevemente (apre sezione e la forza a montare). */
  const jumpToProduct = (id: string) => {
    const p = products.find((x) => x.id === id);
    if (p?.brand) {
      const brand = p.brand;
      setCollapsedBrands((prev) => {
        if (!prev.has(brand)) return prev;
        const next = new Set(prev);
        next.delete(brand);
        return next;
      });
      setForcedBrands((prev) => (prev.has(brand) ? prev : new Set(prev).add(brand)));
    }
    // doppio rAF: il primo lascia a React il tempo di montare la sezione,
    // il secondo garantisce che l'elemento esista prima di scrollare.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const el = document.getElementById(`prodotto-${id}`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.animate(
        [{ outline: "2px solid var(--accent)" }, { outline: "2px solid transparent" }],
        { duration: 1600, easing: "ease-out" }
      );
    }));
  };

  if (!startupDone || loading) {
    const totale = progress?.estimatedTotal || data?.products.length || 0;
    return (
      // schermata d'avvio a tutto schermo: copre anche l'intestazione e la barra
      // account, così resta solo il marchio, centrato in orizzontale e verticale
      <div data-startup="1" className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-14 bg-background px-6">
        <div className="animate-brand-fade flex flex-col items-center text-center">
          <span className="text-6xl font-semibold tracking-tight text-foreground sm:text-7xl">
            CatalogFlow
          </span>
          <span className="mt-4 text-sm text-muted-foreground">by Code Grind Studio</span>
        </div>

        <div className="flex flex-col items-center gap-3">
          {/* una sola passata, da sinistra a destra: quando tocca il bordo il catalogo è pronto */}
          <div className="h-[3px] w-72 overflow-hidden bg-muted">
            <div
              className="h-full bg-foreground transition-[width] duration-150 ease-linear"
              style={{ width: `${barPct}%` }}
            />
          </div>
          <p className="text-xs tabular-nums text-muted-foreground">
            Caricamento dei prodotti
            {totale > 0 && (
              <>
                {" · "}
                <span className="text-foreground">{prodotti.toLocaleString("it-IT")}</span>
                {" / "}
                {totale.toLocaleString("it-IT")}
              </>
            )}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3 p-6">
        <p className="flex items-center gap-2 text-sm text-destructive">
          <AlertTriangle className="size-4" /> {error}
        </p>
        <Button variant="outline" size="sm" onClick={() => void load(true)}>Riprova</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ============ intestazione FISSA: tab + filtri restano sempre visibili ============ */}
      <div className="sticky top-0 z-30 -mx-6 border-b border-border bg-background/95 px-6 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div data-tour="filtri" className="flex flex-wrap items-center gap-1.5">
            <div className="relative" title="Cerca per nome, brand, modello o tag">
              <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cerca…"
                className="h-7 w-44 rounded-none pl-7 text-[11px]"
              />
            </div>

            <FilterSelect
              label="Brand" value={brandFilter}
              onChange={(v) => { setBrandFilter(v); setModelloFilter(""); }}
              hint="Filtra per marchio"
            >
              {data?.facets.brands.map((b) => (
                <option key={b.value} value={b.value}>{b.value} ({b.count})</option>
              )) ?? null}
            </FilterSelect>

            <FilterSelect
              label="Modello" value={modelloFilter} onChange={setModelloFilter}
              disabled={modelOptions.length === 0}
              hint="Sottocategoria del brand scelto (es. Jordan 1, Air Force 1) — scegli prima un brand"
            >
              {modelOptions.map((m) => (
                <option key={m.value} value={m.value}>{m.value} ({m.count})</option>
              ))}
            </FilterSelect>

            <FilterSelect
              label="Stato" value={statusFilter} onChange={setStatusFilter}
              hint="Pubblicati = visibili sullo shop; Draft/Archiviati = nascosti"
              noEmptyOption
            >
              <option value="ARCHIVED">Archiviati</option>
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Pubblicati</option>
              <option value="">Tutti gli stati</option>
            </FilterSelect>

            {!!data?.facets.daClassificare && (
              <button
                onClick={() => setSoloSenzaTipo((v) => !v)}
                title="Mostra solo i prodotti a cui manca il tipo (categoria)"
                className={cn(
                  "h-7 rounded-none border px-2 text-[11px] transition-colors",
                  soloSenzaTipo
                    ? "border-accent bg-accent/10 text-foreground"
                    : "border-border text-muted-foreground hover:border-border/60 hover:text-foreground"
                )}
              >
                {data.facets.daClassificare} senza tipo
              </button>
            )}

            <FilterSelect
              label="Ordina"
              noEmptyOption
              hint="Criterio di ordinamento dei prodotti nella lista"
              value={`${sortKey}:${sortAsc ? "asc" : "desc"}`}
              onChange={(v) => {
                const [key, dir] = v.split(":") as [SortKey, "asc" | "desc"];
                setSortKey(key);
                setSortAsc(dir === "asc");
              }}
            >
              <option value="title:asc">Nome (A-Z)</option>
              <option value="title:desc">Nome (Z-A)</option>
              <option value="brand:asc">Brand (A-Z)</option>
              <option value="price:asc">Prezzo (crescente)</option>
              <option value="price:desc">Prezzo (decrescente)</option>
            </FilterSelect>

            {(brandFilter || modelloFilter || statusFilter !== "ACTIVE" || soloSenzaTipo || query) && (
              <Button
                variant="ghost" size="sm" className="h-7 rounded-none px-2 text-[11px] text-destructive hover:text-destructive"
                title="Rimuove tutti i filtri attivi"
                onClick={() => {
                  setQuery(""); setBrandFilter(""); setModelloFilter("");
                  setStatusFilter("ACTIVE"); setSoloSenzaTipo(false);
                }}
              >
                <X className="size-3" /> Pulisci
              </Button>
            )}

            <div className="ml-auto flex shrink-0 items-center gap-2">
              <FilterSelect
                label="Per riga"
                noEmptyOption
                hint="Quanti prodotti mostrare per riga nella griglia"
                value={String(cols)}
                onChange={(v) => setCols(Number(v))}
              >
                <option value="10">10 per riga</option>
                <option value="12">12 per riga</option>
              </FilterSelect>

              <Button
                data-tour="vista"
                variant={brandGridView ? "secondary" : "outline"}
                size="sm"
                className="h-7 gap-1 rounded-none px-2 text-[11px]"
                onClick={() => setBrandGridView((v) => !v)}
                title={brandGridView ? "Torna all'elenco prodotti" : "Vedi solo l'elenco dei brand (indice rapido)"}
              >
                {brandGridView ? <LayoutList className="size-3.5" /> : <LayoutGrid className="size-3.5" />}
                {brandGridView ? "Vedi prodotti" : "Solo brand"}
              </Button>

              <span className="text-[11px] whitespace-nowrap text-muted-foreground">
                {filtered.length}/{data?.count ?? 0}
              </span>

              <Button
                variant="outline" size="sm" className="h-7 rounded-none px-2 text-[11px]"
                title="Ricarica il catalogo da Shopify (richiede qualche secondo)"
                onClick={() => void load(true)} disabled={refreshing}
              >
                {refreshing ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
                <span className="sr-only">Sincronizza</span>
              </Button>
            </div>
        </div>
      </div>

      {brandGridView ? (
        <div className={cn("grid gap-2 pb-24", BRAND_GRID_COLS_CLASS[cols] ?? BRAND_GRID_COLS_CLASS[6])}>
          {sections.map(({ brand, items }) => (
            <button
              key={brand}
              title={`Vai alla sezione ${brand}`}
              onClick={() => {
                setBrandGridView(false);
                setCollapsedBrands((prev) => {
                  if (!prev.has(brand)) return prev;
                  const next = new Set(prev);
                  next.delete(brand);
                  return next;
                });
                requestAnimationFrame(() => requestAnimationFrame(() => {
                  document.getElementById(`brand-${initialOf(brand)}-${brand}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                }));
              }}
              className="flex flex-col items-start gap-1 border border-border bg-card p-3 text-left transition-colors hover:border-accent"
            >
              <span className="text-xs font-medium">{brand}</span>
              <span className="text-[10px] text-muted-foreground">
                {items.length} prodott{items.length === 1 ? "o" : "i"}
                <ModelliCount items={items} />
              </span>
            </button>
          ))}

          {sections.length === 0 && (
            <p className="col-span-full border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Nessun prodotto corrisponde ai filtri.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-8 pb-24">
          {sections.map(({ brand, items }) => {
            const collapsed = collapsedBrands.has(brand);
            return (
              <LazySection
                key={brand}
                id={`brand-${initialOf(brand)}-${brand}`}
                estimateHeight={collapsed ? 44 : estimateSectionHeight(items.length, cols)}
                force={forcedBrands.has(brand)}
              >
                {/* intestazione sezione brand: barra grigia a tutta larghezza, cliccabile per chiudere/aprire */}
                <button
                  data-tour="brand"
                  onClick={() => toggleBrand(brand)}
                  title={collapsed ? "Apri questa sezione" : "Comprimi questa sezione"}
                  className="mb-3 flex w-full items-center gap-2 bg-card px-3 py-2 text-left transition-colors hover:bg-muted"
                >
                  {collapsed ? (
                    <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <h2 className="text-sm font-semibold">{brand}</h2>
                  <span className="text-[10px] text-muted-foreground">
                    {items.length} prodott{items.length === 1 ? "o" : "i"}
                    <ModelliCount items={items} />
                  </span>
                </button>

                {!collapsed && (
                  <div className={cn("grid gap-3", COLS_CLASS[cols] ?? COLS_CLASS[6])}>
                    {items.map((p, idx) => {
                      // separatore visivo quando cambia il TIPO: raggruppa "tutte le
                      // scarpe", poi "tutte le giacche" ecc dentro allo stesso brand
                      const prevCategoria = idx > 0 ? items[idx - 1].categoria : undefined;
                      const showTypeHeader = p.categoria !== prevCategoria;
                      // separatore visivo quando cambia il modello: utile quando
                      // le foto si assomigliano (es. stesse sneaker, colori diversi)
                      const prevModello = idx > 0 ? items[idx - 1].modello : undefined;
                      const showModelHeader = !!p.modello && (p.modello !== prevModello || showTypeHeader);
                      return (
                        <React.Fragment key={p.id}>
                          {showTypeHeader && (
                            <div className="col-span-full mt-3 flex items-center gap-2 first:mt-0">
                              <button
                                type="button"
                                onClick={() => toggleSelectMany(items.filter((x) => x.categoria === p.categoria).map((x) => x.id))}
                                title={`Seleziona/deseleziona tutti i prodotti di questo tipo (${items.filter((x) => x.categoria === p.categoria).length})`}
                                className={cn(
                                  "text-xs font-semibold tracking-wide uppercase hover:underline",
                                  p.categoria === SENZA_CATEGORIA ? "text-muted-foreground/70" : "text-foreground"
                                )}
                              >
                                {p.categoria === SENZA_CATEGORIA ? "Senza tipo" : p.categoria}
                              </button>
                              <span className="text-[10px] text-muted-foreground">
                                {items.filter((x) => x.categoria === p.categoria).length}
                              </span>
                              <span className="h-px flex-1 bg-border" />
                            </div>
                          )}
                          {showModelHeader && (
                            <div className="col-span-full mt-1 flex items-center gap-2 first:mt-0">
                              <button
                                type="button"
                                onClick={() => toggleSelectMany(items.filter((x) => x.modello === p.modello).map((x) => x.id))}
                                title={`Seleziona/deseleziona tutti i prodotti di questo modello (${items.filter((x) => x.modello === p.modello).length})`}
                                className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase hover:text-foreground hover:underline"
                              >
                                {p.modello}
                              </button>
                              <span className="h-px flex-1 bg-border" />
                            </div>
                          )}
                          {/* secondo livello di ottimizzazione: anche dentro una
                              sezione già montata, il browser salta il rendering
                              delle card fuori schermo. */}
                          <div
                            id={`prodotto-${p.id}`}
                            data-product-id={p.id}
                            style={{ contentVisibility: "auto", containIntrinsicSize: "auto 340px" }}
                          >
                            <ProductCard
                              product={p}
                              selected={selected.has(p.id)}
                              onToggleSelect={() => (selected.size > 0 ? toggleSelectDedup(p.id) : toggleSelect(p.id))}
                              onEdit={() => setEditing(p)}
                              dense={cols >= 12}
                              selectionMode={selected.size > 0}
                              onDragSelectStart={selected.size > 0 ? () => startDragSelect(p.id) : undefined}
                            />
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}
              </LazySection>
            );
          })}

          {sections.length === 0 && (
            <p className="border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Nessun prodotto corrisponde ai filtri.
            </p>
          )}
        </div>
      )}

      {/* ------------------------------------------------------ dialoghi */}
      {editing && (
        <EditProductDialog
          product={editing}
          facets={data?.facets ?? null}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); setReloadKey((k) => k + 1); }}
          onRequestDelete={() => { setDeleting(editing); setEditing(null); }}
        />
      )}

      {deleting && (
        <DeleteProductDialog
          product={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => { setDeleting(null); setReloadKey((k) => k + 1); }}
        />
      )}

      {bulkOpen && (
        <BulkEditDialog
          products={bulkTargetProducts}
          facets={data?.facets ?? null}
          onClose={() => { setBulkOpen(false); setBulkPresetProducts(null); }}
          onReload={() => setReloadKey((k) => k + 1)}
          onDone={() => { setBulkOpen(false); setBulkPresetProducts(null); clearSelection(); setReloadKey((k) => k + 1); }}
        />
      )}

      {!editing && !deleting && !bulkOpen && (
        <SelectionTray
          products={selectedProducts}
          onRemove={removeFromSelection}
          onClearAll={clearSelection}
          onBulkEdit={() => setBulkOpen(true)}
          onJumpTo={jumpToProduct}
          selectAllCount={filtered.length}
          onSelectAll={selectAllVisible}
        />
      )}

      {/* tutorial guidato: si apre da solo ad ogni accensione del server */}
      <TourHost />
    </div>
  );
}

/* =============================================================== pezzi */

function FilterSelect({
  label, value, onChange, disabled, children, noEmptyOption, hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
  noEmptyOption?: boolean;
  /** Spiegazione mostrata al passaggio del mouse (tooltip nativo del browser). */
  hint?: string;
}) {
  return (
    <div className="relative inline-block" title={hint}>
      <select
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-7 max-w-[124px] appearance-none rounded-none border border-border bg-background py-0 pr-6 pl-1.5 text-[11px] outline-none",
          "focus:ring-0 focus-visible:ring-0 disabled:opacity-40"
        )}
      >
        {!noEmptyOption && <option value="">{label}</option>}
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-1.5 size-3 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
