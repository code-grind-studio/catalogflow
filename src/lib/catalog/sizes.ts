/**
 * Taglie: scaglie pronte, riconoscimento della "famiglia" e ordinamento.
 *
 * Perché esiste: sul catalogo l'opzione taglia convive con nomi diversi
 * ("Taglia" 2359 volte, ma anche "Pointure", "Size", "Shoe size", "Numero di
 * scarpa") e con scale diverse (lettere S–XXL, numeri 36–46 con e senza mezze,
 * jeans 28–40, bambino 80–120). Qui stanno le regole UNA volta sola, usate sia
 * dal dialog del singolo prodotto sia dalla modifica di gruppo: così la modifica
 * multipla non può applicare per sbaglio una scala da scarpe a una t-shirt.
 *
 * Nessuna chiamata a Shopify qui dentro: sono funzioni pure, importabili anche
 * dal client.
 */

/** Nome canonico a cui si uniformano i nomi anomali. */
export const CANONICAL_SIZE_OPTION_NAME = "Taglia";

/** Nomi (in ordine di specificità) che indicano l'opzione taglia. */
const SIZE_OPTION_ALIASES = [
  "numero di scarpa",
  "numero scarpa",
  "numero",
  "shoe size",
  "shoe sizes",
  "pointure",
  "taglie",
  "taglia",
  "sizes",
  "size",
  "scarp",
];

const COLOR_OPTION_ALIASES = ["colore", "couleur", "color", "colour", "farbe"];
const TITLE_OPTION_ALIASES = ["title", "titolo"];

function matches(name: string, aliases: string[]): boolean {
  const n = name.trim().toLowerCase();
  return aliases.some((a) => n === a || n.startsWith(a));
}

export function isSizeOptionName(name: string): boolean {
  return matches(name, SIZE_OPTION_ALIASES);
}

export function isColorOptionName(name: string): boolean {
  return matches(name, COLOR_OPTION_ALIASES);
}

export function isTitleOptionName(name: string): boolean {
  return matches(name, TITLE_OPTION_ALIASES);
}

/* --------------------------------------------------------------- famiglie */

export type SizeFamily = "numeri" | "lettere" | "unica" | "mista" | "altro" | "nessuna";

export const FAMILY_LABELS: Record<SizeFamily, string> = {
  numeri: "numeri",
  lettere: "lettere",
  unica: "taglia unica",
  mista: "mista",
  altro: "non standard",
  nessuna: "senza taglie",
};

const LETTER_RANKS: Record<string, number> = {
  xxs: 0, "2xs": 0,
  xs: 1,
  s: 2,
  m: 3,
  l: 4,
  xl: 5,
  xxl: 6, "2xl": 6,
  xxxl: 7, "3xl": 7,
  "4xl": 8,
  "5xl": 9,
  "6xl": 10,
};

const UNICA_VALUES = ["taglia unica", "taglie uniche", "unica", "unico", "uni", "one size", "one-size", "onesize", "os", "u", "n/a"];

