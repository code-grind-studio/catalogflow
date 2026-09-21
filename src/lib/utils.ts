import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Destinazione sicura dopo il login: solo percorsi INTERNI.
 * Il parametro `next` arriva dall'URL, quindi può essere un link costruito da
 * altri: senza questo controllo `?next=https://sito-ostrua` porterebbe l'utente
 * fuori dal catalogo subito dopo l'accesso (open redirect).
 */
export function percorsoInterno(raw: string | null | undefined, fallback = "/"): string {
  if (!raw) return fallback
  if (!raw.startsWith("/")) return fallback // URL assoluto (http://..., javascript:...)
  if (raw.startsWith("//")) return fallback // protocol-relative (//sito-ostrua)
  if (raw.includes("\\") || raw.includes("\n") || raw.includes("\r")) return fallback
  if (/^\/[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) return fallback // /\sito-ostrua:...
  return raw
}

