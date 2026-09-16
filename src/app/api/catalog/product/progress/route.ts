import { NextResponse } from "next/server";
import { bulkEditProgress } from "@/lib/catalog/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/catalog/product/progress — stato del salvataggio bulk in corso (barra di avanzamento). */
export async function GET() {
  return NextResponse.json({ ok: true, ...bulkEditProgress });
}
