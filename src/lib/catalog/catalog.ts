import fs from "fs";
import os from "os";
import path from "path";
import { shopifyGql } from "./shopify";
import { classify, SENZA_CATEGORIA, type CategoriaOrUnknown } from "./taxonomy";
import { writeProgress } from "./progress-store";

/**
 * Catalogo CatalogFlow normalizzato per la UI.
 *
 * Perché esiste questo file: i dati grezzi di Shopify sono incoerenti
 * (vendor = "CatalogFlow" su 2488/2586 prodotti, brand nei tag in due formati,
 * tipo mescolato col brand). Qui li normalizziamo UNA volta in un tipo pulito,
 * così la UI non deve conoscere le stranezze dello store.
 */

export type ProductStatus = "ACTIVE" | "DRAFT" | "ARCHIVED";

export interface CatalogImage {
  id: string;
  url: string;
  alt?: string | null;
  isMain: boolean;
}

export interface CatalogProduct {
  id: string;
  numericId: string;
  title: string;
  handle: string;
  storefrontUrl: string;
  adminUrl: string;
  status: ProductStatus;
  /** Brand principale (dedotto dai tag; il primo se ce ne sono più di uno). Null se non determinabile. */
  brand: string | null;
  /** Tutti i brand (per collab, es. "Nike x Off-White"): 1 elemento nel caso normale, di più solo per le collab. */
  brands: string[];
  /** Categoria merceologica (scarpe, t-shirt...). */
  tipo: string | null;
  /**
   * Categoria NORMALIZZATA (Scarpa, Felpa, ...) — ricavata dalle regole in
   * taxonomy.ts. "Da classificare" quando le regole non bastano.
   */
  categoria: CategoriaOrUnknown;
  /** true se `categoria` è stata imposta a mano con un tag `categoria:`. */
  categoriaForzata: boolean;
  /** Stagione principale (compatibilità: il primo valore, se ce n'è più di uno). */
  stagione: string | null;
  /** Tutte le stagioni selezionate (multi-selezione: es. sia "primavera-estate" che "tutte-le-stagioni"). */
  stagioni: string[];
  /** Modello/sotto-categoria (es. "Jordan 1"), da metafield o dalle regole. */
  modello: string | null;
  /** Raggruppamento esplicito deciso dall'utente (metafield). */
  gruppo: string | null;
  /** Link al catalogo del fornitore (metafield). */
  fornitoreUrl: string | null;
  /** Tag grezzi così come stanno su Shopify. */
  tags: string[];
  /** Prezzo attuale (il più basso tra le varianti). */
  priceMin: string | null;
  priceMax: string | null;
  /** Prezzo "non scontato" (compareAtPrice) più comune. */
  compareAtPrice: string | null;
  images: CatalogImage[];
  variantCount: number;
  /**
   * Opzioni del prodotto con i loro valori (id Shopify inclusi).
   * Servono all'editor taglie: per rinominare/aggiungere/eliminare un valore o
   * riordinarli bisogna passare l'id dell'opzione e dei valori. Il colore è
   * un'opzione come le altre e non va mai toccato dall'editor taglie.
   */
  opzioni: CatalogOption[];
}

export interface CatalogOption {
  id: string;
  name: string;
  position: number;
  valori: { id: string; name: string }[];
}

const PRODUCT_FIELDS = `
      id
      title
      handle
      vendor
      productType
      status
      tags
      updatedAt
      featuredMedia { id }
      media(first: 6) {
        edges {
          node {
            ... on MediaImage {
              id
              image { url altText }
            }
          }
        }
      }
      priceRangeV2 { minVariantPrice { amount } maxVariantPrice { amount } }
      variantsCount { count }
      options { id name position optionValues { id name } }
      compareAt: variants(first: 1) { edges { node { compareAtPrice } } }
      fornitore: metafield(namespace: "custom", key: "fornitore_url") { value }
      modelloMf: metafield(namespace: "custom", key: "modello") { value }
      gruppoMf: metafield(namespace: "custom", key: "gruppo") { value }
`;