export function numericSizeValue(v: string): number | null {
  const s = v.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

export function letterSizeRank(v: string): number | null {
  const key = v.trim().toLowerCase().replace(/\s+/g, "");
  return key in LETTER_RANKS ? LETTER_RANKS[key] : null;
}

export function isUniqueSize(v: string): boolean {
  return UNICA_VALUES.includes(v.trim().toLowerCase());
}

export type SizeValueKind = "numero" | "lettera" | "unica" | "altro";

export function classifySizeValue(v: string): SizeValueKind {
  if (numericSizeValue(v) !== null) return "numero";
  if (letterSizeRank(v) !== null) return "lettera";
  if (isUniqueSize(v)) return "unica";
  return "altro";
}

/**
 * Famiglia di una lista di taglie. Se la lista mescola davvero numeri e lettere
 * (capita: pochi prodotti hanno scale sporche) restituisce "mista": in modifica
 * multipla è il segnale per NON applicare una scala unica.
 */
export function detectFamily(values: string[]): SizeFamily {
  const clean = values.map((v) => v.trim()).filter(Boolean);
  if (clean.length === 0) return "nessuna";

  const counts: Record<SizeValueKind, number> = { numero: 0, lettera: 0, unica: 0, altro: 0 };
  for (const v of clean) counts[classifySizeValue(v)]++;

  const total = clean.length;
  if (counts.numero / total >= 0.8) return "numeri";
  if (counts.lettera / total >= 0.8) return "lettere";
  if (counts.unica === total) return "unica";
  if (counts.numero > 0 && counts.lettera > 0) return "mista";
  return "altro";
}

/** Raggruppa le taglie per famiglia, tenendo l'ordine di arrivo dei gruppi. */
export function groupByFamily(values: string[]): { family: SizeFamily; values: string[] }[] {
  const out: { family: SizeFamily; values: string[] }[] = [];
  for (const v of values) {
    const f = classifySizeValue(v) === "numero" ? "numeri" : classifySizeValue(v) === "lettera" ? "lettere" : classifySizeValue(v) === "unica" ? "unica" : "altro";
    const bucket = out.find((b) => b.family === f);
    if (bucket) bucket.values.push(v);
    else out.push({ family: f, values: [v] });
  }
  return out;
}

/* --------------------------------------------------------------- scaglie */

export interface SizeScale {
  key: string;
  label: string;
  family: SizeFamily;
  values: string[];
}

function numericRange(from: number, to: number, step = 1, decimals = 0): string[] {
  const out: string[] = [];
  for (let v = from; v <= to + 1e-9; v += step) out.push(v.toFixed(decimals));
  return out;
}

export const SIZE_SCALES: SizeScale[] = [
  { key: "shoes-eu-36-46", label: "Scarpe EU 36–46", family: "numeri", values: numericRange(36, 46) },
  { key: "shoes-eu-36-46-half", label: "Scarpe EU 36–46 + mezze", family: "numeri", values: numericRange(36, 46, 0.5, 1) },
  { key: "shoes-eu-35-47", label: "Scarpe EU 35–47", family: "numeri", values: numericRange(35, 47) },
  { key: "jeans-28-40", label: "Jeans 28–40", family: "numeri", values: numericRange(28, 40, 2) },
  { key: "kids-80-120", label: "Bambino 80–120", family: "numeri", values: numericRange(80, 120, 5) },
  { key: "letters-s-xxl", label: "Lettere S–XXL", family: "lettere", values: ["S", "M", "L", "XL", "XXL"] },
  { key: "letters-xs-xxl", label: "Lettere XS–XXL", family: "lettere", values: ["XS", "S", "M", "L", "XL", "XXL"] },
  { key: "letters-xs-xxxl", label: "Lettere XS–XXXL", family: "lettere", values: ["XS", "S", "M", "L", "XL", "XXL", "XXXL"] },
  { key: "one", label: "Taglia unica", family: "unica", values: ["Taglia unica"] },
];

/** Scaglie proponibili per una famiglia (in modifica multipla evita di mescolare scarpe e t-shirt). */
export function scalesForFamily(family: SizeFamily): SizeScale[] {
  if (family === "nessuna" || family === "mista") return SIZE_SCALES;
  return SIZE_SCALES.filter((s) => s.family === family);
}

export const SCALES_BY_KEY: Record<string, SizeScale> = Object.fromEntries(SIZE_SCALES.map((s) => [s.key, s]));

/* ------------------------------------------------------------ ordinamento */

/** Chiave di confronto: "36" == "36.0", "m" == "M". */
export function sizeKey(v: string): string {
  const n = numericSizeValue(v);
  if (n !== null) return `0:${String(n).padStart(8, "0")}`;
  const l = letterSizeRank(v);
  if (l !== null) return `1:${String(l).padStart(3, "0")}`;
  if (isUniqueSize(v)) return "2:000";
  return `3:${v.trim().toLowerCase()}`;
}

const GROUP_RANK: Record<SizeValueKind, number> = { numero: 0, lettera: 1, unica: 2, altro: 3 };

/**
 * Ordina le taglie come le vuole vedere un cliente: numeri crescenti (con le
 * mezze al posto giusto), poi XS→XXXL, poi "Taglia unica", poi il resto.
 */
export function sortSizeValues(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))]
    .map((v) => ({ v, kind: classifySizeValue(v), num: numericSizeValue(v), letter: letterSizeRank(v) }))
    .sort((a, b) => {
      const g = GROUP_RANK[a.kind] - GROUP_RANK[b.kind];
      if (g !== 0) return g;
      if (a.kind === "numero" && b.kind === "numero") return (a.num ?? 0) - (b.num ?? 0);
      if (a.kind === "lettera" && b.kind === "lettera") return (a.letter ?? 0) - (b.letter ?? 0);
      return a.v.localeCompare(b.v, "it", { sensitivity: "base" });
    })
    .map((x) => x.v);
}

/** true se l'ordine è già quello "giusto" (per nascondere il pulsante Ordina). */
export function isSorted(values: string[]): boolean {
  const clean = values.map((v) => v.trim()).filter(Boolean);
  const sorted = sortSizeValues(clean);
  return clean.every((v, i) => sizeKey(v) === sizeKey(sorted[i]));
}

