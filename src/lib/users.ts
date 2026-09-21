import {
  createCollaborator,
  deleteCollaborator,
  findByPassword,
  listCollaborators,
  slugId,
  storageMode,
  toView,
  type CollaboratorView,
  type StorageMode,
} from "./collaborators";

/**
 * Chi può entrare nel catalogo.
 *
 * Due sorgenti, unite qui:
 *  - le env var `CATALOG_USER_1..10_*` (l'admin/proprietario e chi vuoi
 *    configurare a mano — si gestiscono nel pannello dell'host, mai in UI);
 *  - i collaboratori creati dall'interfaccia (dialog in alto a destra),
 *    salvati in Redis o nel file locale, vedi `./collaborators`.
 *
 * Il login è a SOLA PASSWORD: si digita la password e il sistema risale
 * all'identità. Quindi la password deve essere unica fra tutti gli utenti,
 * lato interfaccia e lato API (vedi `passwordInUse`).
 *
 * Questo modulo è Node-only (usa Redis/fs): non importarlo dal proxy/middleware.
 * Le funzioni di sessione (cookie firmato HMAC) restano in `./auth`.
 */

export interface UserIdentity {
  id: string;
  label: string;
}

export interface UserEntry extends UserIdentity {
  source: "env" | "collaborator";
  /** Solo per gli utenti env (in chiaro: sono già in chiaro nelle env var). */
  password?: string;
  createdAt?: number;
  createdBy?: string;
}

export const MAX_ENV_USERS = 10;
export const MIN_PASSWORD_LENGTH = 6;
export const MAX_LABEL_LENGTH = 40;

function timingSafeEqualStr(a: string, b: string): boolean {
  const pa = a.padEnd(64, "\0");
  const pb = b.padEnd(64, "\0");
  let diff = 0;
  for (let i = 0; i < pa.length; i++) diff |= pa.charCodeAt(i) ^ pb.charCodeAt(i);
  return diff === 0;
}

/** Utenti configurati via env var (la sorgente storica, senza DB). */
export function envUsers(): UserEntry[] {
  const users: UserEntry[] = [];
  for (let i = 1; i <= MAX_ENV_USERS; i++) {
    const id = process.env[`CATALOG_USER_${i}_ID`];
    const password = process.env[`CATALOG_USER_${i}_PASSWORD`];
    if (!id || !password) continue;
    users.push({ id, label: process.env[`CATALOG_USER_${i}_LABEL`] ?? id, password, source: "env" });
  }
  return users;
}

/** L'admin: il primo utente configurato nelle env var (di norma il proprietario). */
export function adminId(): string {
  return process.env.CATALOG_USER_1_ID ?? "admin";
}

export function isAdmin(userId: string): boolean {
  return userId === adminId();
}

/** Tutti gli utenti: env var + collaboratori creati dalla UI. */
export async function listUsers(): Promise<UserEntry[]> {
  const collaborators: UserEntry[] = (await listCollaborators()).map((c) => ({
    id: c.id,
    label: c.label,
    source: "collaborator" as const,
    createdAt: c.createdAt,
    createdBy: c.createdBy,
  }));
  return [...envUsers(), ...collaborators];
}

/** Verifica una password e restituisce l'identità corrispondente. */
export async function checkPassword(input: string): Promise<UserIdentity | null> {
  for (const u of envUsers()) {
    if (u.password && timingSafeEqualStr(input, u.password)) return { id: u.id, label: u.label };
  }
  const collaborator = await findByPassword(input);
  return collaborator ? { id: collaborator.id, label: collaborator.label } : null;
}

export async function userLabel(userId: string): Promise<string> {
  const env = envUsers().find((u) => u.id === userId);
  if (env) return env.label;
  const collaborator = (await listCollaborators()).find((c) => c.id === userId);
  return collaborator?.label ?? userId;
}

/**
 * L'utente della sessione esiste ancora?
 * Serve perché la sessione non scade: se un accesso viene revocato, il suo
 * cookie resterebbe valido per sempre. Le API chiedono questo a ogni richiesta.
 */
export async function userExists(userId: string): Promise<boolean> {
  if (envUsers().some((u) => u.id === userId)) return true;
  return (await listCollaborators()).some((c) => c.id === userId);
}

/** La password è già usata da qualcun altro? (il login è a sola password) */
export async function passwordInUse(password: string): Promise<boolean> {
  for (const u of envUsers()) {
    if (u.password && timingSafeEqualStr(password, u.password)) return true;
  }
  return (await findByPassword(password)) !== null;
}

/** Crea un collaboratore dalla UI. Lancia messaggi leggibili per la UI. */
export async function addCollaborator(input: {
  label: string;
  password: string;
  createdBy?: string;
}): Promise<CollaboratorView> {
  const label = input.label.trim();
  if (label.length < 2) throw new Error("Scrivi il nome del collaboratore (almeno 2 caratteri).");
  if (label.length > MAX_LABEL_LENGTH) throw new Error(`Nome troppo lungo (max ${MAX_LABEL_LENGTH} caratteri).`);
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`La password deve avere almeno ${MIN_PASSWORD_LENGTH} caratteri.`);
  }
  if (await passwordInUse(input.password)) {
    throw new Error("Questa password è già usata da un altro accesso: scegline una diversa.");
  }
  const esistenti = await listUsers();
  if (esistenti.some((u) => u.label.toLowerCase() === label.toLowerCase())) {
    throw new Error("Esiste già un accesso con questo nome.");
  }
  // L'id nasce dal nome: se il nome ripulito coincide con un accesso che esiste
  // già, la persona entrerebbe con QUELL'identità — un collaboratore chiamato
  // "Admin" diventerebbe amministratore a tutti gli effetti. Qui lo rifiutiamo
  // (e sotto passiamo gli id occupati anche al generatore, come seconda rete).
  const idProposto = slugId(label);
  if (esistenti.some((u) => u.id === idProposto)) {
    throw new Error(
      "Questo nome crea un id già usato da un altro accesso (compreso l'amministratore): scegline un altro."
    );
  }
  const collaborator = await createCollaborator({
    label,
    password: input.password,
    createdBy: input.createdBy,
    reservedIds: esistenti.map((u) => u.id),
  });
  return toView(collaborator);
}

export async function removeCollaborator(id: string): Promise<void> {
  const removed = await deleteCollaborator(id);
  if (!removed) throw new Error("Collaboratore non trovato.");
}

export async function storage(): Promise<StorageMode> {
  return storageMode();
}