const PRODUCTS_COUNT_QUERY = `
query GetCatalogCount {
  productsCount(query: "status:active OR status:draft OR status:archived") { count }
}
`;

const PRODUCTS_QUERY = `
query GetCatalog($cursor: String) {
  products(first: 250, after: $cursor, query: "status:active OR status:draft OR status:archived") {
    pageInfo { hasNextPage endCursor }
    edges { node {
      ${PRODUCT_FIELDS}
    } }
  }
}`;

/** Rilegge UN prodotto solo: usata dopo una scrittura per aggiornare la cache senza ricaricare tutto il catalogo. */
const PRODUCT_QUERY = `
query GetOneProduct($id: ID!) {
  product(id: $id) {
    ${PRODUCT_FIELDS}
  }
}`;

/* ------------------------------------------------------------------ parsing */

/**
 * Il brand vive nei tag in DUE formati storici: "brand:Nike" e "brand-nike".
 * Normalizziamo a un nome leggibile: slug -> Title Case, con eccezioni note.
 */
const BRAND_LABEL_OVERRIDES: Record<string, string> = {
  lv: "Louis Vuitton",
  "louis-vuitton": "Louis Vuitton",
  "off-white": "Off-White",
  offw: "Off-White",
  amiri: "Amiri",
  amr: "Amiri",
  "alexander-mcqueen": "Alexander McQueen",
  "alexander-mq": "Alexander McQueen",
  "denim-tears": "Denim Tears",
  "palm-angels": "Palm Angels",
  supreme: "Supreme",
  sup: "Supreme",
  dsq2: "Dsquared2",
  "chrome-hearts": "Chrome Hearts",
  ch: "Chrome Hearts",
  "gallery-dept": "Gallery Dept.",
  "valley-dreams": "Valley Dreams",
  corteiz: "Corteiz",
  trapstar: "Trapstar",
  represent: "Represent",
  rhude: "Rhude",
  lanvin: "Lanvin",
  kenzo: "Kenzo",
  celine: "Celine",
  burberry: "Burberry",
  moncler: "Moncler",
  prada: "Prada",
  dior: "Dior",
  nike: "Nike",
  balenciaga: "Balenciaga",
  np: "The North Face",
  "the-north-face": "The North Face",
  tnf: "The North Face",
  "stone-island": "Stone Island",
  poloralphlauren: "Polo Ralph Lauren",
  "polo-ralph-lauren": "Polo Ralph Lauren",
  "ralph-lauren": "Polo Ralph Lauren",
  "loro-piana": "Loro Piana",
  "new-balance": "New Balance",
  hellstar: "Hellstar",
  "philipp-plein": "Philipp Plein",
  "philip-plein": "Philipp Plein",
  "maison-mihara": "Maison Mihara",
  "moose-knuckles": "Moose Knuckles",
  sp5der: "Sp5der",
  synaworld: "Syna World",
  "syna-world": "Syna World",
  bape: "Bape",
  asics: "Asics",
  adidas: "Adidas",
  yeezy: "Yeezy",
  jordan: "Jordan",
};

function humanize(slug: string): string {
  return slug
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function brandLabelFromSlug(slug: string): string {
  const key = slug.trim().toLowerCase();
  return BRAND_LABEL_OVERRIDES[key] ?? humanize(slug);
}

/** Estrae il brand dai tag, gestendo entrambi i formati storici. */
export function extractBrand(tags: string[]): string | null {
  // priorità al formato nuovo "brand:X"
  for (const t of tags) {
    if (t.startsWith("brand:")) {
      const v = t.slice("brand:".length).trim();
      if (v) return brandLabelFromSlug(v);
    }
  }
  for (const t of tags) {
    if (t.startsWith("brand-")) {
      const v = t.slice("brand-".length).trim();
      if (v) return brandLabelFromSlug(v);
    }
  }
  return null;
}

/**
 * Tutti i brand di un prodotto (per collab: es. "Nike x Off-White" = 2 brand).
 * Legge SOLO i tag "brand:X" (il formato nuovo, l'unico che supporta più valori
 * — il vecchio "brand-x" resta a singolo valore per compatibilità).
 */
export function extractBrands(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tags) {
    if (t.toLowerCase().startsWith("brand:")) {
      const v = t.slice("brand:".length).trim();
      if (!v) continue;
      const label = brandLabelFromSlug(v);
      const key = label.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push(label);
      }
    }
  }
  if (out.length > 0) return out;
  // fallback: nessun tag brand:X multiplo, usa il brand singolo (anche dal formato legacy)
  const single = extractBrand(tags);
  return single ? [single] : [];
}