/** Taglie della scala non ancora presenti (confronto per chiave: 36 == 36.0, m == M). */
export function missingFromScale(existing: string[], scale: SizeScale): string[] {
  const have = new Set(existing.map(sizeKey));
  return scale.values.filter((v) => !have.has(sizeKey(v)));
}

/* ------------------------------------------- scale coerenti con la categoria */

/**
 * Quali scale hanno senso per un prodotto che non ha ancora l'opzione taglia,
 * dedotte dalla categoria del capo: Scarpa -> numeri, Maglietta -> lettere,
 * Borsa -> taglia unica. Serve a non proporre 36–46 a una felpa.
 */
export function scalesForCategoria(categoria: string | null | undefined): SizeScale[] {
  const c = (categoria ?? "").trim().toLowerCase();
  const contains = (keys: string[]) => keys.some((k) => c.includes(k));
  const byKey = (keys: string[]) => keys.map((k) => SCALES_BY_KEY[k]).filter(Boolean);

  if (contains(["scarpa", "ciabatta", "stivale", "boot", "sneaker", "sandalo", "mocassino"])) {
    return byKey(["shoes-eu-36-46", "shoes-eu-36-46-half", "shoes-eu-35-47"]);
  }
  if (contains(["maglietta", "t-shirt", "felpa", "giacca", "gilet", "pantalone", "shorts", "tuta", "costume", "set", "camicia", "canotta"])) {
    return byKey(["letters-s-xxl", "letters-xs-xxl", "letters-xs-xxxl"]);
  }
  if (contains(["borsa", "zaino", "accessorio", "cappello", "berretto", "cintura"])) {
    return byKey(["one", "letters-s-xxl"]);
  }
  // categoria ignota / "Da classificare": le tre più probabili, niente di più
  return byKey(["shoes-eu-36-46", "letters-s-xxl", "one"]);
}

/* -------------------------------------- suggerimenti dedotti dal prodotto */

/** Sequenza delle taglie a lettere, crescente (per sapere qual è "la successiva"). */
const LETTER_SEQUENCE: { label: string; key: string }[] = [
  { label: "XXS", key: "xxs" }, { label: "XS", key: "xs" }, { label: "S", key: "s" },
  { label: "M", key: "m" }, { label: "L", key: "l" }, { label: "XL", key: "xl" },
  { label: "XXL", key: "xxl" }, { label: "XXXL", key: "xxxl" },
  { label: "4XL", key: "4xl" }, { label: "5XL", key: "5xl" }, { label: "6XL", key: "6xl" },
];

function formatNumeric(n: number): string {
  return Number.isInteger(n) ? String(n) : String(+n.toFixed(1));
}

/**
 * Le taglie che ha senso proporre per QUESTO prodotto, dedotte dai valori che ha già:
 * prima i buchi interni della serie (36,37,39 -> 38), poi il valore successivo
 * nella stessa scala (…46 -> 47, …XL -> XXL, 28,30,… -> 42).
 * Non inventa nulla: se la serie non è regolare non propone niente.
 */
export function nextSizeSuggestions(values: string[], max = 3): string[] {
  const clean = values.map((v) => v.trim()).filter(Boolean);
  if (clean.length < 2) return [];

  const nums = clean.map(numericSizeValue);
  if (nums.every((n) => n !== null)) {
    const arr = (nums as number[]).slice().sort((a, b) => a - b);
    const diffs = arr.slice(1).map((v, i) => +(v - arr[i]).toFixed(3)).filter((d) => d > 0);
    if (!diffs.length) return [];

    // Passo tipico = mediana dei salti (non il minimo: un mezzo numero isolato non
    // deve far credere che tutta la serie vada di mezzo punto).
    const sortedDiffs = [...diffs].sort((a, b) => a - b);
    const step = sortedDiffs[Math.floor((sortedDiffs.length - 1) / 2)];
    if (![0.5, 1, 2, 5].includes(step)) return [];
    // ...e la serie deve essere una griglia regolare: ogni salto multiplo del passo.
    if (!diffs.every((d) => Math.abs(d / step - Math.round(d / step)) < 1e-6)) return [];

    const last = arr[arr.length - 1];
    const out: string[] = [];

    // 1) buchi interni, se la serie è abbastanza densa da essere una griglia
    if (arr.length >= 3) {
      const gaps: number[] = [];
      for (let v = arr[0] + step; v < last - 1e-9; v += step) {
        const val = +v.toFixed(3);
        if (!arr.some((x) => Math.abs(x - val) < 1e-9)) gaps.push(val);
      }
      const span = (last - arr[0]) / step + 1;
      if (gaps.length > 0 && gaps.length / span <= 0.34) out.push(...gaps.map(formatNumeric));
    }

    // 2) il valore successivo nella stessa scala (uno solo: è la taglia "in più")
    if (out.length < max) out.push(formatNumeric(+(last + step).toFixed(3)));
    return out.slice(0, max);
  }

  const ranks = clean.map(letterSizeRank);
  if (ranks.every((r) => r !== null) && ranks.length === clean.length) {
    const highest = Math.max(...(ranks as number[]));
    // solo la lettera successiva: oltre non è più "questo prodotto"
    return LETTER_SEQUENCE.filter((x) => (LETTER_RANKS[x.key] ?? -1) > highest)
      .slice(0, 1)
      .map((x) => x.label);
  }
  return [];
}

