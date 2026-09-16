/**
 * Tassonomia del catalogo.
 *
 * Il campo "tipo" di Shopify è compilato a mano e mescola tre livelli diversi:
 * il capo ("T-Shirt", "All Hoodies"), il brand ("Corteiz", "Bape", "LV") e il
 * modello ("J4", "AF1", "Dunk", "B27"). Qui lo si riporta a due livelli puliti:
 *
 *   categoria → il capo (Scarpa, Felpa, Maglietta, ...)
 *   modello   → la sottocategoria, soprattutto per le sneakers (Jordan 1, Dunk...)
 *
 * Le regole sono deterministiche e girano al momento della lettura: nessuna
 * scrittura su Shopify, nessuna migrazione. Se un prodotto viene corretto a
 * mano con un tag `categoria:<X>`, quel valore ha la precedenza.
 */

export const CATEGORIE = [
  "Accessorio",
  "Borsa",
  "Ciabatta",
  "Costume",
  "Felpa",
  "Giacca",
  "Gilet",
  "Maglietta",
  "Pantalone",
  "Scarpa",
  "Set",
  "Shorts",
  "Tuta",
] as const;

/** Le 13 categorie di base sono un PUNTO DI PARTENZA, non un elenco chiuso:
 *  scrivendo un tipo nuovo nel form, quello diventa una categoria vera a
 *  tutti gli effetti (compare da quel momento anche nell'autocomplete). */
export type Categoria = string;

/** Valore usato quando le regole non bastano: il prodotto va classificato a mano. */
export const SENZA_CATEGORIA = "Da classificare" as const;

export type CategoriaOrUnknown = Categoria | typeof SENZA_CATEGORIA;

/** Interpreta il valore di un tag categoria:<X> — qualsiasi testo non vuoto è una categoria valida. */
export function parseCategoria(raw: string | null | undefined): Categoria | null {
  if (!raw) return null;
  const s = raw.trim();
  return s.length > 0 ? s : null;
}

/* --------------------------------------------------------------- regole ---
 * L'ordine conta: le regole più specifiche stanno prima. "Sneakers Dior"
 * deve dare Scarpa, non Dior; "Balenciaga Hoodie" deve dare Felpa.
 */
const CATEGORY_RULES: [RegExp, Categoria][] = [
  // --- calzature ---
  // marche il cui nome, da solo, identifica una scarpa
  [
    /\b(new balance|asics|maison mihara|mihara|golden goose|out of office|alexander mq|mcqueen)\b/i,
    "Scarpa",
  ],
  // numeri di modello tipici delle sneaker
  [/\b(530|550|9060|2002r|990|991|992|993|gel-?\w+)\b/i, "Scarpa"],
  // modelli di scarpe
  [/\b(b2[0-9]|b3[0-9])\b/i, "Scarpa"],
  [/\b(j\d{1,2})\b/i, "Scarpa"],
  [/\bjordan/i, "Scarpa"],
  [/\b(af1|air ?force)\b/i, "Scarpa"],
  [/\b(dunk|yeezy|yzy|nocta|trainer|curb|campus|valley dreams)\b/i, "Scarpa"],
  [/\b(tn)\b/i, "Scarpa"],
  [/\b(sneakers?|scarpe?)\b/i, "Scarpa"],
  [/\bshoes?\b/i, "Scarpa"],
  [/\b(boot|stival|tmbr|timberland|ooo\b)/i, "Scarpa"],
  [/\b(slipper|ciabatt)/i, "Ciabatta"],

  // --- abbigliamento ---
  [/\b(hoodie|felpa|hooded)/i, "Felpa"],
  [/\b(t-?shirt|tshirt|tee\b|maglietta|camic)/i, "Maglietta"],
  [/\b(jacket|giacc|bomber|puffer|down jacket)/i, "Giacca"],
  [/\bgilets?\b|\bvests?\b/i, "Gilet"],
  [/\b(tracksuit|traksuit|trak|tuta|tech fleece|sportswear|track ?suit|shell ?suit)/i, "Tuta"],
  [/\b(jeans|denim|pantalon|pants|pant\b|cargo|trousers)/i, "Pantalone"],
  [/\bshorts?\b/i, "Shorts"],
  [/\b(swimsuit|swim ?suit|costume)/i, "Costume"],

  // --- altro ---
  [/\b(bag|backpack|borsa|zaino)/i, "Borsa"],
  [/\b(belt|wallet|sunglasses|beanie|cap\b|underwear|accessor)/i, "Accessorio"],
  [/\b(set|suit|completo)\b/i, "Set"],
];