export function extractTagValue(tags: string[], prefix: string): string | null {
  for (const t of tags) {
    if (t.toLowerCase().startsWith(prefix.toLowerCase())) {
      const v = t.slice(prefix.length).trim();
      if (v) return v;
    }
  }
  return null;
}

/** Come extractTagValue ma raccoglie TUTTI i valori (per campi multi-selezione, es. stagioni). */
export function extractTagValues(tags: string[], prefix: string): string[] {
  const out: string[] = [];
  for (const t of tags) {
    if (t.toLowerCase().startsWith(prefix.toLowerCase())) {
      const v = t.slice(prefix.length).trim();
      if (v && !out.includes(v)) out.push(v);
    }
  }
  return out;
}

/**
 * Valori storici combinati -> singole stagioni.
 * Servono per non far "sparire" i prodotti taggati prima della multi-selezione.
 */
export const STAGIONE_LEGACY: Record<string, string[]> = {
  "primavera-estate": ["primavera", "estate"],
  "autunno-inverno": ["autunno", "inverno"],
};

/** Espande i vecchi valori combinati nelle singole stagioni, mantenendo l'ordine. */
export function expandStagioni(values: string[]): string[] {
  const out: string[] = [];
  for (const v of values) {
    for (const single of STAGIONE_LEGACY[v] ?? [v]) {
      if (!out.includes(single)) out.push(single);
    }
  }
  return out;
}

/**
 * Il "tipo" (scarpe/t-shirt/...) va derivato: a volte è il productType,
 * a volte è nascosto nel tag tipo:, a volte il productType contiene il brand
 * ("LV JACKETS", "SNEAKERS DIOR"). Puliamo il rumore.
 */
const TIPO_NOISE = [
  "all products", "uncategorized", "best seller", "new arrivals",
  "ready to ship", "drippy summer", "san valentino exclusive",
];

export function deriveTipo(productType: string | null, tags: string[]): string | null {
  const fromTag = extractTagValue(tags, "tipo:");
  if (fromTag) return normalizeTipo(fromTag);

  const pt = (productType ?? "").trim();
  if (!pt) return null;
  if (TIPO_NOISE.includes(pt.toLowerCase())) return null;
  return normalizeTipo(pt);
}

function normalizeTipo(raw: string): string {
  const s = raw.trim();
  if (!s) return s;
  if (s === s.toUpperCase() && s.length > 3) {
    // "T-SHIRT", "ALL HOODIES" -> Title case leggibile
    return s
      .toLowerCase()
      .split(/\s+/)
      .map((w) => (w === "t-shirt" || w === "t-shirt" ? "T-Shirt" : w.charAt(0).toUpperCase() + w.slice(1)))
      .join(" ");
  }
  return s;
}

function shopDomain(): string {
  const domain = process.env.SHOPIFY_DOMAIN;
  if (!domain) throw new Error("SHOPIFY_DOMAIN mancante nelle variabili d'ambiente");
  return domain;
}

/* ------------------------------------------------------------- fetch + cache */

