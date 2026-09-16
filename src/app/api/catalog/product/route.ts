import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { shopifyGql, assertNoUserErrors } from "@/lib/catalog/shopify";
import { refreshProductsInCache, removeProductFromCache, loadCatalog, bulkEditProgress, deriveTipo } from "@/lib/catalog/catalog";
import { pickSizeOption, detectFamily, classifySizeValue } from "@/lib/catalog/sizes";
import { classify } from "@/lib/catalog/taxonomy";
import { verifySessionToken, userLabel, SESSION_COOKIE } from "@/lib/auth";
import { appendLog } from "@/lib/activity-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Esegue `fn` su ogni elemento di `items` con al massimo `limit` esecuzioni in parallelo.
 * Le scritture bulk (46+ prodotti) prima giravano una alla volta in sequenza: con 46
 * chiamate Shopify da ~500ms ciascuna erano oltre 20s. In parallelo (rispettando comunque
 * il throttling di shopifyGql) scendono a pochi secondi.
 */
async function mapWithConcurrency<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx]);
    }
  });
  await Promise.all(workers);
}

/**
 * POST /api/catalog/product
 * Body: { action, ... }
 *
 * Azioni:
 *  update        { id, tags?, productType?, status?, title? }
 *  setBrand      { id, brand }                 -> riscrive il tag brand in entrambi i formati
 *  setTipo       { id, tipo }                  -> tag tipo: + productType
 *  setStagione   { id, stagione }
 *  setModello    { ids[], modello }            -> metafield, anche su più prodotti
 *  setFornitore  { id, url }                   -> metafield
 *  setGroup      { ids[], gruppo }             -> metafield, modifica di gruppo
 *  setMainImage  { productId, imageId }
 *  deleteImage   { productId, imageId }
 *  setStatus     { ids[], status }
 *  bulkTags      { ids[], addTags[], removeTags[] }
 *  delete        { id }                        -> ELIMINA definitivamente da Shopify
 *
 * Taglie (tutte scritte SUBITO, non passano da "Salva modifiche"):
 *  getOptions       { id }                                  -> opzioni/varianti fresche + valori taglia con conteggi
 *  sizesAdd         { productId, optionId, values[] }        -> aggiunge taglie (crea le varianti)
 *  sizesRename      { productId, optionId, valueId, name }   -> rinomina una taglia (nessuna variante toccata)
 *  sizesDelete      { productId, optionId, valueIds[], names[] } -> elimina taglie (elimina le varianti collegate)
 *  sizesSort        { productId, optionId, order[] }         -> riordina i valori (elenco COMPLETO richiesto da Shopify)
 *  sizesRenameOption{ productId, optionId, name }            -> uniforma il nome opzione (Pointure -> Taglia)
 *  sizesCreate      { productId, values[], name }            -> crea le taglie su prodotto a variante unica
 *  sizesBulkAdd     { ids[], values[] }                      -> aggiunge le taglie mancanti, per gruppi di scala compatibili
 *  sizesBulkCreate  { ids[], values[], name }                -> crea le taglie solo su prodotti a variante unica
 */

type Body = Record<string, unknown> & { action: string };

const M_UPDATE = `
mutation Upd($product: ProductUpdateInput!) {
  productUpdate(product: $product) { product { id tags productType status } userErrors { field message } }
}`;

const M_METAFIELDS = `
mutation SetMf($metafields: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $metafields) { metafields { id key } userErrors { field message } }
}`;

const M_METAFIELDS_DELETE = `
mutation DelMf($metafields: [MetafieldIdentifierInput!]!) {
  metafieldsDelete(metafields: $metafields) { deletedMetafields { key ownerId } userErrors { field message } }
}`;

const M_REORDER = `
mutation Reorder($id: ID!, $moves: [MoveInput!]!) {
  productReorderMedia(id: $id, moves: $moves) { job { id } mediaUserErrors { field message } }
}`;

const M_DELETE_MEDIA = `
mutation DelMedia($productId: ID!, $mediaIds: [ID!]!) {
  productDeleteMedia(productId: $productId, mediaIds: $mediaIds) {
    deletedMediaIds mediaUserErrors { field message }
  }
}`;

const M_DELETE_PRODUCT = `
mutation DelProduct($input: ProductDeleteInput!) {
  productDelete(input: $input) { deletedProductId userErrors { field message } }
}`;

const M_VARIANTS_BULK = `
mutation UpdVariants($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
  productVariantsBulkUpdate(productId: $productId, variants: $variants) {
    productVariants { id price compareAtPrice }
    userErrors { field message }
  }
}`;

/* ------------------------------------------------------------ taglie */

const P_OPTIONS = `
query GetOptions($id: ID!) {
  product(id: $id) {
    id
    title
    productType
    tags
    options { id name position optionValues { id name } }
    variants(first: 100) { edges { node {
      id title price compareAtPrice inventoryQuantity selectedOptions { name value }
    } } }
    variantsCount { count }
  }
}`;

const M_OPTION_UPDATE = `
mutation UpdOption(
  $productId: ID!, $option: OptionUpdateInput!,
  $add: [OptionValueCreateInput!], $upd: [OptionValueUpdateInput!], $del: [ID!],
  $strategy: ProductOptionUpdateVariantStrategy
) {
  productOptionUpdate(
    productId: $productId, option: $option,
    optionValuesToAdd: $add, optionValuesToUpdate: $upd, optionValuesToDelete: $del,
    variantStrategy: $strategy
  ) {
    product { id options { id name position optionValues { id name } } variantsCount { count } }
    userErrors { field message }
  }
}`;

const M_OPTIONS_CREATE = `
mutation CreateOptions($productId: ID!, $options: [OptionCreateInput!]!, $strategy: ProductOptionCreateVariantStrategy) {
  productOptionsCreate(productId: $productId, options: $options, variantStrategy: $strategy) {
    product { id options { id name position optionValues { id name } } variantsCount { count } }
    userErrors { field message }
  }
}`;

const M_OPTIONS_REORDER = `
mutation ReorderOptions($productId: ID!, $options: [OptionReorderInput!]!) {
  productOptionsReorder(productId: $productId, options: $options) {
    product { id options { id name position optionValues { id name } } }
    userErrors { field message }
  }
}`;

