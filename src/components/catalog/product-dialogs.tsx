"use client";

import * as React from "react";
import {
  Trash2, Loader2, Check, ExternalLink, Link2, ImageOff, AlertTriangle, ChevronDown, X,
  ArrowUpDown, MoreHorizontal, FlaskConical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { CatalogProduct, Facets } from "@/lib/catalog/catalog";
import { isDemoProduct } from "@/lib/catalog/demo";
import {
  SIZE_SCALES, scalesForFamily, scalesForCategoria, sortSizeValues, isSorted, missingFromScale,
  nextSizeSuggestions, groupProductsByScale, type ScaleGroup,
  type SizeFamily, type SizeScale,
} from "@/lib/catalog/sizes";

/* ---------------------------------------------------------------- helper */

async function callProductApiResult<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch("/api/catalog/product", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { ok: boolean; error?: string; result?: T };
  if (!json.ok) throw new Error(json.error ?? "errore");
  return json.result as T;
}

async function callProductApi(body: Record<string, unknown>): Promise<void> {
  await callProductApiResult(body);
}

const STAGIONI = [
  { value: "primavera", label: "Primavera" },
  { value: "estate", label: "Estate" },
  { value: "autunno", label: "Autunno" },
  { value: "inverno", label: "Inverno" },
  { value: "tutte-le-stagioni", label: "Tutte le stagioni" },
];

/** Checkbox multi-selezione per le stagioni: sostituisce il vecchio <select> a valore singolo. */
function StagioniPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (v: string) => {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  };
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {STAGIONI.map((s) => {
        const active = value.includes(s.value);
        return (
          <label
            key={s.value}
            className={cn(
              "flex cursor-pointer items-center gap-2 border px-2 py-1.5 text-xs transition-colors",
              active ? "border-foreground bg-accent/10" : "border-border hover:border-border/60"
            )}
          >
            <input
              type="checkbox"
              checked={active}
              onChange={() => toggle(s.value)}
              className="size-3.5 cursor-pointer accent-foreground"
            />
            {s.label}
          </label>
        );
      })}
    </div>
  );
}

/**
 * Editor a chip per i brand di un prodotto: di solito uno solo, ma supporta
 * le collab (es. "Nike x Off-White" -> 2 brand). Chip rimovibili + campo con
 * autocomplete sui brand già noti nel catalogo per aggiungerne altri.
 */
function BrandsPicker({
  value, onChange, knownBrands,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  knownBrands: string[];
}) {
  const [draft, setDraft] = React.useState("");

  const addBrand = (raw: string) => {
    const b = raw.trim();
    if (!b) return;
    if (value.some((x) => x.toLowerCase() === b.toLowerCase())) { setDraft(""); return; }
    onChange([...value, b]);
    setDraft("");
  };
  const removeBrand = (b: string) => onChange(value.filter((x) => x !== b));

  return (
    <div className="space-y-1.5">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((b) => (
            <span
              key={b}
              className="flex items-center gap-1 border border-border bg-accent/10 px-2 py-1 text-xs"
            >
              {b}
              <button
                type="button"
                onClick={() => removeBrand(b)}
                title={`Rimuovi ${b}`}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); addBrand(draft); }
        }}
        onBlur={() => draft.trim() && addBrand(draft)}
        list="brands-picker-list"
        placeholder={value.length > 0 ? "Aggiungi un altro brand (collab)…" : "es. Nike"}
        className="h-9 rounded-none text-sm"
      />
      <datalist id="brands-picker-list">
        {knownBrands.map((b) => <option key={b} value={b} />)}
      </datalist>
    </div>
  );
}

/** Come BrandsPicker, ma per un VALORE SINGOLO con uno stato speciale "Automatica"
 *  (stringa vuota = lascia dedurre la categoria dalle regole). Scrivere un tipo
 *  nuovo lo crea a tutti gli effetti, non serve scegliere da un elenco chiuso. */
function CategoriaPicker({
  value, onChange, knownCategorie, autoLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  knownCategorie: string[];
  autoLabel: string;
}) {
  const [draft, setDraft] = React.useState("");

  const set = (raw: string) => {
    const v = raw.trim();
    if (!v) return;
    onChange(v);
    setDraft("");
  };

  return (
    <div className="space-y-1.5">
      {value ? (
        <div className="flex flex-wrap gap-1.5">
          <span className="flex items-center gap-1 border border-border bg-accent/10 px-2 py-1 text-xs">
            {value}
            <button
              type="button"
              onClick={() => onChange("")}
              title="Torna ad automatica"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          </span>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">{autoLabel}</p>
      )}
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); set(draft); }
        }}
        onBlur={() => draft.trim() && set(draft)}
        list="categoria-picker-list"
        placeholder={value ? "Cambia tipo…" : "es. Felpa (nuovo o esistente)"}
        className="h-9 rounded-none text-sm"
      />
      <datalist id="categoria-picker-list">
        {knownCategorie.map((c) => <option key={c} value={c} />)}
      </datalist>
    </div>
  );
}

/* ================================================================ taglie */

interface SizeValueInfo {
  id: string;
  name: string;
  /** Quante varianti esistono con questa taglia (con i colori, più di una). */
  varianti: number;
}