interface RawProduct {
  id: string;
  title: string;
  handle: string;
  vendor: string;
  productType: string;
  status: ProductStatus;
  tags: string[];
  featuredMedia: { id: string } | null;
  media: { edges: { node: { id: string; image: { url: string; altText?: string | null } } | Record<string, never> }[] };
  priceRangeV2: { minVariantPrice: { amount: string }; maxVariantPrice: { amount: string } };
  variantsCount: { count: number };
  compareAt: { edges: { node: { compareAtPrice: string | null } }[] };
  options: { id: string; name: string; position: number; optionValues: { id: string; name: string }[] }[];
  fornitore?: { value: string } | null;
  modelloMf?: { value: string } | null;
  gruppoMf?: { value: string } | null;
}

let cache: { at: number; products: CatalogProduct[] } | null = null;
const CACHE_MS = 10 * 60_000; // 10 minuti
const DISK_CACHE = path.join(os.tmpdir(), "catalog_catalog_cache.json");
const COUNT_FILE = path.join(os.tmpdir(), "catalog_catalog_count.json");

/** Ultimo conteggio reale noto, letto da disco (sopravvive ai cold-start serverless di Vercel). */
function lastKnownCount(): number {
  try {
    const raw = fs.readFileSync(COUNT_FILE, "utf-8");
    const n = (JSON.parse(raw) as { count: number }).count;
    if (Number.isFinite(n) && n > 0) return n;
  } catch {
    /* nessuna stima salvata ancora: va bene, è solo un valore iniziale per la barra */
  }
  return 0;
}

function saveKnownCount(n: number): void {
  try {
    fs.writeFileSync(COUNT_FILE, JSON.stringify({ count: n }));
  } catch {
    /* non critico: la barra userà comunque il conteggio in memoria per questa sessione */
  }
}

/** Stato del caricamento in corso, per mostrare una barra di progresso reale in UI. */
export const loadProgress: { active: boolean; loaded: number; estimatedTotal: number } = {
  active: false,
  loaded: 0,
  // stima iniziale: ultimo conteggio REALE noto (letto da disco); 0 finché non abbiamo mai
  // completato un caricamento — in quel caso la UI mostra solo "N prodotti" senza percentuale.
  estimatedTotal: lastKnownCount(),
};

/** Stato del salvataggio bulk in corso (per la barra di avanzamento nel dialog "Modifica di gruppo"). */
export const bulkEditProgress: { active: boolean; done: number; total: number } = {
  active: false,
  done: 0,
  total: 0,
};

function readDiskCache(force: boolean): CatalogProduct[] | null {
  if (force) return null;
  try {
    const raw = fs.readFileSync(DISK_CACHE, "utf-8");
    const parsed = JSON.parse(raw) as { at: number; products: CatalogProduct[] };
    if (Date.now() - parsed.at < CACHE_MS) return parsed.products;
  } catch {
    /* cache assente o corrotta: si rifà */
  }
  return null;
}

function writeDiskCache(products: CatalogProduct[]): void {
  try {
    fs.writeFileSync(DISK_CACHE, JSON.stringify({ at: Date.now(), products }));
  } catch {
    /* disco pieno/permessi: la cache in memoria basta */
  }
}

export function invalidateCatalogCache(): void {
  cache = null;
  try {
    fs.unlinkSync(DISK_CACHE);
  } catch {
    /* già assente */
  }
}

interface ProductsPage {
  products: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    edges: { node: RawProduct }[];
  };
}

