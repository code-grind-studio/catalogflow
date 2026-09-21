import { Redis } from "@upstash/redis";
import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Collaboratori creati dall'interfaccia (nome + password).
 *
 * Il login di CatalogFlow è a sola password: chi entra digita la password e il
 * sistema risale all'identità. Quindi qui NON si salva la password in chiaro:
 * si salva un hash PBKDF2-SHA256 con salt casuale per ogni persona.
 *
 * Dove finiscono i dati, in ordine di preferenza:
 *   1. Redis (Upstash/Vercel KV: KV_REST_API_URL + KV_REST_API_TOKEN) — è
 *      l'unico storage che funziona davvero su un host serverless come Vercel,
 *      perché sopravvive ai riavvii e non ha bisogno di scrivere su disco;
 *   2. file `data/collaborators.json` — per l'uso locale/self-hosted (anche su
 *      un NAS), dove il disco è scrivibile e persistente;
 *   3. memoria — ultima spiaggia (documentata in UI): succede solo su host
 *      senza Redis e con filesystem di sola lettura, e i collaboratori creati
 *      si perdono al riavvio del processo.
 *
 * Nessuna password esce mai da qui: l'elenco restituito alle API contiene
 * solo id, nome e data di creazione.
 */

export interface Collaborator {
  id: string;
  label: string;
  /** PBKDF2-SHA256 (hex) della password; la password in chiaro non è mai salvata. */
  hash: string;
  /** Salt casuale (hex, 16 byte) unico per collaboratore. */
  salt: string;
  createdAt: number;
  /** Chi ha creato l'accesso (etichetta dell'utente in sessione). */
  createdBy?: string;
}

/** Collaboratore senza i campi sensibili, per le risposte API. */
export interface CollaboratorView {
  id: string;
  label: string;
  createdAt: number;
  createdBy?: string;
}

export type StorageMode = "redis" | "file" | "memory";

const KEY = "catalog:collaborators";
const FILE = path.join(process.cwd(), "data", "collaborators.json");
const PBKDF2_ITERATIONS = 120_000;

/* ------------------------------------------------------------------ storage */

let redis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

/** Fallback in-memory (dev senza storage): vale solo per la vita del processo. */
let memory: Collaborator[] = [];

let modeCache: StorageMode | undefined;

export async function storageMode(): Promise<StorageMode> {
  if (modeCache) return modeCache;
  if (getRedis()) return (modeCache = "redis");
  // su Vercel (e simili) il filesystem è di sola lettura: non tentiamo nemmeno
  if (process.env.VERCEL) return (modeCache = "memory");
  try {
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    modeCache = "file";
  } catch {
    modeCache = "memory";
  }
  return modeCache;
}

async function readAll(): Promise<Collaborator[]> {
  const mode = await storageMode();
  if (mode === "redis") {
    const client = getRedis();
    const raw = (await client?.get<Collaborator[] | string>(KEY)) ?? null;
    if (!raw) return [];
    try {
      return typeof raw === "string" ? (JSON.parse(raw) as Collaborator[]) : raw;
    } catch {
      return [];
    }
  }
  if (mode === "file") {
    try {
      const raw = await fs.readFile(FILE, "utf8");
      return JSON.parse(raw) as Collaborator[];
    } catch {
      return [];
    }
  }
  return [...memory];
}

async function writeAll(list: Collaborator[]): Promise<void> {
  const mode = await storageMode();
  if (mode === "redis") {
    await getRedis()?.set(KEY, list);
    return;
  }
  if (mode === "file") {
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(list, null, 2), { mode: 0o600 });
    return;
  }
  memory = list;
}

/* -------------------------------------------------------------------- crypto */

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(hex.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** PBKDF2-SHA256: 120k iterazioni, confronto a tempo costante sul risultato. */
async function pbkdf2(password: string, saltHex: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: fromHex(saltHex), iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    256
  );
  return toHex(bits);
}

function sameHash(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* --------------------------------------------------------------------- CRUD */

export async function listCollaborators(): Promise<Collaborator[]> {
  return (await readAll()).sort((a, b) => a.createdAt - b.createdAt);
}

export function toView(c: Collaborator): CollaboratorView {
  return { id: c.id, label: c.label, createdAt: c.createdAt, createdBy: c.createdBy };
}

function slugify(label: string, taken: Set<string>): string {
  const base =
    label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "collaboratore";
  let id = base;
  let n = 2;
  while (taken.has(id)) id = `${base}-${n++}`;
  return id;
}

/** Come diventa l'id partendo dal nome (id = nome ripulito). */
export function slugId(label: string): string {
  return slugify(label, new Set());
}

export interface CreateInput {
  label: string;
  password: string;
  createdBy?: string;
  /**
   * Id da non usare MAI (gli accessi configurati nelle env var, admin compreso):
   * l'id nasce dal nome, quindi senza questo elenco un collaboratore chiamato
   * "Admin" prenderebbe l'id dell'amministratore e diventerebbe admin a sua
   * volta. Vedi `@/lib/users`.
   */
  reservedIds?: string[];
}

/** Crea un collaboratore. Le validazioni di unicità le fa `@/lib/users`. */
export async function createCollaborator(input: CreateInput): Promise<Collaborator> {
  const list = await readAll();
  const presi = new Set([...list.map((c) => c.id), ...(input.reservedIds ?? [])]);
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  const collaborator: Collaborator = {
    id: slugify(input.label, presi),
    label: input.label.trim(),
    salt,
    hash: await pbkdf2(input.password, salt),
    createdAt: Date.now(),
    createdBy: input.createdBy,
  };
  await writeAll([...list, collaborator]);
  return collaborator;
}

export async function deleteCollaborator(id: string): Promise<boolean> {
  const list = await readAll();
  const next = list.filter((c) => c.id !== id);
  if (next.length === list.length) return false;
  await writeAll(next);
  return true;
}

/** Password → collaboratore, se la password appartiene a uno di loro. */
export async function findByPassword(password: string): Promise<Collaborator | null> {
  for (const c of await readAll()) {
    if (sameHash(await pbkdf2(password, c.salt), c.hash)) return c;
  }
  return null;
}

export async function hasCollaborators(): Promise<boolean> {
  return (await readAll()).length > 0;
}
