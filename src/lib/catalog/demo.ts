import type { CatalogImage, CatalogProduct } from "@/lib/catalog/catalog";

/**
 * Prodotti di esempio del tutorial: esistono SOLO dentro la pagina, non su
 * Shopify. Gli id iniziano con "demo-" e l'API non li lascia mai passare allo
 * store (vedi il controllo in /api/catalog/product): servono a spiegare le
 * schermate di modifica, modifica di gruppo e selezione rapida senza toccare
 * il catalogo vero.
 */

export const DEMO_PREFIX = "demo-";

/** Etichetta del finto brand: la sezione dei prodotti di esempio sta sempre in cima. */
export const DEMO_BRAND = "Prodotti di esempio";

export function isDemoId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith(DEMO_PREFIX);
}

export function isDemoProduct(p: { id?: string } | null | undefined): boolean {
  return isDemoId(p?.id);
}

/** Immagine segnaposto disegnata in locale (nessuna chiamata di rete). */
function demoImage(label: string, tone: string, bg: string): CatalogImage {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">` +
    `<rect width="400" height="400" fill="${bg}"/>` +
    `<rect x="0" y="0" width="400" height="6" fill="${tone}"/>` +
    `<text x="200" y="188" font-family="system-ui,-apple-system,sans-serif" font-size="30" font-weight="700" fill="#71717a" text-anchor="middle">ESEMPIO</text>` +
    `<text x="200" y="228" font-family="system-ui,-apple-system,sans-serif" font-size="19" fill="#a1a1aa" text-anchor="middle">${label}</text>` +
    `<text x="200" y="352" font-family="system-ui,-apple-system,sans-serif" font-size="15" fill="#d4d4d8" text-anchor="middle">prodotto finto del tutorial</text>` +
    `</svg>`;
  return { id: `demo-img-${label}`, url: `data:image/svg+xml,${encodeURIComponent(svg)}`, alt: label, isMain: true };
}

interface DemoSeed {
  n: number;
  title: string;
  tipo: string;
  categoria: string;
  modello: string;
  price: string;
  compareAt: string | null;
  status: "ACTIVE" | "DRAFT";
  tone: string;
  bg: string;
}

const SEEDS: DemoSeed[] = [
  { n: 1, title: "Sneaker di esempio", tipo: "Scarpe", categoria: "Scarpa", modello: "Esempio 1", price: "89.90", compareAt: "129.90", status: "ACTIVE", tone: "#e11d48", bg: "#fef2f2" },
  { n: 2, title: "Felpa di esempio", tipo: "Felpe", categoria: "Felpa", modello: "Esempio 2", price: "69.90", compareAt: null, status: "ACTIVE", tone: "#52525b", bg: "#f4f4f5" },
  { n: 3, title: "T-shirt di esempio", tipo: "Magliette", categoria: "Maglietta", modello: "Esempio 3", price: "24.90", compareAt: "34.90", status: "ACTIVE", tone: "#2563eb", bg: "#eff6ff" },
  { n: 4, title: "Cappellino di esempio", tipo: "Accessori", categoria: "Accessorio", modello: "Esempio 4", price: "29.90", compareAt: null, status: "ACTIVE", tone: "#ca8a04", bg: "#fefce8" },
];

/** I 4 prodotti finti usati dal tutorial (id "demo-1" … "demo-4"). */
export const DEMO_PRODUCTS: CatalogProduct[] = SEEDS.map((s) => {
  const id = `${DEMO_PREFIX}${s.n}`;
  const handle = `prodotto-di-esempio-${s.n}`;
  return {
    id,
    numericId: id,
    title: s.title,
    handle,
    storefrontUrl: "#",
    adminUrl: "#",
    status: s.status,
    brand: DEMO_BRAND,
    brands: [DEMO_BRAND],
    tipo: s.tipo,
    categoria: s.categoria,
    categoriaForzata: false,
    stagione: "tutte-le-stagioni",
    stagioni: ["tutte-le-stagioni"],
    modello: s.modello,
    gruppo: null,
    fornitoreUrl: null,
    tags: ["esempio", "tutorial"],
    priceMin: s.price,
    priceMax: s.price,
    compareAtPrice: s.compareAt,
    images: [demoImage(s.title, s.tone, s.bg)],
    variantCount: 1,
    opzioni: [],
  };
});