/* -------------------------------------------------- scelta dell'opzione */

export interface OptionLike {
  id: string;
  name: string;
}

/**
 * Quale opzione è "la taglia" di questo prodotto.
 * 1) il nome lo dice (Taglia/Pointure/Size/Numero di scarpa…)
 * 2) altrimenti la prima opzione che NON è colore né "Title"
 * 3) altrimenti nessuna (prodotto a variante unica "Default Title")
 */
export function pickSizeOption<T extends OptionLike>(options: T[]): T | null {
  const byName = options.find((o) => isSizeOptionName(o.name));
  if (byName) return byName;
  const other = options.find((o) => !isColorOptionName(o.name) && !isTitleOptionName(o.name));
  return other ?? null;
}

/* ---------------------------------------- raggruppamento per scala (bulk) */

/** Forma minima di un prodotto per raggrupparlo per scala (id + opzioni + nº varianti + tipo). */
export interface ProductWithOptions {
  id: string;
  opzioni: { id: string; name: string; valori: { id: string; name: string }[] }[];
  variantCount?: number;
  /** Categoria del capo (Maglietta, Felpa, Scarpa…): le taglie si modificano in massa solo tra capi dello STESSO tipo. */
  categoria?: string;
}

export interface ScaleGroup {
  key: string;
  /** Nomi delle opzioni taglia presenti nel gruppo (di solito uno solo). */
  optionNames: string[];
  family: SizeFamily;
  /** Tipo di capo del gruppo: magliette con magliette, mai magliette + felpe. */
  categoria: string | null;
  ids: string[];
  /** Unione delle taglie presenti nel gruppo (per i tooltip) e valori prodotto per prodotto. */
  values: string[];
  perProduct: string[][];
  /** true se tutti i prodotti del gruppo hanno una sola variante (quindi le taglie si possono CREARE). */
  soloVarianteUnica: boolean;
}

/**
 * Raggruppa i prodotti per TIPO e scala di taglie: chiave = categoria + famiglia
 * (+ variante unica/multipla per i prodotti senza taglia). Il NOME dell'opzione
 * non entra nella chiave: "Taglia" e "Pointure" sullo stesso tipo di capo sono
 * lo stesso gruppo. Una maglietta e una felpa — anche se entrambe a lettere —
 * restano separate: la scala si applica solo a capi dello stesso tipo.
 */
export function groupProductsByScale(products: ProductWithOptions[]): ScaleGroup[] {
  const map = new Map<string, ScaleGroup>();
  for (const p of products) {
    const opt = pickSizeOption(p.opzioni ?? []);
    const values = opt?.valori.map((v) => v.name) ?? [];
    const family: SizeFamily = opt ? detectFamily(values) : "nessuna";
    const categoria = (p.categoria ?? "").trim() || null;
    const single = (p.variantCount ?? 1) === 1;
    const key = [
      (categoria ?? "∅").toLowerCase(),
      family,
      family === "nessuna" ? (single ? "singola" : "multipla") : "",
    ].join("|");
    let g = map.get(key);
    if (!g) {
      g = { key, optionNames: [], family, categoria, ids: [], values: [], perProduct: [], soloVarianteUnica: true };
      map.set(key, g);
    }
    g.ids.push(p.id);
    g.perProduct.push(values);
    if ((p.variantCount ?? 1) > 1) g.soloVarianteUnica = false;
    if (opt && !g.optionNames.some((n) => n.toLowerCase() === opt.name.toLowerCase())) g.optionNames.push(opt.name);
    for (const v of values) if (!g.values.some((x) => x.toLowerCase() === v.toLowerCase())) g.values.push(v);
  }
  return [...map.values()].sort((a, b) => b.ids.length - a.ids.length);
}
