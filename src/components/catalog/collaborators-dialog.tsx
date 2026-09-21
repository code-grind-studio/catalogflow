"use client";

import * as React from "react";
import { KeyRound, Loader2, Plus, ShieldAlert, Trash2, User } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Entry {
  id: string;
  label: string;
  source: "env" | "collaborator";
  createdAt?: number;
  createdBy?: string;
}

type StorageMode = "redis" | "file" | "memory";

const STORAGE_NOTE: Record<StorageMode, string> = {
  redis:
    "Storage: Redis collegato — gli accessi restano anche dopo un riavvio e funzionano su Vercel.",
  file:
    "Storage: file locale (data/collaborators.json) — ok in locale; su un host serverless come Vercel serve Redis.",
  memory:
    "Attenzione: senza Redis né disco scrivibile gli accessi creati qui si perdono al riavvio del server.",
};

function formatDate(ts?: number): string {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * Gestione dei collaboratori: chi può entrare nel catalogo.
 * Il login è a sola password, quindi si assegnano un nome (per riconoscere chi
 * ha fatto cosa nel log) e una password. Le password non vengono mai mostrate
 * né rilette: qui si vede solo l'elenco degli accessi.
 */
export function CollaboratorsDialog({ onClose }: { onClose: () => void }) {
  const [entries, setEntries] = React.useState<Entry[] | null>(null);
  const [storage, setStorage] = React.useState<StorageMode | null>(null);
  const [admin, setAdmin] = React.useState(false);
  const [label, setLabel] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [createdLabel, setCreatedLabel] = React.useState<string | null>(null);
  const [toDelete, setToDelete] = React.useState<Entry | null>(null);

  const load = React.useCallback(async () => {
    try {
      // niente setState prima dell'await: l'effetto che chiama load() non deve
      // innescare render a cascata (regola react-hooks/set-state-in-effect)
      const res = await fetch("/api/collaborators");
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        isAdmin?: boolean;
        storage?: StorageMode;
        collaborators?: Entry[];
      };
      if (!json.ok) throw new Error(json.error ?? "errore");
      setEntries(json.collaborators ?? []);
      setAdmin(!!json.isAdmin);
      setStorage(json.storage ?? null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  React.useEffect(() => {
    // load() scrive lo stato solo dopo l'await del fetch (nessun setState sincrono):
    // la regola non distingue il caso, come nelle altre chiamate identiche del progetto.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setCreatedLabel(null);
    try {
      const res = await fetch("/api/collaborators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, password }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string; collaborator?: Entry };
      if (!json.ok) throw new Error(json.error ?? "errore");
      setCreatedLabel(json.collaborator?.label ?? label);
      setLabel("");
      setPassword("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (entry: Entry) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/collaborators?id=${encodeURIComponent(entry.id)}`, { method: "DELETE" });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) throw new Error(json.error ?? "errore");
      setToDelete(null);
      setCreatedLabel(null); // niente messaggio "accesso creato" riferito a chi è appena stato revocato
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm">Collaboratori</DialogTitle>
            <DialogDescription className="text-xs">
              Chi può entrare nel catalogo. Ogni persona entra con la <strong>sola password</strong>: il nome
              serve per riconoscere chi ha fatto cosa nel log attività.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-start gap-2 border border-border bg-card/40 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
            <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Per condividere il tool con qualcun altro deve girare su un <strong>host online</strong> (Vercel, un
              server o un NAS raggiungibile): l&apos;indirizzo localhost del tuo computer funziona solo da lì.
            </span>
          </div>

          {storage && <p className="text-[11px] text-muted-foreground">{STORAGE_NOTE[storage]}</p>}

          {error && <p className="text-xs text-destructive">{error}</p>}
          {createdLabel && (
            <p className="text-[11px] text-muted-foreground">
              Accesso creato per <strong>{createdLabel}</strong>: comunicagli la password, qui non è più visibile.
            </p>
          )}

          {admin ? (
            <form onSubmit={submit} className="space-y-2.5 border border-border p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium">
                <Plus className="size-3.5" /> Nuovo collaboratore
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label htmlFor="collab-label" className="text-[11px]">
                    Nome
                  </Label>
                  <Input
                    id="collab-label"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="es. Marco"
                    className="h-7 rounded-none text-xs"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="collab-password" className="text-[11px]">
                    Password
                  </Label>
                  <Input
                    id="collab-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="almeno 6 caratteri"
                    className="h-7 rounded-none text-xs"
                    autoComplete="new-password"
                  />
                </div>
              </div>
              <Button type="submit" size="sm" variant="outline" disabled={busy || !label || !password}>
                {busy ? <Loader2 className="size-3 animate-spin" /> : <KeyRound className="size-3" />}
                Crea accesso
              </Button>
            </form>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Solo l&apos;admin può creare o revocare accessi. Qui puoi vedere chi ha accesso oggi.
            </p>
          )}

          <div className="space-y-1.5">
            {!entries && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Carico gli accessi…
              </p>
            )}
            {entries?.map((e) => (
              <div
                key={e.id}
                className="flex items-center gap-2.5 border border-border/60 px-2.5 py-1.5 text-xs"
              >
                <User className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{e.label}</span>
                <span className="border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {e.source === "env" ? "da env var" : "creato qui"}
                </span>
                <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                  {e.source === "collaborator" && formatDate(e.createdAt)}
                </span>
                {admin && e.source === "collaborator" && (
                  <button
                    type="button"
                    onClick={() => setToDelete(e)}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    title={`Revoca l'accesso di ${e.label}`}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <p className="text-[11px] text-muted-foreground">
            Gli accessi configurati nelle variabili d&apos;ambiente (utente 1 = admin) si cambiano dal pannello del
            provider di hosting, non da qui.
          </p>
        </DialogContent>
      </Dialog>

      {toDelete && (
        <Dialog open onOpenChange={(open) => !open && setToDelete(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-sm">Revocare l&apos;accesso di {toDelete.label}?</DialogTitle>
              <DialogDescription className="text-xs">
                Da quel momento la sua password non funziona più. Per ridargli l&apos;accesso dovrai creare un nuovo
                collaboratore con una password diversa.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setToDelete(null)} disabled={busy}>
                Annulla
              </Button>
              <Button variant="destructive" size="sm" onClick={() => void remove(toDelete)} disabled={busy}>
                {busy ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
                Revoca accesso
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