interface RawOption {
  id: string;
  name: string;
  position: number;
  optionValues: { id: string; name: string }[];
}

interface RawOptionsPayload {
  id: string;
  title: string;
  productType: string | null;
  tags: string[];
  options: RawOption[];
  variants: {
    edges: {
      node: {
        id: string; title: string; price: string; compareAtPrice: string | null;
        inventoryQuantity: number | null; selectedOptions: { name: string; value: string }[];
      };
    }[];
  };
  variantsCount: { count: number };
}

/**
 * Categoria (tipo di capo) di un prodotto, con le STESSE regole del catalogo.
 * Serve a impedire che una modifica di gruppo mescoli tipi diversi: magliette
 * con magliette, mai magliette + felpe.
 */
function categoriaOf(p: RawOptionsPayload): string {
  return classify({ tipo: deriveTipo(p.productType ?? null, p.tags ?? []), title: p.title, tags: p.tags ?? [] }).categoria;
}

/** Taglie pulite: trim, niente duplicati (confronto case-insensitive), niente vuoti. */
function cleanValues(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    const v = String(raw ?? "").trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

/** Legge opzioni + varianti fresche da Shopify (sempre: gli id dei valori devono essere validi). */
async function readOptions(productId: string): Promise<RawOptionsPayload> {
  const d = await shopifyGql<{ product: RawOptionsPayload | null }>(P_OPTIONS, { id: productId });
  if (!d.product) throw new Error(`Prodotto non trovato: ${productId}`);
  return d.product;
}

/**
 * Quante varianti esistono per ciascun valore dell'opzione taglia
 * (con un colore, "elimina la taglia 42" elimina 1 variante per colore).
 */
function variantsPerSizeValue(p: RawOptionsPayload, optionName: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const e of p.variants.edges) {
    const v = e.node.selectedOptions.find((o) => o.name === optionName);
    if (v) counts.set(v.value, (counts.get(v.value) ?? 0) + 1);
  }
  return counts;
}

/**
 * Rete di sicurezza sui prezzi: `productOptionUpdate` crea le varianti nuove
 * copiando il prezzo della PRIMA variante. Se la prima è a €0 (o non c'è), le
 * taglie nuove nascerebbero a €0 — qui le allineiamo al primo prezzo valido.
 * Verificato sul catalogo reale: 2586/2587 prodotti hanno un prezzo valido,
 * quindi in pratica non serve mai; il caso limite però non deve passare.
 */
async function fixZeroPrices(productId: string): Promise<{ priceFixed: { title: string; price: string }[] }> {
  const p = await readOptions(productId);
  if (p.variantsCount.count > 100) return { priceFixed: [] }; // oltre 100 varianti non rischiamo deduzioni parziali
  const nodes = p.variants.edges.map((e) => e.node);
  const reference = nodes.find((n) => parseFloat(n.price) > 0)?.price;
  if (!reference) return { priceFixed: [] };
  const zeros = nodes.filter((n) => parseFloat(n.price) === 0);
  if (!zeros.length) return { priceFixed: [] };

  const d = await shopifyGql<Record<string, { userErrors: unknown[] }>>(M_VARIANTS_BULK, {
    productId,
    variants: zeros.map((n) => ({ id: n.id, price: reference })),
  });
  assertNoUserErrors(d.productVariantsBulkUpdate, "sizes:prezzo");
  return { priceFixed: zeros.map((n) => ({ title: n.title, price: reference })) };
}

async function getTags(id: string): Promise<string[]> {
  const d = await shopifyGql<{ product: { tags: string[] } | null }>(
    `query($id: ID!) { product(id: $id) { tags } }`,
    { id }
  );
  if (!d.product) throw new Error(`Prodotto non trovato: ${id}`);
  return d.product.tags;
}

function setTag(tags: string[], prefix: string, value: string | null): string[] {
  const kept = tags.filter((t) => !t.toLowerCase().startsWith(prefix.toLowerCase()));
  if (value && value.trim()) kept.push(`${prefix}${value.trim()}`);
  return kept;
}

/** Come setTag ma sostituisce con PIÙ valori insieme (campi multi-selezione, es. stagioni). */
function setTagMulti(tags: string[], prefix: string, values: string[]): string[] {
  const kept = tags.filter((t) => !t.toLowerCase().startsWith(prefix.toLowerCase()));
  const clean = [...new Set(values.map((v) => v.trim()).filter(Boolean))];
  return [...kept, ...clean.map((v) => `${prefix}${v}`)];
}

/** Il brand vive in due formati storici: li riscriviamo entrambi in modo coerente. */
function setBrandTags(tags: string[], brand: string | null): string[] {
  const kept = tags.filter((t) => !t.toLowerCase().startsWith("brand:") && !t.toLowerCase().startsWith("brand-"));
  if (brand && brand.trim()) {
    const label = brand.trim();
    const slug = label.toLowerCase().replace(/\s+/g, "-");
    kept.push(`brand:${label}`);
    kept.push(`brand-${slug}`);
  }
  return kept;
}

/**
 * Come setBrandTags ma per PIÙ brand insieme (collab, es. "Nike" + "Off-White"):
 * un tag brand:X per ciascuno. Il formato legacy brand-x resta solo per il primo
 * (single-value, compatibilità con integrazioni esterne che lo leggono).
 */
function setBrandsTags(tags: string[], brands: string[]): string[] {
  const kept = tags.filter((t) => !t.toLowerCase().startsWith("brand:") && !t.toLowerCase().startsWith("brand-"));
  const clean = [...new Set(brands.map((b) => b.trim()).filter(Boolean))];
  for (const label of clean) kept.push(`brand:${label}`);
  if (clean[0]) kept.push(`brand-${clean[0].toLowerCase().replace(/\s+/g, "-")}`);
  return kept;
}