interface OptionsPayload {
  productId: string;
  title: string;
  /** Prezzo di riferimento (prima variante con prezzo): quello che erediteranno le taglie nuove. */
  referencePrice: string | null;
  variantCount: number;
  variantsTruncated: boolean;
  size: {
    optionId: string;
    optionName: string;
    values: SizeValueInfo[];
    family: SizeFamily;
    variantCount: number;
  } | null;
  otherOptions: { id: string; name: string; count: number }[];
}

const FAMILY_HINT: Record<SizeFamily, string> = {
  numeri: "numeri",
  lettere: "lettere",
  unica: "taglia unica",
  mista: "mista (numeri + lettere)",
  altro: "non standard",
  nessuna: "senza taglie",
};

/**
 * Separa quello che l'utente scrive in taglie. La virgola è un separatore
 * ("43, 44") ma "36,5" resta una taglia sola (mezza misura); sul catalogo le
 * mezze misure sono scritte col punto, quindi normalizziamo 36,5 -> 36.5.
 */
function parseSizeDraft(input: string): string[] {
  const tokens = input.match(/\d+,\d+|[^\s,;]+/g) ?? [];
  return tokens.map((t) => (/^\d+,\d+$/.test(t) ? t.replace(",", ".") : t));
}

/** Taglie non ancora presenti, confrontate come le confronta Shopify-mente: 36 == 36.0, m == M. */
function onlyMissing(existing: string[], wanted: string[]): string[] {
  const have = new Set(existing.map((v) => v.trim().toLowerCase()));
  const haveKey = new Set(existing.map((v) => v.trim().replace(",", ".").toLowerCase()));
  return wanted.filter((w) => {
    const k = w.trim().toLowerCase();
    return !have.has(k) && !haveKey.has(k) && !haveKey.has(k.replace(",", "."));
  });
}

