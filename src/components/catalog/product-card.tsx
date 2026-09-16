"use client";

import * as React from "react";
import { ImageOff, AlertTriangle, Link2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CatalogProduct } from "@/lib/catalog/catalog";
import { groupColor } from "@/lib/catalog/groups";

function priceLabel(p: CatalogProduct): string {
  if (!p.priceMin) return "—";
  if (p.priceMax && p.priceMax !== p.priceMin) return `€${p.priceMin}–${p.priceMax}`;
  return `€${p.priceMin}`;
}

/**
 * Card prodotto stile shop.
 * - Click sull'IMMAGINE -> popup di modifica (azione principale nel catalogo).
 * - Click sul NOME -> apre il prodotto sul sito pubblico (front-end).
 * - Checkbox di selezione: invisibile di default, appare al hover (o se già
 *   selezionata). Il brand non si ripete in card: si sta già dentro la
 *   sezione di quel brand.
 * L'ID prodotto non appare: è un dato tecnico, vive solo nel popup.
 */
export function ProductCard({
  product: p, selected, onToggleSelect, onEdit, dense, selectionMode,
  onDragSelectStart,
}: {
  product: CatalogProduct;
  selected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  /** true quando la vista è molto compatta (12/riga): il prezzo barrato va a capo. */
  dense?: boolean;
  /** true appena c'è almeno un prodotto selezionato: il click sull'immagine seleziona invece di aprire il popup. */
  selectionMode?: boolean;
  /** Trascinamento stile "Foto" di Apple: tieni premuto e scorri sopra più card per selezionarle tutte. */
  onDragSelectStart?: () => void;
}) {
  const color = p.gruppo ? groupColor(p.gruppo) : null;
  const main = p.images.find((i) => i.isMain) ?? p.images[0];
  const isOff = p.status !== "ACTIVE";

  return (
    <div
      className={cn(
        "group relative flex flex-col border bg-card transition-colors duration-100",
        selected ? "border-accent" : "border-border hover:border-border/60"
      )}
      onMouseDown={onDragSelectStart}
    >
      {color && <div className="absolute top-0 left-0 z-10 h-full w-1" style={{ backgroundColor: color }} />}

      {/* selezione: cerchio stile "app foto" — vuoto di default, pieno con spunta quando selezionato.
          In modalità selezione resta sempre visibile (non solo in hover), per capire a colpo d'occhio cosa è selezionato. */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
        title="Seleziona per modificare più prodotti insieme"
        aria-pressed={selected}
        aria-label={`Seleziona ${p.title}`}
        className={cn(
          "absolute top-2 left-2 z-10 flex size-5 items-center justify-center rounded-full border-2 transition-colors duration-100",
          selected
            ? "border-foreground bg-foreground opacity-100"
            : selectionMode
              ? "border-white/90 bg-black/20 opacity-100"
              : "border-white/90 bg-black/20 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        )}
      >
        {selected && <Check className="size-3 text-background" strokeWidth={3} />}
      </button>

      {/* stato non pubblicato */}
      {isOff && (
        <span
          className="absolute top-2 right-2 z-10 flex size-5 items-center justify-center bg-background/80 backdrop-blur-sm text-destructive"
          title={p.status === "DRAFT" ? "In draft" : "Archiviato"}
        >
          <AlertTriangle className="size-3.5" />
        </span>
      )}

      {/* immagine: normalmente apre il popup di modifica; in modalità selezione seleziona/deseleziona
          l'intero prodotto (non solo il cerchio) — più facile da colpire scorrendo veloce. */}
      <button
        type="button"
        onClick={() => (selectionMode ? onToggleSelect() : onEdit())}
        title={selectionMode ? "Seleziona/deseleziona" : "Modifica prodotto"}
        className="block aspect-square w-full touch-none overflow-hidden bg-white select-none"
      >
        {main ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={main.url}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            className="size-full object-cover transition-transform group-hover:scale-[1.02]"
          />
        ) : (
          <span className="flex size-full items-center justify-center text-neutral-400">
            <ImageOff className="size-6" />
          </span>
        )}
      </button>

      {/* corpo card */}
      <div className="flex flex-1 flex-col gap-1.5 bg-card p-3">
        <div className="flex items-start justify-between gap-1.5">
          {/* nome: click = apri il prodotto sul sito pubblico */}
          <a
            href={p.storefrontUrl}
            target="_blank"
            rel="noreferrer"
            title={`Apri "${p.title}" sul sito`}
            className="line-clamp-2 text-left text-xs leading-snug hover:underline"
          >
            {p.title}
            {p.brands.length > 1 && (
              <span className="ml-1 text-[10px] text-muted-foreground" title={`Collab: ${p.brands.join(" x ")}`}>
                ({p.brands.join(" x ")})
              </span>
            )}
          </a>
          {p.fornitoreUrl && (
            <a
              href={p.fornitoreUrl} target="_blank" rel="noreferrer"
              title="Catalogo fornitore"
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <Link2 className="size-3" />
            </a>
          )}
        </div>

        <div
          className={cn(
            "mt-auto flex items-baseline gap-1.5 pt-1.5",
            dense && "flex-wrap"
          )}
        >
          <span className="text-xs font-medium">{priceLabel(p)}</span>
          {p.compareAtPrice && (
            <span className={cn("text-[10px] text-muted-foreground", dense && "basis-full")}>
              €{p.compareAtPrice}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
