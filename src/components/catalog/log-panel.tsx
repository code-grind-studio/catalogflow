"use client";

import * as React from "react";
import { X, Loader2, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";

interface LogEntry {
  at: number;
  userId: string;
  userLabel: string;
  action: string;
  detail: string;
  productId?: string;
  productTitle?: string;
  productImage?: string;
  change?: { before: string; after: string };
  affectedProducts?: { id: string; title: string; image?: string }[];
}

const ACTION_LABELS: Record<string, string> = {
  update: "Modifica",
  bulkEditGroup: "Modifica di gruppo",
  setBrand: "Brand",
  setTipo: "Tipo",
  setStagione: "Stagione",
  setModello: "Modello",
  setGroup: "Gruppo",
  setFornitore: "Link fornitore",
  setBrandBulk: "Brand (gruppo)",
  setTipoBulk: "Tipo (gruppo)",
  setStagioneBulk: "Stagione (gruppo)",
  setStatus: "Stato",
  bulkTags: "Tag",
  setPrice: "Prezzo",
  setMainImage: "Immagine principale",
  deleteImage: "Immagine eliminata",
  delete: "Eliminazione",
  collaboratorCreate: "Nuovo accesso",
  collaboratorDelete: "Accesso revocato",
};

/** Elenco espandibile dei prodotti coinvolti da un'azione di gruppo (bulk). */
function AffectedProductsList({ products }: { products: { id: string; title: string; image?: string }[] }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        title={open ? "Nascondi l'elenco prodotti" : "Vedi quali prodotti sono stati modificati"}
      >
        {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        {products.length} prodott{products.length === 1 ? "o" : "i"} modificat{products.length === 1 ? "o" : "i"}
      </button>
      {open && (
        <ul className="mt-1.5 max-h-48 space-y-1 overflow-y-auto thin-scrollbar border-l border-border pl-2">
          {products.map((p) => (
            <li key={p.id} className="flex items-center gap-2 text-[11px]">
              {p.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image} alt="" className="size-6 shrink-0 border border-border bg-white object-cover" />
              ) : (
                <span className="size-6 shrink-0 border border-border bg-card" />
              )}
              <span className="truncate text-muted-foreground">{p.title}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatWhen(ts: number): string {
  const d = new Date(ts);
  const now = Date.now();
  const diffMin = Math.round((now - ts) / 60000);
  if (diffMin < 1) return "adesso";
  if (diffMin < 60) return `${diffMin} min fa`;
  return d.toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/** Raggruppa le voci per sessioni logiche: stesso utente, gap < 30 min tra un'azione e la successiva. */
function groupBySession(entries: LogEntry[]): { userLabel: string; start: number; end: number; entries: LogEntry[] }[] {
  const sorted = [...entries].sort((a, b) => b.at - a.at); // più recenti prima
  const groups: { userLabel: string; start: number; end: number; entries: LogEntry[] }[] = [];

  for (const e of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.userLabel === e.userLabel && last.end - e.at < 30 * 60 * 1000) {
      last.entries.push(e);
      last.end = e.at; // end = più vecchio del gruppo (stiamo scorrendo a ritroso)
    } else {
      groups.push({ userLabel: e.userLabel, start: e.at, end: e.at, entries: [e] });
    }
  }
  return groups;
}

export function LogPanel({ onClose }: { onClose: () => void }) {
  const [entries, setEntries] = React.useState<LogEntry[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/catalog/log?limit=500");
      const json = (await res.json()) as { ok: boolean; entries?: LogEntry[]; error?: string };
      if (!json.ok) throw new Error(json.error ?? "errore");
      setEntries(json.entries ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const sessions = React.useMemo(() => groupBySession(entries ?? []), [entries]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
      <div className="flex max-h-[85vh] w-full max-w-4xl flex-col border border-border bg-background">
        <div className="flex items-center gap-3 border-b border-border px-6 py-4">
          <h2 className="text-sm font-medium">Log attività</h2>
          <span className="text-xs text-muted-foreground">chi ha fatto cosa, per sessione di lavoro</span>
          <button
            onClick={() => void load()}
            className="ml-auto text-muted-foreground hover:text-foreground"
            title="Aggiorna"
          >
            <RefreshCw className="size-3.5" />
          </button>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto thin-scrollbar px-6 py-5">
          {error && <p className="text-xs text-destructive">{error}</p>}

          {!entries && !error && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Carico il log…
            </div>
          )}

          {entries && entries.length === 0 && (
            <p className="text-sm text-muted-foreground">Ancora nessuna azione registrata.</p>
          )}

          <div className="space-y-9">
            {sessions.map((s, i) => (
              <section key={i} className="space-y-3.5">
                <div className="flex items-baseline gap-2.5 border-b border-border pb-2.5">
                  <span className="text-xs font-medium">{s.userLabel}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatWhen(s.start)} — {s.entries.length} azion{s.entries.length === 1 ? "e" : "i"}
                  </span>
                </div>
                <ul className="space-y-4">
                  {s.entries.map((e, j) => (
                    <li key={j} className="flex items-start gap-3.5 border-b border-border/40 pb-4 text-xs last:border-0 last:pb-0">
                      {e.productImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={e.productImage}
                          alt=""
                          className="mt-0.5 size-10 shrink-0 border border-border bg-white object-cover"
                        />
                      ) : e.affectedProducts && e.affectedProducts.length > 0 ? null : (
                        <span className="mt-0.5 size-10 shrink-0 border border-border bg-card" />
                      )}
                      <div className="flex-1 space-y-1.5">
                        <div className="flex items-center gap-2.5">
                          <span className="shrink-0 border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {ACTION_LABELS[e.action] ?? e.action}
                          </span>
                          {e.productTitle && <strong className="font-medium">{e.productTitle}</strong>}
                        </div>
                        {e.change ? (
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                            <span className="text-muted-foreground">{e.change.before}</span>
                            <span className="text-muted-foreground">→</span>
                            <span className="text-foreground">{e.change.after}</span>
                          </div>
                        ) : (
                          <span className="block text-[11px] leading-relaxed text-muted-foreground">{e.detail}</span>
                        )}
                        {e.affectedProducts && e.affectedProducts.length > 0 && (
                          <AffectedProductsList products={e.affectedProducts} />
                        )}
                      </div>
                      <span className="shrink-0 text-[10px] text-muted-foreground">{formatWhen(e.at)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
