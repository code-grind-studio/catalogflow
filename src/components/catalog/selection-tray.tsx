"use client";

import * as React from "react";
import { X, Users, ChevronDown, ChevronUp, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CatalogProduct } from "@/lib/catalog/catalog";

/**
 * Pannello di selezione multi-prodotto, ancorato in basso e sempre visibile:
 * mostra quanti prodotti sono selezionati e quali (thumbnail + nome), così
 * anche scorrendo un catalogo di migliaia di righe non si perdono le scelte.
 * Click su una miniatura = torna a quel prodotto nella griglia.
 */
export function SelectionTray({
  products,
  onRemove,
  onClearAll,
  onBulkEdit,
  onJumpTo,
  selectAllCount,
  onSelectAll,
}: {
  products: CatalogProduct[];
  onRemove: (id: string) => void;
  onClearAll: () => void;
  onBulkEdit: () => void;
  onJumpTo: (id: string) => void;
  selectAllCount: number;
  onSelectAll: () => void;
}) {
  const [expanded, setExpanded] = React.useState(true);

  if (products.length === 0) return null;

  return (
    <div data-tour="tray" className="fixed bottom-0 left-0 right-0 z-40 border-t-2 border-accent bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="mx-auto max-w-[1800px] px-6 py-2.5">
        {/* riga comandi */}
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs font-medium">
            <span className="flex size-5 items-center justify-center bg-accent text-[10px] font-bold text-accent-foreground">
              {products.length}
            </span>
            selezionat{products.length === 1 ? "o" : "i"}
          </span>

          <Button data-tour="bulk-edit-btn" variant="outline" size="sm" className="h-7 rounded-none text-xs" onClick={onBulkEdit}>
            <Users className="size-3" /> Modifica di gruppo
          </Button>

          <Button data-tour="select-all-btn" variant="ghost" size="sm" className="h-7 rounded-none text-xs" onClick={onSelectAll}>
            Seleziona tutti i {selectAllCount} filtrati
          </Button>

          <span className="hidden text-[11px] text-muted-foreground sm:inline">
            Trascina il mouse sopra le card per selezionare più prodotti al volo.
          </span>

          <button
            onClick={() => setExpanded((v) => !v)}
            className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {expanded ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
            {expanded ? "Nascondi elenco" : "Mostra elenco"}
          </button>

          <button
            onClick={onClearAll}
            className="flex items-center gap-1 text-xs text-destructive hover:text-destructive/80"
            title="Deseleziona tutto"
          >
            <X className="size-3.5" /> Pulisci
          </button>
        </div>

        {/* elenco dei prodotti selezionati, scorrimento orizzontale */}
        {expanded && (
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1 thin-scrollbar">
            {products.map((p) => {
              const main = p.images.find((i) => i.isMain) ?? p.images[0];
              return (
                <div
                  key={p.id}
                  className="group relative flex w-32 shrink-0 gap-2 border border-border bg-card p-1.5"
                >
                  <button
                    onClick={() => onJumpTo(p.id)}
                    title={`Vai a: ${p.title}`}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    {main ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={main.url} alt="" className="size-8 shrink-0 border border-border bg-white object-cover" />
                    ) : (
                      <span className="flex size-8 shrink-0 items-center justify-center border border-border text-muted-foreground">
                        <ImageOff className="size-3" />
                      </span>
                    )}
                    <span className="line-clamp-2 text-[10px] leading-tight">{p.title}</span>
                  </button>

                  <button
                    onClick={() => onRemove(p.id)}
                    title="Togli dalla selezione"
                    className={cn(
                      "absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center",
                      "bg-destructive text-white opacity-0 transition-opacity group-hover:opacity-100"
                    )}
                  >
                    <X className="size-2.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