/** Converte un RawProduct (grezzo da Shopify) nel CatalogProduct normalizzato. Riusata sia dal caricamento completo sia dal refresh di un singolo prodotto. */
function parseRawProduct(n: RawProduct, domain: string): CatalogProduct {
  const featuredId = n.featuredMedia?.id ?? null;
  const images: CatalogImage[] = n.media.edges
    .map((e) => e.node)
    .filter((node): node is { id: string; image: { url: string; altText?: string | null } } => "image" in node && !!node.image)
    .map((node) => ({
      id: node.id,
      url: node.image.url,
      alt: node.image.altText,
      isMain: node.id === featuredId,
    }));

  const prices: number[] = [];
  const min = parseFloat(n.priceRangeV2.minVariantPrice.amount);
  const max = parseFloat(n.priceRangeV2.maxVariantPrice.amount);
  if (!isNaN(min)) prices.push(min);
  if (!isNaN(max)) prices.push(max);
  const compareAt = n.compareAt.edges[0]?.node.compareAtPrice ?? null;

  const tax = classify({ tipo: deriveTipo(n.productType, n.tags), title: n.title, tags: n.tags });

  return {
    id: n.id,
    numericId: n.id.split("/").pop() ?? "",
    title: n.title,
    handle: n.handle,
    storefrontUrl: `https://streetdriiipshop.com/products/${n.handle}`,
    adminUrl: `https://admin.shopify.com/store/${domain.split(".")[0]}/products/${n.id.split("/").pop()}`,
    status: n.status,
    brand: extractBrand(n.tags),
    brands: extractBrands(n.tags),
    tipo: deriveTipo(n.productType, n.tags),
    categoria: tax.categoria,
    categoriaForzata: tax.categoriaForzata,
    stagione: extractTagValue(n.tags, "stagione:"),
    stagioni: expandStagioni(extractTagValues(n.tags, "stagione:")),
    modello: tax.modello ?? n.modelloMf?.value ?? null,
    gruppo: n.gruppoMf?.value ?? null,
    fornitoreUrl: n.fornitore?.value ?? null,
    tags: n.tags,
    priceMin: prices.length ? Math.min(...prices).toFixed(2) : null,
    priceMax: prices.length ? Math.max(...prices).toFixed(2) : null,
    compareAtPrice: compareAt,
    images,
    variantCount: n.variantsCount.count,
    opzioni: (n.options ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((o) => ({ id: o.id, name: o.name, position: o.position, valori: o.optionValues ?? [] })),
  };
}

export async function loadCatalog(force = false): Promise<CatalogProduct[]> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.products;

  const fromDisk = readDiskCache(force);
  if (fromDisk) {
    cache = { at: Date.now(), products: fromDisk };
    return fromDisk;
  }

  loadProgress.active = true;
  loadProgress.loaded = 0;
  writeProgress({ active: true, loaded: 0, estimatedTotal: loadProgress.estimatedTotal });
  try {
    // conteggio reale subito, prima di iniziare a paginare: così la barra ha
    // sempre il totale vero fin dal primo istante, anche al primo avvio a freddo
    try {
      const countRes = await shopifyGql<{ productsCount: { count: number } }>(PRODUCTS_COUNT_QUERY);
      if (countRes.productsCount.count > 0) {
        loadProgress.estimatedTotal = countRes.productsCount.count;
        writeProgress({ active: true, loaded: loadProgress.loaded, estimatedTotal: loadProgress.estimatedTotal });
      }
    } catch {
      // se la query di conteggio fallisce non blocchiamo il caricamento:
      // resta la stima precedente (o 0, mostrando una barra indeterminata)
    }

    const out: CatalogProduct[] = [];
    const domain = shopDomain();
    let cursor: string | null = null;
    let hasNext = true;

    while (hasNext) {
      const page: ProductsPage = await shopifyGql<ProductsPage>(PRODUCTS_QUERY, { cursor });

      for (const edge of page.products.edges) {
        out.push(parseRawProduct(edge.node, domain));
      }
      loadProgress.loaded = out.length;
      // scritto su Redis a OGNI pagina (non solo alla fine): è quello che il
      // polling dell'altra istanza legge, altrimenti vedrebbe sempre lo stato iniziale
      writeProgress({ active: true, loaded: loadProgress.loaded, estimatedTotal: loadProgress.estimatedTotal });

      hasNext = page.products.pageInfo.hasNextPage;
      cursor = page.products.pageInfo.endCursor;
    }

    cache = { at: Date.now(), products: out };
    loadProgress.estimatedTotal = out.length; // per la prossima volta, stima più precisa
    saveKnownCount(out.length); // persiste su disco: sopravvive ai cold-start serverless
    writeDiskCache(out);
    return out;
  } finally {
    loadProgress.active = false;
    writeProgress({ active: false, loaded: loadProgress.loaded, estimatedTotal: loadProgress.estimatedTotal });
  }
}