/** Traduce l'azione + il payload in una riga leggibile per il log. */
function describeAction(action: string, body: Body): string {
  switch (action) {
    case "update":
      return body.title ? `rinominato in "${body.title}"` : "aggiornati campi prodotto";
    case "bulkEditGroup": {
      const parts: string[] = [];
      if (body.gruppo) parts.push(`gruppo -> ${body.gruppo}`);
      if (body.brand) parts.push(`brand -> ${body.brand}`);
      if (body.categoria) parts.push(`tipo -> ${body.categoria}`);
      if (Array.isArray(body.stagioni) && body.stagioni.length) parts.push(`stagioni -> ${(body.stagioni as string[]).join(", ")}`);
      if (body.status) parts.push(`stato -> ${body.status}`);
      const n = ((body.ids as string[]) ?? []).length;
      return `${parts.join(" · ")} (su ${n} prodotti)`;
    }
    case "setBrand":
      return `brand -> ${body.brand || "(vuoto)"}`;
    case "setBrands":
      return `brand -> ${Array.isArray(body.brands) && body.brands.length ? (body.brands as string[]).join(" x ") : "(vuoto)"}`;
    case "setTipo":
      return `tipo -> ${body.tipo || "(vuoto)"}`;
    case "setCategoria":
      return `categoria -> ${body.categoria || "(vuoto)"}`;
    case "setCategoriaBulk":
      return `categoria -> ${body.categoria || "(vuoto)"} su ${((body.ids as string[]) ?? []).length} prodotti`;
    case "setStagione":
      return `stagione -> ${body.stagione || "(vuoto)"}`;
    case "setStagioni":
      return `stagioni -> ${Array.isArray(body.stagioni) && body.stagioni.length ? (body.stagioni as string[]).join(", ") : "(vuoto)"}`;
    case "setModello":
      return `modello -> ${body.modello || "(vuoto)"} (${((body.ids as string[]) ?? []).length} prodotti)`;
    case "setGroup":
      return `gruppo -> ${body.gruppo || "(vuoto)"} (${((body.ids as string[]) ?? []).length} prodotti)`;
    case "setFornitore":
      return `link fornitore -> ${body.url || "(vuoto)"}`;
    case "setBrandBulk":
      return `brand -> ${body.brand} su ${((body.ids as string[]) ?? []).length} prodotti`;
    case "setTipoBulk":
      return `tipo -> ${body.tipo} su ${((body.ids as string[]) ?? []).length} prodotti`;
    case "setStagioneBulk":
      return `stagione -> ${body.stagione} su ${((body.ids as string[]) ?? []).length} prodotti`;
    case "setStagioniBulk":
      return `stagioni -> ${Array.isArray(body.stagioni) ? (body.stagioni as string[]).join(", ") : ""} su ${((body.ids as string[]) ?? []).length} prodotti`;
    case "setStatus":
      return `stato -> ${body.status} su ${((body.ids as string[]) ?? []).length} prodotti`;
    case "bulkTags":
      return `tag modificati su ${((body.ids as string[]) ?? []).length} prodotti`;
    case "setPrice":
      return `prezzo -> ${body.price ?? "—"}${body.compareAtPrice ? ` (barrato ${body.compareAtPrice})` : ""}`;
    case "setMainImage":
      return "impostata immagine principale";
    case "deleteImage":
      return "eliminata un'immagine";
    case "sizesAdd":
      return `taglie aggiunte: ${cleanValues(body.values).join(", ")}`;
    case "sizesRename":
      return `taglia rinominata: ${body.from ?? "?"} -> ${body.name}`;
    case "sizesDelete":
      return `taglie eliminate: ${cleanValues(body.names).join(", ") || "—"}`;
    case "sizesSort":
      return "taglie riordinate";
    case "sizesRenameOption":
      return `opzione taglia rinominata: ${body.from ?? "?"} -> ${body.name}`;
    case "sizesCreate":
      return `create le taglie: ${cleanValues(body.values).join(", ")}`;
    case "sizesBulkAdd":
      return `taglie aggiunte: ${cleanValues(body.values).join(", ")} (su ${((body.ids as string[]) ?? []).length} prodotti)`;
    case "sizesBulkCreate":
      return `create le taglie: ${cleanValues(body.values).join(", ")} (su ${((body.ids as string[]) ?? []).length} prodotti)`;
    case "delete":
      return "PRODOTTO ELIMINATO";
    default:
      return action;
  }
}

/**
 * Valore "prima" e "dopo" per le azioni su un SINGOLO prodotto (non bulk):
 * il pannello Log lo mostra come confronto. Per le azioni bulk (N prodotti)
 * un prima/dopo singolo non avrebbe senso, quindi restituisce null.
 */