/** Sottocategorie (modelli), quasi tutte di scarpe. */
const MODEL_RULES: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/\bj(\d{1,2})\b/i, (m) => `Jordan ${m[1]}`],
  [/\bjordan\s*(\d{1,2})/i, (m) => `Jordan ${m[1]}`],
  [/\bjordan\b/i, () => "Jordan"],
  [/\baf1\b|air ?force/i, () => "Air Force 1"],
  [/\bdunk\b/i, () => "Dunk"],
  [/\byeezy\s*(\d{3})/i, (m) => `Yeezy ${m[1]}`],
  [/\b(yeezy|yzy)\b/i, () => "Yeezy"],
  [/\bb(\d{2})\b/i, (m) => `Dior B${m[1]}`],
  [/\bair ?max\s*(\d{2,3})\b/i, (m) => `Air Max ${m[1]}`],
  [/\bair ?max\b/i, () => "Air Max"],
  [/\btn\b/i, () => "Nike TN"],
  [/\bcampus\b/i, () => "Campus"],
  [/\bnocta\b/i, () => "Nocta"],
  [/\bmihara\b/i, () => "Mihara"],
  [/\bnew balance\b/i, () => "New Balance"],
  [/\basics\b/i, () => "Asics"],
  [/\btrainer\b/i, () => "LV Trainer"],
  [/\bcurb\b/i, () => "Lanvin Curb"],
  [/\bvalley dreams\b/i, () => "Valley Dreams"],
  [/\balexander mq|mcqueen\b/i, () => "McQueen Oversized"],
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export interface TaxonomyInput {
  /** Product Type di Shopify (sporca, a mano). */
  tipo?: string | null;
  title?: string | null;
  tags?: string[] | null;
}

export interface Taxonomy {
  categoria: CategoriaOrUnknown;
  /** true se la categoria è stata forzata a mano con un tag `categoria:`. */
  categoriaForzata: boolean;
  modello: string | null;
}

/**
 * Classifica un prodotto in categoria + modello.
 *
 * Precedenza della categoria:
 *   1. tag `categoria:<X>` (correzione manuale)
 *   2. regole sul "tipo" di Shopify
 *   3. regole sul titolo
 */
export function classify({ tipo, title, tags }: TaxonomyInput): Taxonomy {
  const sources = [normalize(tipo ?? ""), normalize(title ?? "")].filter(Boolean);

  let categoria: CategoriaOrUnknown = SENZA_CATEGORIA;
  let categoriaForzata = false;

  // 1. correzione manuale esplicita
  const fromTag = parseCategoria(
    (tags ?? []).map((t) => (t.toLowerCase().startsWith("categoria:") ? t.slice(10) : null)).find(Boolean) ?? null
  );
  if (fromTag) {
    categoria = fromTag;
    categoriaForzata = true;
  } else {
    // 2 e 3. regole
    outer: for (const src of sources) {
      for (const [re, cat] of CATEGORY_RULES) {
        if (re.test(src)) {
          categoria = cat;
          break outer;
        }
      }
    }
  }

  // modello (dalla stessa sorgente, indipendente dalla categoria)
  let modello: string | null = null;
  outer2: for (const src of sources) {
    for (const [re, fn] of MODEL_RULES) {
      const m = src.match(re);
      if (m) {
        modello = fn(m);
        break outer2;
      }
    }
  }

  // il modello ha senso solo per le calzature
  if (categoria !== "Scarpa" && categoria !== "Ciabatta") modello = null;

  return { categoria, categoriaForzata, modello };
}
