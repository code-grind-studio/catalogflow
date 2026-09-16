import { NextResponse } from "next/server";
import { loadProgress } from "@/lib/catalog/catalog";
import { readProgress } from "@/lib/catalog/progress-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/catalog/products/progress
 * Stato del caricamento in corso (per la barra di avanzamento in UI).
 *
 * Legge PRIMA da Redis (stato condiviso tra tutte le istanze serverless):
 * su Vercel ogni invocazione può finire su un'istanza diversa da quella che
 * sta effettivamente caricando, quindi la sola memoria locale (`loadProgress`)
 * non basta — un'istanza "fredda" risponderebbe sempre 0/0, facendo sembrare
 * la barra ferma. Se Redis non è configurato (es. dev locale) o non risponde,
 * usa la memoria locale come fallback (corretto in single-process/dev).
 */
export async function GET() {
  const shared = await readProgress();
  if (shared) return NextResponse.json({ ok: true, ...shared });
  return NextResponse.json({ ok: true, ...loadProgress });
}
