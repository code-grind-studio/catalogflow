import type { CatalogProduct } from "./catalog";

/**
 * Suggerimento automatico dei gruppi di prodotti.
 *
 * Due criteri (l'utente conferma o corregge, non decidiamo noi):
 *  1. Varianti colore dello stesso modello: prodotti con lo stesso titolo "base"
 *     che differiscono solo per il colore (es. "AF1 ROPE – RED/BEIGE/BLACK").
 *  2. Stesso modello/brand: tutte le Air Force 1, tutte le Air Max 90.
 */

/** Parole-colore: se due titoli differiscono solo per queste, sono varianti. */
const COLOR_WORDS = [
  "black", "white", "grey", "gray", "red", "blue", "green", "yellow",
  "pink", "purple", "orange", "brown", "beige", "cream", "navy", "silver",
  "gold", "neon", "multicolor", "khaki", "burgundy", "taupe", "military",
  "total", "ice", "flavours", "light", "dark", "deep", "bone", "sand",
  "nero", "bianco", "grigio", "rosso", "blu", "verde", "giallo", "rosa",
  "viola", "marrone", "avorio", "argento", "oro",
];

function stripColorWords(title: string): string {
  const lower = title.toLowerCase();
  const cleaned = lower
    .split(/[\s/,–—-]+/)
    .filter((w) => w && !COLOR_WORDS.includes(w))
    .join(" ")
    .trim();
  return cleaned;
}

/** Normalizza un titolo per il confronto: toglie suffissi di taglia, emoji, ecc. */
function baseKey(title: string): string {
  return stripColorWords(
    title
      .replace(/taglie?\s*\d+[\s–—-]*\d*/gi, "")
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
      .replace(/\|[^|]*$/g, "")
      .replace(/\s*–\s*uomo donna.*$/i, "")
      .replace(/\s+/g, " ")
      .trim()
  );
}

export interface SuggestedGroup {
  /** Nome proposto per il gruppo. */
  label: string;
  /** Come è stato suggerito. */
  reason: "color-variants" | "same-model";
  productIds: string[];
  /** true se un gruppo con questo nome è già assegnato esplicitamente. */
  alreadyAssigned: boolean;
}

export function suggestGroups(products: CatalogProduct[], minSize = 2): SuggestedGroup[] {
  const byBase = new Map<string, CatalogProduct[]>();
  const byModel = new Map<string, CatalogProduct[]>();

  for (const p of products) {
    const bk = baseKey(p.title);
    if (bk.length >= 4) {
      if (!byBase.has(bk)) byBase.set(bk, []);
      byBase.get(bk)!.push(p);
    }
    if (p.modello && p.brand) {
      const mk = `${p.brand}::${p.modello}`;
      if (!byModel.has(mk)) byModel.set(mk, []);
      byModel.get(mk)!.push(p);
    }
  }

  const out: SuggestedGroup[] = [];
  const usedBase = new Set<string>();

  // 1. varianti colore
  for (const [bk, group] of byBase) {
    if (group.length < minSize) continue;
    // devono avere almeno 2 titoli distinti (altrimenti è un duplicato, non un gruppo colore)
    const distinctTitles = new Set(group.map((g) => g.title.toLowerCase()));
    if (distinctTitles.size < 2) continue;
    usedBase.add(bk);
    const label = titleCase(bk);
    out.push({
      label,
      reason: "color-variants",
      productIds: group.map((g) => g.id),
      alreadyAssigned: group.every((g) => g.gruppo === label),
    });
  }

  // 2. stesso modello+brand
  for (const [mk, group] of byModel) {
    if (group.length < minSize) continue;
    const label = `${mk.split("::")[0]} ${mk.split("::")[1]}`;
    if (group.every((g) => g.gruppo === label)) continue;
    out.push({
      label,
      reason: "same-model",
      productIds: group.map((g) => g.id),
      alreadyAssigned: group.every((g) => g.gruppo === label),
    });
  }

  return out.sort((a, b) => b.productIds.length - a.productIds.length);
}

function titleCase(s: string): string {
  return s
    .split(" ")
    .filter(Boolean)
    .map((w) => (w.length <= 3 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

/** Palette per colorare i gruppi nella UI (muted, coerente col tema). */
export const GROUP_COLORS = [
  "#e5484d", "#e5a13a", "#d6d63a", "#46a758", "#3aa8a1",
  "#3a7fe5", "#7e57c2", "#c2449a", "#8d6e63", "#78909c",
];

export function groupColor(label: string): string {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0;
  return GROUP_COLORS[h % GROUP_COLORS.length];
}
