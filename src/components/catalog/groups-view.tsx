"use client";

import * as React from "react";
import { Sparkles, Users } from "lucide-react";
import type { CatalogProduct } from "@/lib/catalog/catalog";
import type { SuggestedGroup } from "@/lib/catalog/groups";
import { groupColor } from "@/lib/catalog/groups";

/**
 * Vista Gruppi, pensata per schermo desktop: griglia di card larghe,
 * ogni gruppo ha una banda colorata sinistra E destra (coerenza col
 * pallino colorato usato nella tabella) e mostra le thumbnail dei
 * prodotti che contiene. Click su una card = seleziona quel gruppo per
 * la modifica bulk; i suggerimenti automatici restano separati, in fondo.
 */

interface GroupCard {
  label: string;
  products: CatalogProduct[];
  isSuggestion: boolean;
  suggestionReason?: "color-variants" | "same-model";
}

export function GroupsView({
  products,
  suggestions,
  onEditGroup,
}: {
  products: CatalogProduct[];
  suggestions: SuggestedGroup[];
  /** Apre il bulk-edit precompilato su questo set di prodotti (gruppo esistente o suggerito). */
  onEditGroup: (products: CatalogProduct[], presetLabel?: string) => void;
}) {
  const existingGroups = React.useMemo<GroupCard[]>(() => {
    const map = new Map<string, CatalogProduct[]>();
    for (const p of products) {
      if (!p.gruppo) continue;
      if (!map.has(p.gruppo)) map.set(p.gruppo, []);
      map.get(p.gruppo)!.push(p);
    }
    return [...map.entries()]
      .map(([label, prods]) => ({ label, products: prods, isSuggestion: false }))
      .sort((a, b) => b.products.length - a.products.length);
  }, [products]);

  const existingLabels = React.useMemo(() => new Set(existingGroups.map((g) => g.label)), [existingGroups]);

  const suggestionCards = React.useMemo<GroupCard[]>(() => {
    return suggestions
      .filter((s) => !existingLabels.has(s.label))
      .map((s) => ({
        label: s.label,
        products: products.filter((p) => s.productIds.includes(p.id)),
        isSuggestion: true,
        suggestionReason: s.reason,
      }))
      .filter((c) => c.products.length >= 2);
  }, [suggestions, products, existingLabels]);

  const ungrouped = products.filter((p) => !p.gruppo).length;

  return (
    <div className="space-y-8">
      {existingGroups.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Gruppi attivi ({existingGroups.length})
          </h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {existingGroups.map((g) => (
              <GroupCardView key={g.label} group={g} onClick={() => onEditGroup(g.products, g.label)} />
            ))}
          </div>
        </section>
      )}

      {suggestionCards.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <Sparkles className="size-3.5" /> Suggeriti automaticamente ({suggestionCards.length})
          </h2>
          <p className="text-xs text-muted-foreground">
            Non ancora assegnati come gruppo. Click su una card per crearlo e assegnarlo.
          </p>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {suggestionCards.slice(0, 30).map((g) => (
              <GroupCardView
                key={`sugg-${g.label}`}
                group={g}
                onClick={() => onEditGroup(g.products, g.label)}
              />
            ))}
          </div>
        </section>
      )}

      {existingGroups.length === 0 && suggestionCards.length === 0 && (
        <div className="flex h-40 items-center justify-center border border-dashed border-border text-sm text-muted-foreground">
          Nessun gruppo ancora. Seleziona prodotti nella tabella e usa &quot;Modifica di gruppo&quot;.
        </div>
      )}

      {ungrouped > 0 && (
        <p className="text-xs text-muted-foreground">
          {ungrouped} prodotti non appartengono a nessun gruppo.
        </p>
      )}
    </div>
  );
}

function GroupCardView({ group, onClick }: { group: GroupCard; onClick: () => void }) {
  const color = groupColor(group.label);
  const preview = group.products.slice(0, 6);

  return (
    <button
      onClick={onClick}
      className="group flex items-stretch border border-border text-left transition-colors hover:border-border/60 hover:bg-muted/20"
    >
      {/* banda colorata margine sinistro */}
      <div className="w-1.5 shrink-0" style={{ backgroundColor: color }} />

      <div className="flex-1 space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-medium">{group.label}</h3>
            <p className="text-xs text-muted-foreground">
              {group.products.length} prodotti
              {group.isSuggestion && (
                <span className="ml-1.5 inline-flex items-center gap-1 text-[10px] text-accent-foreground/70">
                  <Sparkles className="size-2.5" />
                  {group.suggestionReason === "color-variants" ? "varianti colore" : "stesso modello"}
                </span>
              )}
            </p>
          </div>
          <Users className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
        </div>

        <div className="flex gap-1.5">
          {preview.map((p) => {
            const main = p.images.find((i) => i.isMain) ?? p.images[0];
            return main ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={p.id}
                src={main.url}
                alt=""
                loading="lazy"
                className="size-12 shrink-0 border border-border object-cover"
              />
            ) : (
              <div key={p.id} className="size-12 shrink-0 border border-border bg-muted/40" />
            );
          })}
          {group.products.length > preview.length && (
            <div className="flex size-12 shrink-0 items-center justify-center border border-border text-[10px] text-muted-foreground">
              +{group.products.length - preview.length}
            </div>
          )}
        </div>
      </div>

      {/* banda colorata margine destro */}
      <div className="w-1.5 shrink-0" style={{ backgroundColor: color }} />
    </button>
  );
}