/**
 * Rilegge da Shopify SOLO i prodotti indicati e li sostituisce nella cache esistente
 * (memoria + disco), invece di invalidare tutto e ricaricare 2500+ prodotti.
 * Usata dopo una scrittura: la UI si aggiorna in ~1s invece di ~25s.
 * Se la cache non è ancora popolata, non fa nulla (il prossimo loadCatalog la costruirà da zero).
 */
export async function refreshProductsInCache(ids: string[]): Promise<void> {
  if (!cache || ids.length === 0) return;
  const domain = shopDomain();
  const fresh = new Map<string, CatalogProduct>();

  await Promise.all(
    ids.map(async (id) => {
      try {
        const data = await shopifyGql<{ product: RawProduct | null }>(PRODUCT_QUERY, { id });
        if (data.product) fresh.set(id, parseRawProduct(data.product, domain));
      } catch {
        /* best-effort: se una rilettura fallisce, quel prodotto resta con i dati vecchi
           finché la cache scade naturalmente — non blocchiamo l'intera UI per questo */
      }
    })
  );

  if (fresh.size === 0) return;
  const updated = cache.products.map((p) => fresh.get(p.id) ?? p);
  cache = { at: Date.now(), products: updated };
  writeDiskCache(updated);
}

/** Toglie un prodotto ELIMINATO dalla cache esistente, senza ricaricare tutto. */
export function removeProductFromCache(id: string): void {
  if (!cache) return;
  const updated = cache.products.filter((p) => p.id !== id);
  cache = { at: Date.now(), products: updated };
  writeDiskCache(updated);
}

/* ------------------------------------------------------------------- facets */

export interface Facets {
  brands: { value: string; count: number }[];
  brandsMissing: number;
  /** Categorie normalizzate (capo), in ordine di categoria, senza "Da classificare". */
  categorie: { value: string; count: number }[];
  /** Prodotti che le regole non riescono a classificare. */
  daClassificare: number;
  /** Modelli per categoria: categoria -> modelli disponibili. */
  modelliByCategoria: Record<string, { value: string; count: number }[]>;
  gruppi: { value: string; count: number }[];
}

export function computeFacets(products: CatalogProduct[]): Facets {
  const brands = new Map<string, number>();
  const categorie = new Map<string, number>();
  const gruppi = new Map<string, number>();
  const modelliByCategoria: Record<string, Map<string, number>> = {};
  let brandsMissing = 0;
  let daClassificare = 0;

  for (const p of products) {
    if (p.brands.length > 0) {
      for (const b of p.brands) brands.set(b, (brands.get(b) ?? 0) + 1);
    } else {
      brandsMissing++;
    }

    if (p.categoria === SENZA_CATEGORIA) {
      daClassificare++;
    } else {
      categorie.set(p.categoria, (categorie.get(p.categoria) ?? 0) + 1);
      if (p.modello) {
        modelliByCategoria[p.categoria] ??= new Map();
        const m = modelliByCategoria[p.categoria];
        m.set(p.modello, (m.get(p.modello) ?? 0) + 1);
      }
    }

    if (p.gruppo) gruppi.set(p.gruppo, (gruppi.get(p.gruppo) ?? 0) + 1);
  }

  const toSorted = (m: Map<string, number>) =>
    [...m.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => a.value.localeCompare(b.value, "it", { sensitivity: "base" }));

  const modSort: Record<string, { value: string; count: number }[]> = {};
  for (const [cat, m] of Object.entries(modelliByCategoria)) modSort[cat] = toSorted(m);

  // categorie in ordine alfabetico, come tutti gli altri selettori — tutte quelle
  // realmente presenti nei dati (comprese quelle nuove, non solo le 13 di base)
  const categorieSorted = [...categorie.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value.localeCompare(b.value, "it", { sensitivity: "base" }));

  return {
    brands: toSorted(brands),
    brandsMissing,
    categorie: categorieSorted,
    daClassificare,
    modelliByCategoria: modSort,
    gruppi: toSorted(gruppi),
  };
}
