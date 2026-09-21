import { shopifyGql } from "@/lib/catalog/shopify";

/**
 * Nome dello store Shopify collegato, per l'intestazione
 * "Catalogo · <store>". Una sola query, in cache 10 minuti: l'intestazione
 * non deve pesare sul throttling dell'Admin API.
 * Se lo store non risponde si ripiega sul dominio configurato: il titolo non
 * deve mai restare vuoto.
 */

let cache: { name: string; at: number } | null = null;
const TTL_MS = 10 * 60 * 1000;

export async function getShopName(): Promise<string | null> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.name;
  try {
    const data = await shopifyGql<{ shop: { name: string } }>("{ shop { name } }");
    cache = { name: data.shop.name, at: Date.now() };
    return cache.name;
  } catch {
    return null;
  }
}

/** Il dominio configurato, senza `.myshopify.com` (es. "iltuo-store"). */
export function configuredHandle(): string {
  return (process.env.SHOPIFY_DOMAIN ?? "").replace(/\.myshopify\.com$/, "");
}

/** Etichetta per l'intestazione: nome dello store, o dominio configurato. */
export async function catalogLabel(): Promise<string> {
  const name = await getShopName();
  return name ?? (configuredHandle() || "CatalogFlow");
}