/** Voce del menu "altre azioni" del blocco Taglie. */
function MenuItem({
  children, onSelect, disabled,
}: {
  children: React.ReactNode;
  onSelect: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className="block w-full px-3 py-1.5 text-left text-[11px] hover:bg-accent/10 disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function SizesEditor({ product }: { product: CatalogProduct }) {
  const [data, setData] = React.useState<OptionsPayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");
  const [editing, setEditing] = React.useState<{ id: string; name: string; original: string } | null>(null);
  const [confirmDel, setConfirmDel] = React.useState<SizeValueInfo | null>(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const addRef = React.useRef<HTMLInputElement>(null);

  const fetchOptions = React.useCallback(
    () => callProductApiResult<OptionsPayload>({ action: "getOptions", id: product.id }),
    [product.id]
  );

  const load = React.useCallback(async () => {
    try {
      const r = await fetchOptions();
      setData(r);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [fetchOptions]);

  // primo caricamento: setState solo DOPO la risposta, dentro le callback (non sincrono nell'effetto)
  React.useEffect(() => {
    let alive = true;
    fetchOptions()
      .then((r) => {
        if (!alive) return;
        setData(r);
        setErr(null);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setErr(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, [fetchOptions]);

  /** Ogni modifica alle taglie si scrive SUBITO su Shopify (non serve "Salva modifiche"). */
  const run = async (
    label: string,
    body: Record<string, unknown>,
    noteFor?: (result: unknown) => string | null
  ) => {
    setBusy(label);
    setErr(null);
    setNotice(null);
    try {
      const r = await callProductApiResult<unknown>({ productId: product.id, ...body });
      await load();
      const n = noteFor?.(r);
      if (n) setNotice(n);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const priceFixedNote = (r: unknown): string | null => {
    const fixed = (r as { priceFixed?: { title: string; price: string }[] })?.priceFixed ?? [];
    if (!fixed.length) return null;
    return `Prezzo allineato su ${fixed.map((f) => f.title).join(", ")}: €${fixed[0].price} (la prima variante era a €0).`;
  };

  const size = data?.size ?? null;
  const ids = (v: string[]) => v.map((name) => size?.values.find((x) => x.name === name)?.id).filter(Boolean) as string[];

  const addValues = (values: string[]) => {
    if (!size) return;
    const missing = onlyMissing(size.values.map((v) => v.name), values);
    if (!missing.length) { setNotice("Taglie già presenti: niente da aggiungere."); return; }
    void run("add", { action: "sizesAdd", optionId: size.optionId, values: missing }, (r) => {
      const fixed = priceFixedNote(r);
      return fixed ?? `Aggiunte: ${missing.join(", ")}`;
    });
  };

  const sortValues = () => {
    if (!size) return;
    const sorted = sortSizeValues(size.values.map((v) => v.name));
    const order = ids(sorted);
    if (order.length !== size.values.length) return; // nomi duplicati: non tocchiamo l'ordine
    void run("sort", { action: "sizesSort", optionId: size.optionId, order }, () => "Taglie riordinate.");
  };

  const renameValue = (valueId: string, original: string, name: string) => {
    if (!size) return;
    const clean = name.trim();
    setEditing(null);
    if (!clean || clean === original) return;
    void run("rename", { action: "sizesRename", optionId: size.optionId, valueId, name: clean, from: original });
  };

  const deleteValue = async (v: SizeValueInfo) => {
    if (!size) return;
    await run("delete", { action: "sizesDelete", optionId: size.optionId, valueIds: [v.id], names: [v.name] });
    setConfirmDel(null);
  };

  const renameOption = () => {
    if (!size) return;
    void run("option", { action: "sizesRenameOption", optionId: size.optionId, name: "Taglia", from: size.optionName });
  };

  const createSizes = (scale: SizeScale) => {
    void run("create", { action: "sizesCreate", values: scale.values, name: "Taglia" }, (r) => {
      const fixed = priceFixedNote(r);
      return fixed ?? `Create le taglie ${scale.label.toLowerCase()}.`;
    });
  };

  /** Prodotto senza taglie: crea l'opzione con quello che è stato scritto nel campo. */
  const createFromDraft = () => {
    const values = parseSizeDraft(draft);
    if (!values.length) return;
    setDraft("");
    void run("create", { action: "sizesCreate", values, name: "Taglia" }, (r) => {
      const fixed = priceFixedNote(r);
      return fixed ?? `Create le taglie: ${values.join(", ")}`;
    });
  };

  const busyNow = busy !== null;
  // Suggerimenti dedotti dalla serie di QUESTO prodotto: buco interno o valore successivo.
  const suggestions = size
    ? nextSizeSuggestions(size.values.map((v) => v.name)).filter(
        (s) => !size.values.some((x) => x.name.trim().toLowerCase() === s.toLowerCase())
      )
    : [];

  /* ------------------------------------------------------------ rendering */

  return (
    <div className="border border-border">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="text-[10px] tracking-wide text-muted-foreground uppercase">Taglie</span>
        {size && (
          <span className="text-[11px] text-muted-foreground">
            <span className="tabular-nums">{size.values.length}</span> valori
            {size.optionName.trim().toLowerCase() !== "taglia" ? ` · opzione «${size.optionName}»` : ""}
          </span>
        )}
        <span className="flex-1" />
        {busyNow && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
        {size && size.values.length > 1 && !isSorted(size.values.map((v) => v.name)) && (
          <button
            type="button"
            onClick={() => void sortValues()}
            disabled={busyNow}
            title="Mette in ordine i valori: numeri crescenti, poi XS → XXXL"
            className="flex items-center gap-1 border border-border px-2 py-1 text-[11px] hover:border-border/60 disabled:opacity-30"
          >
            <ArrowUpDown className="size-3" /> Ordina
          </button>
        )}
        {size && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              title="Altre azioni sulle taglie"
              className="flex h-6 items-center border border-border px-1.5 text-muted-foreground hover:border-border/60 hover:text-foreground"
            >
              <MoreHorizontal className="size-3.5" />
            </button>
            {menuOpen && (
              <>
                <button
                  type="button"
                  aria-hidden
                  tabIndex={-1}
                  onClick={() => setMenuOpen(false)}
                  className="fixed inset-0 z-40 cursor-default"
                />
                <div className="absolute top-full right-0 z-50 mt-1 w-60 border border-border bg-popover py-1">
                  <MenuItem
                    disabled={busyNow || size.values.length < 2}
                    onSelect={() => { setMenuOpen(false); void sortValues(); }}
                  >
                    Ordina taglie
                  </MenuItem>
                  {size.optionName.trim().toLowerCase() !== "taglia" && (
                    <MenuItem
                      disabled={busyNow}
                      onSelect={() => { setMenuOpen(false); void renameOption(); }}
                    >
                      Rinomina opzione in «Taglia»
                    </MenuItem>
                  )}
                  <MenuItem disabled={busyNow} onSelect={() => { setMenuOpen(false); void load(); }}>
                    Ricarica da Shopify
                  </MenuItem>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2 p-3">
        {loading && !data && (
          <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Loader2 className="size-3 animate-spin" /> Carico le taglie da Shopify…
          </p>
        )}

        {err && (
          <p className="flex items-start gap-2 border border-destructive/40 bg-destructive/10 p-2 text-[11px] text-destructive">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {err}
          </p>
        )}
        {notice && !err && <p className="text-[11px] text-muted-foreground">{notice}</p>}

        {/* prodotto senza opzione taglia: solo le scale coerenti con la categoria + campo libero */}
        {data && !size && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">
              Nessuna taglia su questo prodotto.{data.variantCount <= 1 ? " La variante unica viene sostituita." : ""}
            </span>
            {scalesForCategoria(product.categoria).map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => void createSizes(s)}
                disabled={busyNow}
                title={`Crea le taglie: ${s.values.join(", ")}`}
                className="border border-border px-2 py-1 text-[11px] hover:border-border/60 disabled:opacity-30"
              >
                {s.label}
              </button>
            ))}
            <span className="text-[11px] text-muted-foreground">oppure</span>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); createFromDraft(); } }}
              placeholder="S, M, L…"
              className="h-7 w-32 border border-border bg-transparent px-2 text-xs outline-none placeholder:text-muted-foreground focus:border-foreground"
            />
          </div>
        )}

        {/* i valori reali del prodotto: click = rinomina, X = elimina (con conferma) */}
        {size && data && (
          <div className="flex flex-wrap items-center gap-1">
            {size.values.map((v) =>
              editing?.id === v.id ? (
                <input
                  key={v.id}
                  autoFocus
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") renameValue(v.id, editing.original, editing.name);
                    if (e.key === "Escape") setEditing(null);
                  }}
                  onBlur={() => renameValue(v.id, editing.original, editing.name)}
                  className="h-7 w-16 border border-accent bg-accent/10 px-1 text-center text-xs tabular-nums outline-none"
                />
              ) : (
                <span
                  key={v.id}
                  className="group flex h-7 min-w-10 items-center justify-center gap-1 border border-border px-2 text-xs hover:border-border/60"
                  title={`${v.varianti} ${v.varianti === 1 ? "variante" : "varianti"} con questa taglia`}
                >
                  <button
                    type="button"
                    onClick={() => setEditing({ id: v.id, name: v.name, original: v.name })}
                    disabled={busyNow}
                    className="cursor-pointer tabular-nums"
                  >
                    {v.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDel(v)}
                    disabled={busyNow}
                    title="Elimina taglia"
                    className="hidden text-muted-foreground group-hover:block hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              )
            )}

            <input
              ref={addRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); addValues(parseSizeDraft(draft)); setDraft(""); }
              }}
              placeholder="aggiungi…"
              title="Scrivi una taglia e premi Invio (più valori separati da virgola)"
              className="h-7 w-28 border border-dashed border-border bg-transparent px-2 text-xs tabular-nums outline-none placeholder:text-muted-foreground focus:border-foreground"
            />

            {/* solo le taglie coerenti con questa serie: buco interno o valore successivo */}
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => addValues([s])}
                disabled={busyNow}
                title={`Aggiungi la taglia ${s} (serie di questo prodotto)`}
                className="h-7 border border-dashed border-border px-2 text-xs text-muted-foreground tabular-nums hover:border-border/60 hover:text-foreground disabled:opacity-30"
              >
                +{s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* conferma eliminazione: obbligatoria, elimina anche la variante su Shopify */}
      {confirmDel && (
        <Dialog open onOpenChange={(o) => !o && setConfirmDel(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-sm">Eliminare la taglia {confirmDel.name}?</DialogTitle>
              <DialogDescription className="text-xs">{product.title}</DialogDescription>
            </DialogHeader>
            <p className="text-xs text-muted-foreground">
              Su Shopify viene eliminata anche la variante collegata
              {confirmDel.varianti > 1 ? ` (${confirmDel.varianti} varianti: una per combinazione con le altre opzioni)` : ""}.
              Il prodotto non sarà più vendibile in questa taglia e l&apos;operazione non è reversibile.
            </p>
            <DialogFooter>
              <Button variant="outline" size="sm" className="rounded-none text-xs" onClick={() => setConfirmDel(null)}>
                Annulla
              </Button>
              <Button
                variant="destructive" size="sm" className="rounded-none text-xs"
                disabled={busyNow}
                onClick={() => void deleteValue(confirmDel)}
              >
                {busy === "delete" ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
                Elimina taglia
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

/* ============================================== modifica singolo prodotto */

export function EditProductDialog({
  product, facets, onClose, onSaved, onRequestDelete,
}: {
  product: CatalogProduct;
  facets: Facets | null;
  onClose: () => void;
  onSaved: () => void;
  onRequestDelete?: () => void;
}) {
  const [title, setTitle] = React.useState(product.title);
  const [brands, setBrands] = React.useState<string[]>(product.brands ?? (product.brand ? [product.brand] : []));
  // La categoria è dedotta dalle regole; qui si può solo SOVRASCRIVERLA.
  // Vuoto = automatica (usa le regole).
  const [categoria, setCategoria] = React.useState(product.categoriaForzata ? product.categoria : "");
  const [stagioni, setStagioni] = React.useState<string[]>(product.stagioni ?? []);
  const [modello, setModello] = React.useState(product.modello ?? "");
  const [gruppo, setGruppo] = React.useState(product.gruppo ?? "");
  const [fornitore, setFornitore] = React.useState(product.fornitoreUrl ?? "");
  const [price, setPrice] = React.useState(product.priceMin ?? "");
  const [compareAt, setCompareAt] = React.useState(product.compareAtPrice ?? "");
  const [status, setStatus] = React.useState(product.status);

  const [busy, setBusy] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [images, setImages] = React.useState(product.images);

  /** Prodotto di esempio del tutorial: nessuna modifica deve uscire da questa pagina. */
  const demo = isDemoProduct(product);

  const run = async (label: string, body: Record<string, unknown>) => {
    if (demo) return; // esempio: niente chiamate allo store
    setBusy(label);
    setErr(null);
    try {
      await callProductApi(body);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      setBusy(null);
    }
  };

  const saveAll = async () => {
    if (demo) { onSaved(); return; } // esempio: si chiude senza scrivere niente
    setBusy("save");
    setErr(null);
    try {
      const jobs: Record<string, unknown>[] = [];
      if (title !== product.title) jobs.push({ action: "update", id: product.id, title });
      const brandsPrima = [...(product.brands ?? (product.brand ? [product.brand] : []))].sort();
      const brandsDopo = [...brands].sort();
      if (JSON.stringify(brandsPrima) !== JSON.stringify(brandsDopo)) {
        jobs.push({ action: "setBrands", id: product.id, brands });
      }
      if (categoria !== (product.categoriaForzata ? product.categoria : "")) {
        jobs.push({ action: "setCategoria", id: product.id, categoria });
      }
      const stagioniPrima = [...(product.stagioni ?? [])].sort();
      const stagioniDopo = [...stagioni].sort();
      if (JSON.stringify(stagioniPrima) !== JSON.stringify(stagioniDopo)) {
        jobs.push({ action: "setStagioni", id: product.id, stagioni });
      }
      if (modello !== (product.modello ?? "")) jobs.push({ action: "setModello", ids: [product.id], modello });
      if (gruppo !== (product.gruppo ?? "")) jobs.push({ action: "setGroup", ids: [product.id], gruppo });
      if (fornitore !== (product.fornitoreUrl ?? "")) jobs.push({ action: "setFornitore", id: product.id, url: fornitore });
      if (price !== (product.priceMin ?? "") || compareAt !== (product.compareAtPrice ?? "")) {
        jobs.push({ action: "setPrice", id: product.id, price, compareAtPrice: compareAt });
      }
      if (status !== product.status) jobs.push({ action: "setStatus", ids: [product.id], status });

      if (!jobs.length) { onSaved(); return; }

      for (const job of jobs) await callProductApi(job);
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const setMain = async (imageId: string) => {
    await run("main", { action: "setMainImage", productId: product.id, imageId });
    setImages((prev) => prev.map((i) => ({ ...i, isMain: i.id === imageId })));
  };

  const deleteImage = async (imageId: string) => {
    await run("img", { action: "deleteImage", productId: product.id, imageId });
    setImages((prev) => prev.filter((i) => i.id !== imageId));
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-tour="edit-dialog" className="flex max-h-[92vh] w-[95vw] max-w-[1400px] flex-col overflow-hidden p-0 sm:max-w-[1400px]">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle className="text-base">{product.title}</DialogTitle>
          <DialogDescription className="flex items-center gap-3 text-xs">
            <span className="font-mono">{product.numericId}</span>
            {!demo && (
              <a href={product.storefrontUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
                Vedi sul sito <ExternalLink className="size-3" />
              </a>
            )}
          </DialogDescription>
        </DialogHeader>

        {err && (
          <p className="mx-6 mt-4 flex items-start gap-2 border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {err}
          </p>
        )}

        {demo && (
          <p className="mx-6 mt-4 flex items-start gap-2 border border-border bg-card/60 p-2 text-xs text-muted-foreground">
            <FlaskConical className="mt-0.5 size-3.5 shrink-0" />
            Prodotto di esempio del tutorial: quello che cambi qui non viene inviato a Shopify.
          </p>
        )}

        <div className="grid flex-1 grid-cols-[380px_1fr] gap-0 overflow-hidden">
          {/* ------------------------------------------------ colonna immagini */}
          <section className="space-y-3 overflow-y-auto border-r border-border p-6 thin-scrollbar">
            <Label className="text-xs">Immagini ({images.length})</Label>
            <p className="text-[10px] text-muted-foreground">
              Passa il mouse su un&apos;immagine per renderla principale o eliminarla da Shopify.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {images.map((img) => (
                <div
                  key={img.id}
                  className={cn(
                    "group relative border",
                    img.isMain ? "border-accent" : "border-border hover:border-border/60"
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt="" className="aspect-square w-full bg-white object-cover" />

                  {img.isMain && (
                    <span className="absolute top-1.5 left-1.5 bg-yellow-400 px-1 text-[9px] font-medium text-black">
                      PRINCIPALE
                    </span>
                  )}

                  {/* azioni: solo al passaggio del mouse. Sinistra = rendi principale, destra = elimina. */}
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                    {!img.isMain && (
                      <button
                        onClick={() => void setMain(img.id)}
                        disabled={busy !== null}
                        title="Rendi principale"
                        className="px-1.5 py-1.5 text-[10px] font-medium text-white hover:text-yellow-400 disabled:opacity-30"
                      >
                        Rendi principale
                      </button>
                    )}
                    <button
                      onClick={() => void deleteImage(img.id)}
                      disabled={busy !== null}
                      title="Elimina immagine"
                      className="ml-auto p-1.5 text-white hover:text-red-400 disabled:opacity-30"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              ))}
              {!images.length && (
                <div className="col-span-2 flex aspect-square items-center justify-center border border-border text-muted-foreground">
                  <ImageOff className="size-5" />
                </div>
              )}
            </div>
          </section>

          {/* ------------------------------------------------ colonna campi */}
          <section className="overflow-y-auto p-6 thin-scrollbar">
            <div className="grid grid-cols-3 gap-5">
              <Field label="Nome prodotto" className="col-span-3">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-9 rounded-none text-sm" />
              </Field>

              <Field label="Brand" className="col-span-3">
                <BrandsPicker
                  value={brands} onChange={setBrands}
                  knownBrands={facets?.brands.map((b) => b.value) ?? []}
                />
              </Field>

              <Field label="Tipo (categoria del capo)">
                <CategoriaPicker
                  value={categoria} onChange={setCategoria}
                  knownCategorie={facets?.categorie.map((c) => c.value) ?? []}
                  autoLabel={product.categoriaForzata ? "Automatica (usa le regole)" : `Automatica — ora: ${product.categoria}`}
                />
              </Field>

              <Field label="Modello (sotto-categoria)">
                <Input
                  value={modello} onChange={(e) => setModello(e.target.value)}
                  placeholder="es. Air Force 1"
                  className="h-9 rounded-none text-sm"
                />
              </Field>

              <Field label="Stagione" className="col-span-3">
                <StagioniPicker value={stagioni} onChange={setStagioni} />
              </Field>

              {/* taglie: si scrivono SUBITO su Shopify, non fanno parte di "Salva modifiche" */}
              <div className="col-span-3">
                <SizesEditor product={product} />
              </div>

              <Field label="Gruppo">
                <Input
                  value={gruppo} onChange={(e) => setGruppo(e.target.value)}
                  list="gruppo-list" placeholder="es. Nike Air Force 1"
                  className="h-9 rounded-none text-sm"
                />
                <datalist id="gruppo-list">
                  {facets?.gruppi.map((g) => <option key={g.value} value={g.value} />) ?? null}
                </datalist>
              </Field>

              <Field label="Link catalogo fornitore" className="col-span-3">
                <Input
                  value={fornitore} onChange={(e) => setFornitore(e.target.value)}
                  placeholder="https://…"
                  className="h-9 rounded-none text-sm"
                />
              </Field>

              <Field label="Prezzo attuale (€)">
                <Input value={price} onChange={(e) => setPrice(e.target.value)} className="h-9 rounded-none text-sm" />
              </Field>

              <Field label="Prezzo non scontato (€)">
                <Input value={compareAt} onChange={(e) => setCompareAt(e.target.value)} placeholder="—" className="h-9 rounded-none text-sm" />
              </Field>

              <Field label="Stato">
                <SelectField value={status} onChange={(v) => setStatus(v as CatalogProduct["status"])}>
                  <option value="ARCHIVED">Archiviato</option>
                  <option value="DRAFT">Draft</option>
                  <option value="ACTIVE">Pubblicato</option>
                </SelectField>
              </Field>
            </div>
          </section>
        </div>

        <DialogFooter className="items-center gap-3 border-t border-border px-6 py-4">
          {onRequestDelete && (
            <Button
              variant="ghost" size="sm"
              className="mr-auto rounded-none text-xs text-destructive hover:text-destructive"
              onClick={onRequestDelete}
            >
              <Trash2 className="size-3" /> Elimina prodotto
            </Button>
          )}
          <Button variant="outline" size="sm" className="rounded-none text-xs" onClick={onClose} disabled={busy !== null}>
            Annulla
          </Button>
          <Button size="sm" className="rounded-none text-xs" onClick={() => void saveAll()} disabled={busy !== null}>
            {busy === "save" ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
            Salva modifiche
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

/** Select nativo con freccia disegnata a mano (staccata dal bordo destro) e stile coerente coi dialog. */
function SelectField({
  value, onChange, children, className,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full appearance-none rounded-none border border-border bg-background py-0 pr-8 pl-2 text-sm outline-none focus:ring-0"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

/* ================================================== eliminazione prodotto */

export function DeleteProductDialog({
  product, onClose, onDeleted,
}: {
  product: CatalogProduct;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [step, setStep] = React.useState(0);
  const [typed, setTyped] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const confirmWord = "ELIMINA";

  const doDelete = async () => {
    setBusy(true);
    setErr(null);
    try {
      await callProductApi({ action: "delete", id: product.id });
      onDeleted();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">
            {step === 0 ? "Eliminare questo prodotto?" : "Conferma definitiva"}
          </DialogTitle>
          <DialogDescription className="text-xs">{product.title}</DialogDescription>
        </DialogHeader>

        {err && <p className="text-xs text-destructive">{err}</p>}

        {step === 0 && (
          <>
            <p className="text-xs text-muted-foreground">
              Il prodotto verrà eliminato <strong>definitivamente</strong> da Shopify. L&apos;operazione
              non è reversibile. Se vuoi solo nasconderlo dal sito, usa invece <em>Archiviato</em> nel popup di modifica.
            </p>
            <DialogFooter>
              <Button variant="outline" size="sm" className="rounded-none text-xs" onClick={onClose}>Annulla</Button>
              <Button variant="destructive" size="sm" className="rounded-none text-xs" onClick={() => setStep(1)}>
                Continua
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 1 && (
          <>
            <p className="text-xs">
              Scrivi <strong className="font-mono">{confirmWord}</strong> per confermare.
            </p>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={confirmWord}
              className="h-8 rounded-none font-mono text-xs"
            />
            <DialogFooter>
              <Button variant="outline" size="sm" className="rounded-none text-xs" onClick={onClose}>Annulla</Button>
              <Button
                variant="destructive" size="sm" className="rounded-none text-xs"
                disabled={typed.trim().toUpperCase() !== confirmWord || busy}
                onClick={() => void doDelete()}
              >
                {busy ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
                Elimina definitivamente
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ==================================================== modifica di gruppo */

/** Raggruppa i motivi di "saltato" per mostrarli compatti nel riepilogo. */
function summarizeSkipped(items: { title?: string; reason: string }[]): { reason: string; count: number; titles: string[] }[] {
  const map = new Map<string, { reason: string; count: number; titles: string[] }>();
  for (const it of items) {
    const e = map.get(it.reason) ?? { reason: it.reason, count: 0, titles: [] };
    e.count++;
    if (it.title && e.titles.length < 5) e.titles.push(it.title);
    map.set(it.reason, e);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

export function BulkEditDialog({
  products, facets, onClose, onDone, onReload,
}: {
  products: CatalogProduct[];
  facets: Facets | null;
  onClose: () => void;
  onDone: () => void;
  /** Ricarica il catalogo senza chiudere il dialog (usata dopo le modifiche alle taglie). */
  onReload?: () => void;
}) {
  const [gruppo, setGruppo] = React.useState("");
  const [brand, setBrand] = React.useState("");
  const [categoria, setCategoria] = React.useState("");
  const [stagioni, setStagioni] = React.useState<string[]>([]);
  const [status, setStatus] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  /* --- taglie in massa: si applicano subito, per gruppo di scala --- */
  const [sizeBusy, setSizeBusy] = React.useState(false);
  const [sizeResult, setSizeResult] = React.useState<{
    label: string;
    updated: number;
    skipped: { id: string; title?: string; reason: string }[];
    failed: { id: string; error: string }[];
  } | null>(null);
  const sizeGroups = React.useMemo(() => groupProductsByScale(products), [products]);

  const applyScale = async (g: ScaleGroup, scale: SizeScale) => {
    setSizeBusy(true);
    setErr(null);
    setSizeResult(null);
    try {
      const action = g.family === "nessuna" ? "sizesBulkCreate" : "sizesBulkAdd";
      const r = await callProductApiResult<{
        updated: number;
        skipped?: { id: string; title?: string; reason: string }[];
        failed?: { id: string; error: string }[];
      }>({ action, ids: g.ids, values: scale.values, name: "Taglia", categoria: g.categoria ?? undefined });
      setSizeResult({
        label: `${scale.label} — ${g.categoria ?? "senza tipo"}${g.family === "nessuna" ? " (senza taglie)" : ` (${FAMILY_HINT[g.family]})`}`,
        updated: r.updated ?? 0,
        skipped: r.skipped ?? [],
        failed: r.failed ?? [],
      });
      onReload?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSizeBusy(false);
    }
  };

  const ids = products.map((p) => p.id);

  /** Se nella selezione ci sono prodotti di esempio del tutorial: non si scrive su Shopify. */
  const demo = products.some((p) => isDemoProduct(p));

  const hasChanges = !!gruppo.trim() || !!brand.trim() || !!categoria || stagioni.length > 0 || !!status;

  const [saveProgress, setSaveProgress] = React.useState<{ done: number; total: number } | null>(null);

  const saveAll = async () => {
    if (demo) { onDone(); return; } // esempio: si chiude senza scrivere niente
    setBusy(true);
    setErr(null);
    setSaveProgress({ done: 0, total: products.length });
    try {
      await callProductApi({ action: "bulkEditGroup", ids, gruppo, brand, categoria, stagioni, status });
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setSaveProgress(null);
    }
  };

  // durante il salvataggio, la barra segue il progresso reale del server (polling).
  React.useEffect(() => {
    if (!busy && !sizeBusy) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await fetch("/api/catalog/product/progress");
        const j = (await r.json()) as { ok: boolean; active: boolean; done: number; total: number };
        if (!cancelled && j.ok && j.total > 0) setSaveProgress({ done: j.done, total: j.total });
      } catch {
        /* la barra resta com'era */
      }
    };
    void tick();
    const id = setInterval(tick, 400);
    return () => { cancelled = true; clearInterval(id); };
  }, [busy, sizeBusy]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-tour="bulk-dialog" className="flex max-h-[90vh] w-[90vw] max-w-[1100px] flex-col overflow-hidden p-0 sm:max-w-[1100px]">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle className="text-base">Modifica di gruppo — {products.length} prodotti</DialogTitle>
          <DialogDescription className="text-xs">
            Le modifiche si applicano a tutti i prodotti selezionati.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto p-6 thin-scrollbar">
          {err && <p className="text-xs text-destructive">{err}</p>}

          {demo && (
            <p className="flex items-start gap-2 border border-border bg-card/60 p-2 text-xs text-muted-foreground">
              <FlaskConical className="mt-0.5 size-3.5 shrink-0" />
              Prodotti di esempio del tutorial: nessuna modifica viene inviata a Shopify.
            </p>
          )}

          <div className="grid grid-cols-2 gap-5">
            <Field label="Imposta gruppo" className="col-span-2">
              <Input
                value={gruppo} onChange={(e) => setGruppo(e.target.value)}
                list="bulk-gruppo" placeholder="es. Nike Air Force 1"
                className="h-9 rounded-none text-sm"
              />
              <datalist id="bulk-gruppo">
                {facets?.gruppi.map((g) => <option key={g.value} value={g.value} />) ?? null}
              </datalist>
            </Field>

            <Field label="Imposta brand">
              <Input value={brand} onChange={(e) => setBrand(e.target.value)} list="bulk-brand" className="h-9 rounded-none text-sm" />
              <datalist id="bulk-brand">
                {facets?.brands.map((b) => <option key={b.value} value={b.value} />) ?? null}
              </datalist>
            </Field>

            <Field label="Imposta tipo (categoria del capo)">
              <CategoriaPicker
                value={categoria} onChange={setCategoria}
                knownCategorie={facets?.categorie.map((c) => c.value) ?? []}
                autoLabel="Nessuna modifica: lascia il tipo attuale di ogni prodotto"
              />
            </Field>

            <Field label="Imposta stagione" className="col-span-2">
              <StagioniPicker value={stagioni} onChange={setStagioni} />
            </Field>

            <Field label="Imposta stato">
              <SelectField value={status} onChange={setStatus}>
                <option value="">—</option>
                <option value="ARCHIVED">Archiviato</option>
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Pubblicato</option>
              </SelectField>
            </Field>

            {/* taglie in massa: raggruppate per scala, si applicano subito */}
            <Field label="Taglie (per gruppo di scala)" className="col-span-2">
              <div className="space-y-2">
                <p className="text-[10px] text-muted-foreground">
                  Le taglie si modificano <span className="text-foreground">solo tra prodotti dello stesso tipo</span>:
                  magliette con magliette, mai magliette + felpe. Ogni riquadro qui sotto è un tipo di capo;
                  si applicano subito (non serve Salva) e su ogni prodotto vengono aggiunte solo le taglie che mancano.
                </p>

                {sizeGroups.map((g) => {
                  const scales = g.family === "nessuna"
                    ? (g.soloVarianteUnica ? SIZE_SCALES : [])
                    : scalesForFamily(g.family);
                  return (
                    <div key={g.key} className="space-y-1.5 border border-border p-2">
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="font-medium">
                          {g.family === "nessuna"
                            ? `${g.categoria ?? "Senza tipo"} — senza taglie${g.soloVarianteUnica ? " (variante unica)" : " (con altre opzioni)"}`
                            : `${g.categoria ?? "Senza tipo"} · ${FAMILY_HINT[g.family]}`}
                        </span>
                        {g.optionNames.length === 1 && g.optionNames[0].trim().toLowerCase() !== "taglia" && (
                          <span className="text-muted-foreground">opzione «{g.optionNames[0]}»</span>
                        )}
                        <span className="text-muted-foreground tabular-nums">{g.ids.length} prodotti</span>
                        <span className="flex-1" />
                        {g.values.length > 0 && (
                          <span className="max-w-[40ch] truncate text-muted-foreground" title={g.values.join(", ")}>
                            ora: {g.values.slice(0, 10).join(", ")}
                            {g.values.length > 10 ? "…" : ""}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {scales.map((s) => {
                          const affected = g.perProduct.filter((vals) => missingFromScale(vals, s).length > 0).length;
                          const toAdd = missingFromScale(g.values, s);
                          return (
                            <button
                              key={s.key}
                              type="button"
                              disabled={sizeBusy || affected === 0}
                              onClick={() => void applyScale(g, s)}
                              title={
                                affected > 0
                                  ? `Aggiorna ${affected} prodotti — aggiunge: ${toAdd.join(", ")}`
                                  : "Nessun prodotto da aggiornare"
                              }
                              className="border border-border px-2 py-1 text-[11px] hover:border-border/60 disabled:opacity-30"
                            >
                              {s.label}
                              <span className="ml-1 text-muted-foreground tabular-nums">
                                {affected > 0 ? `· ${affected}` : "completo"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      {g.family === "mista" && (
                        <p className="text-[10px] text-muted-foreground">
                          Scala mista (numeri + lettere): in massa viene saltata — correggila dal dialog del singolo prodotto.
                        </p>
                      )}
                      {g.family === "nessuna" && !g.soloVarianteUnica && (
                        <p className="text-[10px] text-muted-foreground">
                          Questi prodotti hanno altre opzioni (es. colore) ma nessuna taglia: creare l&apos;opzione in massa
                          moltiplicherebbe le varianti, quindi va fatto dal dialog del singolo prodotto.
                        </p>
                      )}
                    </div>
                  );
                })}

                {sizeResult && (
                  <div className="space-y-1 border border-border p-2 text-[11px]">
                    <p>
                      <span className="font-medium">{sizeResult.label}</span> — aggiornati{" "}
                      <span className="tabular-nums">{sizeResult.updated}</span> prodotti
                      {sizeResult.skipped.length > 0 ? ` · saltati ${sizeResult.skipped.length}` : ""}
                      {sizeResult.failed.length > 0 ? ` · errori ${sizeResult.failed.length}` : ""}
                    </p>
                    {sizeResult.skipped.length > 0 && (
                      <ul className="space-y-0.5 text-muted-foreground">
                        {summarizeSkipped(sizeResult.skipped).map((s) => (
                          <li key={s.reason} className="truncate" title={s.titles.join(" · ")}>
                            <span className="tabular-nums">{s.count}</span>× {s.reason}
                            {s.titles.length > 0 ? ` — es. ${s.titles[0]}` : ""}
                          </li>
                        ))}
                      </ul>
                    )}
                    {sizeResult.failed.length > 0 && (
                      <ul className="space-y-0.5 text-destructive">
                        {sizeResult.failed.slice(0, 5).map((f) => (
                          <li key={f.id} className="truncate" title={f.error}>
                            errore: {f.error}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </Field>
          </div>
        </div>

        <DialogFooter className="flex flex-col gap-2 border-t border-border px-6 py-4">
          {(busy || sizeBusy) && saveProgress && saveProgress.total > 0 && (
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden bg-muted">
                <div
                  className="h-full bg-foreground transition-[width] duration-300 ease-out"
                  style={{ width: `${Math.round((saveProgress.done / saveProgress.total) * 100)}%` }}
                />
              </div>
              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                {saveProgress.done}/{saveProgress.total} prodotti
              </span>
            </div>
          )}
          <div className="flex items-center justify-between gap-4">
            <span className="text-[11px] text-muted-foreground">
              {sizeBusy
                ? "Applico le taglie — non chiudere questa finestra…"
                : busy
                  ? "Salvataggio in corso — non chiudere questa finestra…"
                  : hasChanges ? "Modifiche non ancora salvate" : "Nessuna modifica impostata"}
            </span>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" size="sm" className="rounded-none text-xs" onClick={onClose} disabled={busy}>
                Annulla
              </Button>
              <Button
                size="sm" className="rounded-none text-xs"
                disabled={busy || !hasChanges}
                onClick={() => void saveAll()}
              >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Salva
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { Link2 };