function beforeAfterFor(
  action: string,
  body: Body,
  before: { brand: string | null; brands: string[]; tipo: string | null; categoria: string; stagione: string | null; stagioni: string[]; modello: string | null; gruppo: string | null; fornitoreUrl: string | null; priceMin: string | null; compareAtPrice: string | null; status: string; title: string; taglie: string[] } | undefined
): { before: string; after: string } | null {
  if (!before) return null;
  switch (action) {
    case "update":
      return body.title ? { before: before.title, after: String(body.title) } : null;
    case "sizesRename":
      return { before: String(body.from ?? "?"), after: String(body.name ?? "?") };
    case "sizesRenameOption":
      return { before: String(body.from ?? "?"), after: String(body.name ?? "?") };
    case "sizesAdd": {
      const added = cleanValues(body.values);
      const after = [...before.taglie, ...added.filter((v) => !before.taglie.some((x) => x.toLowerCase() === v.toLowerCase()))];
      return { before: before.taglie.join(", ") || "(nessuna)", after: after.join(", ") || "(nessuna)" };
    }
    case "sizesCreate": {
      const created = cleanValues(body.values);
      return { before: before.taglie.join(", ") || "(nessuna)", after: created.join(", ") || "(nessuna)" };
    }
    case "sizesDelete": {
      const gone = cleanValues(body.names).map((n) => n.toLowerCase());
      const after = before.taglie.filter((v) => !gone.includes(v.toLowerCase()));
      return { before: before.taglie.join(", ") || "(nessuna)", after: after.join(", ") || "(nessuna)" };
    }
    case "setBrand":
      return { before: before.brand || "(vuoto)", after: String(body.brand || "(vuoto)") };
    case "setBrands": {
      const after = Array.isArray(body.brands) ? (body.brands as string[]) : [];
      return {
        before: before.brands.length ? before.brands.join(" x ") : "(vuoto)",
        after: after.length ? after.join(" x ") : "(vuoto)",
      };
    }
    case "setTipo":
      return { before: before.tipo || "(vuoto)", after: String(body.tipo || "(vuoto)") };
    case "setCategoria":
      return { before: before.categoria || "(vuoto)", after: String(body.categoria || "(vuoto)") };
    case "setStagione":
      return { before: before.stagione || "(vuoto)", after: String(body.stagione || "(vuoto)") };
    case "setStagioni": {
      const after = Array.isArray(body.stagioni) ? (body.stagioni as string[]) : [];
      return {
        before: before.stagioni.length ? before.stagioni.join(", ") : "(vuoto)",
        after: after.length ? after.join(", ") : "(vuoto)",
      };
    }
    case "setModello":
      return { before: before.modello || "(vuoto)", after: String(body.modello || "(vuoto)") };
    case "setGroup":
      return { before: before.gruppo || "(vuoto)", after: String(body.gruppo || "(vuoto)") };
    case "setFornitore":
      return { before: before.fornitoreUrl || "(vuoto)", after: String(body.url || "(vuoto)") };
    case "setPrice": {
      const b = before.compareAtPrice ? `€${before.priceMin} (barrato €${before.compareAtPrice})` : `€${before.priceMin ?? "—"}`;
      const a = body.compareAtPrice ? `€${body.price} (barrato €${body.compareAtPrice})` : `€${body.price ?? "—"}`;
      return { before: b, after: a };
    }
    case "setStatus":
      return { before: before.status, after: String(body.status) };
    default:
      return null;
  }
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "JSON non valido" }, { status: 400 });
  }

  const action = body.action;
  if (!action) return NextResponse.json({ ok: false, error: "action mancante" }, { status: 400 });

  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  const actorId = session?.userId ?? "sconosciuto";
  const actorLabel = session ? userLabel(session.userId) : "Sconosciuto";

  const logTargetId = typeof body.id === "string"
    ? body.id
    : typeof body.productId === "string"
      ? body.productId // setMainImage/deleteImage identificano il prodotto così, non con "id"
      : Array.isArray(body.ids) && body.ids.length === 1
        ? (body.ids as string[])[0]
        : undefined;
  let productTitle: string | undefined;
  let productImage: string | undefined;
  let beforeSnapshot: {
    brand: string | null; brands: string[]; tipo: string | null; categoria: string; stagione: string | null; stagioni: string[];
    modello: string | null; gruppo: string | null; fornitoreUrl: string | null;
    priceMin: string | null; compareAtPrice: string | null; status: string; title: string;
    /** Taglie attuali dell'opzione taglia (per il prima/dopo nel log). */
    taglie: string[];
  } | undefined;
  /** Elenco prodotti coinvolti da un'azione di GRUPPO (bulk su più id): titolo + immagine, per il log. */
  let affectedProducts: { id: string; title: string; image?: string }[] | undefined;
  if (logTargetId) {
    try {
      const cached = await loadCatalog(false); // usa la cache esistente, non forza un reload
      const p = cached.find((p) => p.id === logTargetId);
      if (p) {
        productTitle = p.title;
        productImage = (p.images.find((i) => i.isMain) ?? p.images[0])?.url;
        beforeSnapshot = {
          brand: p.brand, brands: p.brands, tipo: p.tipo, categoria: p.categoria, stagione: p.stagione, stagioni: p.stagioni,
          modello: p.modello, gruppo: p.gruppo, fornitoreUrl: p.fornitoreUrl,
          priceMin: p.priceMin, compareAtPrice: p.compareAtPrice, status: p.status, title: p.title,
          taglie: pickSizeOption(p.opzioni ?? [])?.valori.map((v) => v.name) ?? [],
        };
      }
    } catch {
      /* best-effort: il log resta comunque utile senza il titolo */
    }
  } else if (Array.isArray(body.ids) && body.ids.length > 1) {
    try {
      const cached = await loadCatalog(false);
      const ids = new Set(body.ids as string[]);
      affectedProducts = cached
        .filter((p) => ids.has(p.id))
        .slice(0, 300) // tetto di sicurezza: bulk enormi non devono appesantire il log
        .map((p) => ({ id: p.id, title: p.title, image: (p.images.find((i) => i.isMain) ?? p.images[0])?.url }));
    } catch {
      /* best-effort */
    }
  }

  try {
    let result: unknown = null;

    switch (action) {
      /* ------------------------------------------------ modifica di gruppo (UNA sola azione per più campi insieme) */
      case "bulkEditGroup": {
        const ids = (body.ids as string[]) ?? [];
        const gruppo = typeof body.gruppo === "string" ? body.gruppo.trim() : "";
        const brand = typeof body.brand === "string" ? body.brand.trim() : "";
        const categoria = typeof body.categoria === "string" ? body.categoria : "";
        const stagioni = Array.isArray(body.stagioni) ? (body.stagioni as string[]) : [];
        const status = typeof body.status === "string" ? body.status : "";

        bulkEditProgress.active = true;
        bulkEditProgress.total = ids.length;
        bulkEditProgress.done = 0;
        try {
          // metafield "gruppo" a parte: usa metafieldsSet, non i tag (chunk da 25, già efficiente)
          if (gruppo) {
            const metafields = ids.map((id) => ({ ownerId: id, namespace: "custom", key: "gruppo", type: "single_line_text_field", value: gruppo }));
            for (let i = 0; i < metafields.length; i += 25) {
              const d = await shopifyGql<Record<string, { userErrors: unknown[] }>>(M_METAFIELDS, { metafields: metafields.slice(i, i + 25) });
              assertNoUserErrors(d.metafieldsSet, "bulkEditGroup:gruppo");
              bulkEditProgress.done = Math.min(ids.length, i + 25);
            }
          }

          // brand/categoria/stagioni/stato vivono tutti sul prodotto (tag o status): un'unica
          // productUpdate per prodotto invece di N mutation separate per N campi.
          if (brand || categoria || stagioni.length > 0 || status) {
            bulkEditProgress.done = 0;
            let completed = 0;
            await mapWithConcurrency(ids, 8, async (id) => {
              const input: Record<string, unknown> = { id };
              if (brand || categoria || stagioni.length > 0) {
                let tags = await getTags(id);
                if (brand) tags = setBrandTags(tags, brand);
                if (categoria) tags = setTag(tags, "categoria:", categoria);
                if (stagioni.length > 0) tags = setTagMulti(tags, "stagione:", stagioni);
                input.tags = tags;
              }
              if (status) input.status = status;
              const d = await shopifyGql<Record<string, { userErrors: unknown[] }>>(M_UPDATE, { product: input });
              assertNoUserErrors(d.productUpdate, "bulkEditGroup");
              bulkEditProgress.done = ++completed;
            });
          }
        } finally {
          bulkEditProgress.active = false;
        }

        result = { updated: ids.length };
        break;
      }

      /* --------------------------------------------------- campi base */
      case "update":
      case "setBrandBulk":
      case "setTipoBulk":
      case "setCategoriaBulk":
      case "setStagioneBulk": {
        if (action === "update") {
          const input: Record<string, unknown> = { id: body.id };
          if (body.tags) input.tags = body.tags;
          if (body.productType) input.productType = body.productType;
          if (body.status) input.status = body.status;
          if (body.title) input.title = body.title;
          const d = await shopifyGql<Record<string, { userErrors: unknown[] }>>(M_UPDATE, { product: input });
          assertNoUserErrors(d.productUpdate, "update");
          result = d.productUpdate;
          break;
        }

        // azioni bulk: stesso campo su N prodotti
        const ids = (body.ids as string[]) ?? [];
        const isBrand = action === "setBrandBulk";
        const isTipo = action === "setTipoBulk";
        const isCategoria = action === "setCategoriaBulk";
        const value = String(
          (isBrand ? body.brand : isTipo ? body.tipo : isCategoria ? body.categoria : body.stagione) ?? ""
        );

        await mapWithConcurrency(ids, 8, async (id) => {
          const current = await getTags(id);
          const tags = isBrand
            ? setBrandTags(current, value)
            : isCategoria
              ? setTag(current, "categoria:", value)
              : setTag(current, isTipo ? "tipo:" : "stagione:", value);
          const input: Record<string, unknown> = { id, tags };
          if (isTipo && value) input.productType = value;
          const d = await shopifyGql<Record<string, { userErrors: unknown[] }>>(M_UPDATE, { product: input });
          assertNoUserErrors(d.productUpdate, action);
        });
        result = { updated: ids.length, value };
        break;
      }

      case "setStagioniBulk": {
        const ids = (body.ids as string[]) ?? [];
        const values = Array.isArray(body.stagioni) ? (body.stagioni as string[]) : [];
        await mapWithConcurrency(ids, 8, async (id) => {
          const tags = setTagMulti(await getTags(id), "stagione:", values);
          const d = await shopifyGql<Record<string, { userErrors: unknown[] }>>(M_UPDATE, {
            product: { id, tags },
          });
          assertNoUserErrors(d.productUpdate, "setStagioniBulk");
        });
        result = { updated: ids.length, values };
        break;
      }

      case "setBrand": {
        const id = String(body.id);
        const brand = body.brand ? String(body.brand) : null;
        const tags = setBrandTags(await getTags(id), brand);
        const d = await shopifyGql<Record<string, { userErrors: unknown[] }>>(M_UPDATE, {
          product: { id, tags },
        });
        assertNoUserErrors(d.productUpdate, "setBrand");
        result = { tags };
        break;
      }

      /** Come setBrand ma con PIÙ brand insieme (collab, es. "Nike" + "Off-White"). */
      case "setBrands": {
        const id = String(body.id);
        const brands = Array.isArray(body.brands) ? (body.brands as string[]) : [];
        const tags = setBrandsTags(await getTags(id), brands);
        const d = await shopifyGql<Record<string, { userErrors: unknown[] }>>(M_UPDATE, {
          product: { id, tags },
        });
        assertNoUserErrors(d.productUpdate, "setBrands");
        result = { tags };
        break;
      }

      case "setTipo": {
        const id = String(body.id);
        const tipo = body.tipo ? String(body.tipo) : null;
        const tags = setTag(await getTags(id), "tipo:", tipo);
        const input: Record<string, unknown> = { id, tags };
        if (tipo) input.productType = tipo;
        const d = await shopifyGql<Record<string, { userErrors: unknown[] }>>(M_UPDATE, { product: input });
        assertNoUserErrors(d.productUpdate, "setTipo");
        result = { tags };
        break;
      }

      case "setCategoria": {
        const id = String(body.id);
        const categoria = body.categoria ? String(body.categoria) : null;
        const tags = setTag(await getTags(id), "categoria:", categoria);
        const d = await shopifyGql<Record<string, { userErrors: unknown[] }>>(M_UPDATE, {
          product: { id, tags },
        });
        assertNoUserErrors(d.productUpdate, "setCategoria");
        result = { tags };
        break;
      }

      case "setStagione": {
        const id = String(body.id);
        const tags = setTag(await getTags(id), "stagione:", body.stagione ? String(body.stagione) : null);
        const d = await shopifyGql<Record<string, { userErrors: unknown[] }>>(M_UPDATE, {
          product: { id, tags },
        });
        assertNoUserErrors(d.productUpdate, "setStagione");
        result = { tags };
        break;
      }

      case "setStagioni": {
        const id = String(body.id);
        const values = Array.isArray(body.stagioni) ? (body.stagioni as string[]) : [];
        const tags = setTagMulti(await getTags(id), "stagione:", values);
        const d = await shopifyGql<Record<string, { userErrors: unknown[] }>>(M_UPDATE, {
          product: { id, tags },
        });
        assertNoUserErrors(d.productUpdate, "setStagioni");
        result = { tags };
        break;
      }

      /* ----------------------------------------------- metafield (n-upla) */
      case "setModello":
      case "setFornitore":
      case "setGroup": {
        const ids: string[] = Array.isArray(body.ids)
          ? (body.ids as string[])
          : body.id
            ? [String(body.id)]
            : [];
        if (!ids.length) return NextResponse.json({ ok: false, error: "ids mancanti" }, { status: 400 });

        const key = action === "setModello" ? "modello" : action === "setGroup" ? "gruppo" : "fornitore_url";
        // il tipo deve combaciare con la definizione metafield creata su Shopify
        const type = key === "fornitore_url" ? "url" : "single_line_text_field";
        const value = String(body.modello ?? body.gruppo ?? body.url ?? "");

        if (value.trim() === "") {
          // Shopify non accetta metafieldsSet con valore vuoto: per svuotare
          // il campo bisogna CANCELLARE il metafield, non scriverci "".
          const identifiers = ids.map((id) => ({ ownerId: id, namespace: "custom", key }));
          for (let i = 0; i < identifiers.length; i += 25) {
            const d = await shopifyGql<Record<string, { userErrors: unknown[] }>>(M_METAFIELDS_DELETE, {
              metafields: identifiers.slice(i, i + 25),
            });
            assertNoUserErrors(d.metafieldsDelete, action);
          }
          result = { updated: ids.length, key, cleared: true };
          break;
        }

        const metafields = ids.map((id) => ({
          ownerId: id,
          namespace: "custom",
          key,
          type,
          value,
        }));

        // chunk da 25 (limite API)
        for (let i = 0; i < metafields.length; i += 25) {
          const d = await shopifyGql<Record<string, { userErrors: unknown[] }>>(M_METAFIELDS, {
            metafields: metafields.slice(i, i + 25),
          });
          assertNoUserErrors(d.metafieldsSet, action);
        }
        result = { updated: ids.length, key };
        break;
      }

      case "setStatus": {
        const ids = (body.ids as string[]) ?? [];
        const status = String(body.status);
        await mapWithConcurrency(ids, 8, async (id) => {
          const d = await shopifyGql<Record<string, { userErrors: unknown[] }>>(M_UPDATE, {
            product: { id, status },
          });
          assertNoUserErrors(d.productUpdate, "setStatus");
        });
        result = { updated: ids.length, status };
        break;
      }

      case "bulkTags": {
        const ids = (body.ids as string[]) ?? [];
        const add = (body.addTags as string[]) ?? [];
        const remove = (body.removeTags as string[]) ?? [];
        const lowerRemove = remove.map((r) => r.toLowerCase());
        await mapWithConcurrency(ids, 8, async (id) => {
          let tags = await getTags(id);
          tags = tags.filter((t) => !lowerRemove.includes(t.toLowerCase()));
          for (const a of add) if (!tags.includes(a)) tags.push(a);
          const d = await shopifyGql<Record<string, { userErrors: unknown[] }>>(M_UPDATE, {
            product: { id, tags },
          });
          assertNoUserErrors(d.productUpdate, "bulkTags");
        });
        result = { updated: ids.length };
        break;
      }

      case "setPrice": {
        const id = String(body.id);
        const price = body.price != null ? String(body.price) : null;
        const compareAt = body.compareAtPrice != null ? String(body.compareAtPrice) : null;

        const d0 = await shopifyGql<{ product: { variants: { edges: { node: { id: string } }[] } } | null }>(
          `query($id: ID!) { product(id: $id) { variants(first: 100) { edges { node { id } } } } }`,
          { id }
        );
        const variantIds = d0.product?.variants.edges.map((e) => e.node.id) ?? [];
        if (!variantIds.length) throw new Error("nessuna variante trovata");

        const variants = variantIds.map((vid) => {
          const v: Record<string, unknown> = { id: vid };
          if (price !== null) v.price = price;
          if (compareAt !== null) v.compareAtPrice = compareAt === "" ? null : compareAt;
          return v;
        });

        // chunk da 100 (limite API)
        for (let i = 0; i < variants.length; i += 100) {
          const d = await shopifyGql<Record<string, { userErrors: unknown[] }>>(M_VARIANTS_BULK, {
            productId: id,
            variants: variants.slice(i, i + 100),
          });
          assertNoUserErrors(d.productVariantsBulkUpdate, "setPrice");
        }
        result = { updated: variantIds.length, price, compareAtPrice: compareAt };
        break;
      }

      /* ---------------------------------------------------------- taglie */
      case "getOptions": {
        const productId = String(body.id ?? body.productId);
        const p = await readOptions(productId);
        const options = [...p.options].sort((a, b) => a.position - b.position);
        const sizeOpt = pickSizeOption(options);
        const nodes = p.variants.edges.map((e) => e.node);
        const referencePrice = nodes.find((n) => parseFloat(n.price) > 0)?.price ?? nodes[0]?.price ?? null;

        const size = sizeOpt
          ? (() => {
              const counts = variantsPerSizeValue(p, sizeOpt.name);
              const values = sizeOpt.optionValues.map((v) => ({
                id: v.id,
                name: v.name,
                varianti: counts.get(v.name) ?? 0,
              }));
              return {
                optionId: sizeOpt.id,
                optionName: sizeOpt.name,
                values,
                family: detectFamily(values.map((v) => v.name)),
                variantCount: p.variantsCount.count,
              };
            })()
          : null;

        result = {
          productId: p.id,
          title: p.title,
          referencePrice,
          variantCount: p.variantsCount.count,
          variantsTruncated: p.variantsCount.count > 100,
          size,
          otherOptions: options
            .filter((o) => o.id !== sizeOpt?.id)
            .map((o) => ({ id: o.id, name: o.name, count: o.optionValues.length })),
        };
        break;
      }

      /** Aggiunge taglie (crea le varianti: strategy MANAGE). */
      case "sizesAdd": {
        const productId = String(body.productId);
        const values = cleanValues(body.values);
        if (!values.length) throw new Error("nessuna taglia da aggiungere");
        const d = await shopifyGql<Record<string, { userErrors: unknown[] }>>(M_OPTION_UPDATE, {
          productId,
          option: { id: String(body.optionId) },
          add: values.map((name) => ({ name })),
          strategy: "MANAGE",
        });
        assertNoUserErrors(d.productOptionUpdate, "sizesAdd");
        const fixed = await fixZeroPrices(productId);
        result = { added: values, priceFixed: fixed.priceFixed };
        break;
      }

      /** Rinomina UNA taglia (nessuna variante creata/eliminata). */
      case "sizesRename": {
        const productId = String(body.productId);
        const name = String(body.name ?? "").trim();
        if (!name) throw new Error("nome taglia vuoto");
        const d = await shopifyGql<Record<string, { userErrors: unknown[] }>>(M_OPTION_UPDATE, {
          productId,
          option: { id: String(body.optionId) },
          upd: [{ id: String(body.valueId), name }],
          strategy: "LEAVE_AS_IS",
        });
        assertNoUserErrors(d.productOptionUpdate, "sizesRename");
        result = { renamed: { from: body.from ?? null, to: name } };
        break;
      }

      /** Elimina taglie: elimina anche le varianti collegate (strategy MANAGE). */
      case "sizesDelete": {
        const productId = String(body.productId);
        const valueIds: string[] = Array.isArray(body.valueIds)
          ? (body.valueIds as string[]).map(String)
          : [String(body.valueId)];
        const d = await shopifyGql<Record<string, { userErrors: unknown[] }>>(M_OPTION_UPDATE, {
          productId,
          option: { id: String(body.optionId) },
          del: valueIds,
          strategy: "MANAGE",
        });
        assertNoUserErrors(d.productOptionUpdate, "sizesDelete");
        result = { deleted: valueIds, names: cleanValues(body.names) };
        break;
      }

      /** Riordina i valori della taglia (e con essi l'ordine delle varianti). */
      case "sizesSort": {
        const productId = String(body.productId);
        const optionId = String(body.optionId);
        const requested: string[] = Array.isArray(body.order) ? (body.order as string[]).map(String) : [];
        if (!requested.length) throw new Error("ordine mancante");

        // Shopify (productOptionsReorder) vuole l'elenco COMPLETO dei valori: se ne
        // manca uno risponde "Missing option value 'X'". Meglio un errore chiaro qui.
        const p = await readOptions(productId);
        const opt = p.options.find((o) => o.id === optionId);
        if (!opt) throw new Error("opzione taglia non trovata sul prodotto");
        const existingIds = opt.optionValues.map((v) => v.id);
        const order = [...new Set(requested)].filter((id) => existingIds.includes(id));
        const missing = existingIds.filter((id) => !order.includes(id));
        if (missing.length) {
          const names = missing.map((id) => opt.optionValues.find((v) => v.id === id)?.name ?? id);
          throw new Error(`ordine incompleto: mancano ${names.join(", ")}`);
        }

        const d = await shopifyGql<Record<string, { userErrors: unknown[] }>>(M_OPTIONS_REORDER, {
          productId,
          options: [{ id: optionId, values: order.map((id) => ({ id })) }],
        });
        assertNoUserErrors(d.productOptionsReorder, "sizesSort");
        result = { sorted: order.length };
        break;
      }

      /** Uniforma il nome dell'opzione (Pointure/Size/Shoe size -> Taglia). */
      case "sizesRenameOption": {
        const productId = String(body.productId);
        const name = String(body.name ?? "").trim() || "Taglia";
        const d = await shopifyGql<Record<string, { userErrors: unknown[] }>>(M_OPTION_UPDATE, {
          productId,
          option: { id: String(body.optionId), name },
          strategy: "LEAVE_AS_IS",
        });
        assertNoUserErrors(d.productOptionUpdate, "sizesRenameOption");
        result = { optionName: name };
        break;
      }

      /** Crea le taglie su un prodotto a variante unica ("Default Title"). */
      case "sizesCreate": {
        const productId = String(body.productId);
        const values = cleanValues(body.values);
        if (!values.length) throw new Error("nessuna taglia da creare");
        const name = String(body.name ?? "Taglia").trim() || "Taglia";
        const d = await shopifyGql<Record<string, { userErrors: unknown[] }>>(M_OPTIONS_CREATE, {
          productId,
          options: [{ name, values: values.map((v) => ({ name: v })) }],
          strategy: "CREATE",
        });
        assertNoUserErrors(d.productOptionsCreate, "sizesCreate");
        const fixed = await fixZeroPrices(productId);
        result = { optionName: name, created: values, priceFixed: fixed.priceFixed };
        break;
      }

      /**
       * Aggiunge le taglie MANCANTI su più prodotti — con controllo di coerenza:
       * un prodotto a numeri (scarpe) non accetta una scala a lettere e viceversa,
       * così una selezione mista non fa danni. I prodotti non compatibili vengono
       * saltati e riportati, non modificati.
       */
      case "sizesBulkAdd": {
        const ids = (body.ids as string[]) ?? [];
        const values = cleanValues(body.values);
        if (!ids.length) throw new Error("nessun prodotto selezionato");
        if (!values.length) throw new Error("nessuna taglia da aggiungere");
        const expectedCategoria = typeof body.categoria === "string" ? body.categoria.trim() : "";

        const wantedKinds = new Set(values.map((v) => classifySizeValue(v)));
        const skipped: { id: string; title?: string; reason: string }[] = [];
        const failed: { id: string; title?: string; error: string }[] = [];
        let updated = 0;

        bulkEditProgress.active = true;
        bulkEditProgress.total = ids.length;
        bulkEditProgress.done = 0;
        try {
          let done = 0;
          await mapWithConcurrency(ids, 8, async (id) => {
            try {
              const p = await readOptions(id);
              const sizeOpt = pickSizeOption(p.options);
              if (!sizeOpt) {
                skipped.push({ id, title: p.title, reason: "senza opzione taglia" });
                return;
              }

              // coerenza di TIPO: in massa solo capi dello stesso tipo
              const cat = categoriaOf(p);
              if (expectedCategoria && cat.toLowerCase() !== expectedCategoria.toLowerCase()) {
                skipped.push({ id, title: p.title, reason: `tipo diverso (${cat})` });
                return;
              }

              const existing = sizeOpt.optionValues.map((v) => v.name);
              const existingKinds = new Set(existing.map((v) => classifySizeValue(v)));

              if (wantedKinds.has("numero") && wantedKinds.has("lettera")) {
                skipped.push({ id, title: p.title, reason: "scala mista non ammessa" });
                return;
              }
              if (existingKinds.has("numero") && wantedKinds.has("lettera")) {
                skipped.push({ id, title: p.title, reason: `scala incompatibile: prodotto a numeri (${existing.slice(0, 3).join(", ")}…)` });
                return;
              }
              if (existingKinds.has("lettera") && wantedKinds.has("numero")) {
                skipped.push({ id, title: p.title, reason: `scala incompatibile: prodotto a lettere (${existing.slice(0, 3).join(", ")}…)` });
                return;
              }

              const have = new Set(existing.map((v) => v.toLowerCase()));
              const missing = values.filter((v) => !have.has(v.toLowerCase()));
              if (!missing.length) {
                skipped.push({ id, title: p.title, reason: "taglie già presenti" });
                return;
              }

              const d = await shopifyGql<Record<string, { userErrors: unknown[] }>>(M_OPTION_UPDATE, {
                productId: id,
                option: { id: sizeOpt.id },
                add: missing.map((name) => ({ name })),
                strategy: "MANAGE",
              });
              assertNoUserErrors(d.productOptionUpdate, "sizesBulkAdd");
              await fixZeroPrices(id);
              updated++;
            } catch (e) {
              failed.push({ id, error: e instanceof Error ? e.message : String(e) });
            } finally {
              bulkEditProgress.done = ++done;
            }
          });
        } finally {
          bulkEditProgress.active = false;
        }

        result = { updated, values, skipped, failed };
        break;
      }

      /**
       * Crea le taglie su più prodotti che oggi ne sono privi ("Default Title").
       * Solo prodotti con UNA variante e nessuna opzione: per gli altri la
       * creazione di un'opzione moltiplicherebbe le varianti, quindi si salta.
       */
      case "sizesBulkCreate": {
        const ids = (body.ids as string[]) ?? [];
        const values = cleanValues(body.values);
        if (!ids.length) throw new Error("nessun prodotto selezionato");
        if (!values.length) throw new Error("nessuna taglia da creare");
        const name = String(body.name ?? "Taglia").trim() || "Taglia";
        const expectedCategoria = typeof body.categoria === "string" ? body.categoria.trim() : "";

        const skipped: { id: string; title?: string; reason: string }[] = [];
        const failed: { id: string; title?: string; error: string }[] = [];
        let updated = 0;

        bulkEditProgress.active = true;
        bulkEditProgress.total = ids.length;
        bulkEditProgress.done = 0;
        try {
          let done = 0;
          await mapWithConcurrency(ids, 8, async (id) => {
            try {
              const p = await readOptions(id);
              if (pickSizeOption(p.options)) {
                skipped.push({ id, title: p.title, reason: "ha già un'opzione taglia" });
                return;
              }
              // coerenza di TIPO: in massa solo capi dello stesso tipo
              const cat = categoriaOf(p);
              if (expectedCategoria && cat.toLowerCase() !== expectedCategoria.toLowerCase()) {
                skipped.push({ id, title: p.title, reason: `tipo diverso (${cat})` });
                return;
              }
              if (p.options.length > 1 || p.variantsCount.count !== 1) {
                skipped.push({ id, title: p.title, reason: "prodotto con più opzioni/varianti: usa il dialog del singolo prodotto" });
                return;
              }
              const d = await shopifyGql<Record<string, { userErrors: unknown[] }>>(M_OPTIONS_CREATE, {
                productId: id,
                options: [{ name, values: values.map((v) => ({ name: v })) }],
                strategy: "CREATE",
              });
              assertNoUserErrors(d.productOptionsCreate, "sizesBulkCreate");
              await fixZeroPrices(id);
              updated++;
            } catch (e) {
              failed.push({ id, error: e instanceof Error ? e.message : String(e) });
            } finally {
              bulkEditProgress.done = ++done;
            }
          });
        } finally {
          bulkEditProgress.active = false;
        }

        result = { updated, values, optionName: name, skipped, failed };
        break;
      }

      /* ------------------------------------------------------- immagini */
      case "setMainImage": {
        const d = await shopifyGql<Record<string, { userErrors: unknown[] }>>(M_REORDER, {
          id: body.productId,
          moves: [{ id: body.imageId, newPosition: "0" }],
        });
        assertNoUserErrors(d.productReorderMedia, "setMainImage");
        result = d.productReorderMedia;
        break;
      }

      case "deleteImage": {
        const d = await shopifyGql<Record<string, { userErrors: unknown[] }>>(M_DELETE_MEDIA, {
          productId: body.productId,
          mediaIds: [body.imageId],
        });
        assertNoUserErrors(d.productDeleteMedia, "deleteImage");
        result = d.productDeleteMedia;
        break;
      }

      /* --------------------------------------------------- eliminazione */
      case "delete": {
        const d = await shopifyGql<Record<string, { userErrors: unknown[] }>>(M_DELETE_PRODUCT, {
          input: { id: body.id },
        });
        assertNoUserErrors(d.productDelete, "delete");
        result = d.productDelete;
        break;
      }

      default:
        return NextResponse.json({ ok: false, error: `azione sconosciuta: ${action}` }, { status: 400 });
    }

    // aggiorna la cache SOLO per i prodotti toccati da questa azione (niente reload totale di 2500+ prodotti):
    // la UI si vede aggiornata in ~1s invece dei ~25s di un refetch completo.
    const touchedIds = Array.isArray(body.ids)
      ? (body.ids as string[])
      : logTargetId
        ? [logTargetId]
        : [];
    if (action === "delete") {
      if (touchedIds[0]) removeProductFromCache(touchedIds[0]);
    } else if (touchedIds.length > 0) {
      await refreshProductsInCache(touchedIds).catch(() => { /* best-effort: la cache scade comunque da sola */ });
    }

    // getOptions è una lettura (apre il dialog): non va nel log attività
    if (action !== "getOptions") {
      void appendLog({
        at: Date.now(),
        userId: actorId,
        userLabel: actorLabel,
        action,
        detail: describeAction(action, body),
        productId: logTargetId,
        productTitle,
        productImage,
        change: beforeAfterFor(action, body, beforeSnapshot) ?? undefined,
        affectedProducts,
      }).catch(() => { /* il log non deve mai bloccare la scrittura riuscita */ });
    }

    return NextResponse.json({ ok: true, result });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
