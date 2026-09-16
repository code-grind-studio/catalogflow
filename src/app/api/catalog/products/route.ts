import { NextResponse } from "next/server";
import { loadCatalog, computeFacets, invalidateCatalogCache } from "@/lib/catalog/catalog";
import { suggestGroups } from "@/lib/catalog/groups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/catalog/products
 *   ?refresh=1  -> bypassa la cache (20s) e rilegge da Shopify
 *   ?suggest=1  -> include i gruppi auto-suggeriti
 *
 * Restituisce prodotti normalizzati + facets per i filtri.
 * Il token Shopify resta server-side: il browser non lo vede mai.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const refresh = searchParams.get("refresh") === "1";
  const withSuggestions = searchParams.get("suggest") === "1";

  try {
    if (refresh) invalidateCatalogCache();
    const products = await loadCatalog(refresh);
    const facets = computeFacets(products);

    const payload: Record<string, unknown> = {
      ok: true,
      count: products.length,
      generatedAt: new Date().toISOString(),
      products,
      facets,
    };

    if (withSuggestions) {
      payload.suggestions = suggestGroups(products).slice(0, 200);
    }

    return NextResponse.json(payload);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
