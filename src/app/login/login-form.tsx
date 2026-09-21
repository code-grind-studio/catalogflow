"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { percorsoInterno } from "@/lib/utils";

export function LoginForm({ catalogName }: { catalogName: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  /** Dopo la PRIMA password sbagliata mostriamo come recuperarla. */
  const [failedOnce, setFailedOnce] = React.useState(false);
  const invalid = params.get("expired") === "1";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) {
        setError(json.error ?? "Password errata");
        setFailedOnce(true);
        return;
      }
      const next = percorsoInterno(params.get("next"));
      router.push(next);
      router.refresh();
    } catch {
      setError("Errore di rete");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 border border-neutral-800 bg-neutral-900 p-6"
      >
        <div>
          <h1 className="text-sm font-semibold text-neutral-100">
            Catalogo {catalogName}
          </h1>
          <p className="mt-1 text-xs text-neutral-500">
            Accesso riservato: serve la tua password per entrare.
          </p>
        </div>

        {invalid && (
          <p className="border border-amber-700/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
            Sessione non più valida: accedi di nuovo.
          </p>
        )}

        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="h-9 w-full border border-neutral-700 bg-neutral-950 px-3 text-sm text-neutral-100 outline-none focus:border-neutral-500"
        />

        {error && <p className="text-xs text-red-400">{error}</p>}

        {failedOnce && (
          <div className="space-y-1.5 border border-neutral-700 bg-neutral-950/60 px-3 py-2.5 text-[11px] leading-relaxed text-neutral-400">
            <p className="font-medium text-neutral-300">Come recuperare la password</p>
            <p>
              <strong className="text-neutral-300">Sei l&apos;admin?</strong> La password sta nel file{" "}
              <code className="text-neutral-300">.env.local</code> del progetto, voce{" "}
              <code className="text-neutral-300">CATALOG_USER_1_PASSWORD</code> (se il tool è su un host, nelle
              variabili d&apos;ambiente del provider).
            </p>
            <p>
              <strong className="text-neutral-300">Sei un collaboratore?</strong> Chiedi a chi ha l&apos;accesso
              admin: dal catalogo, click sul suo nome in alto a destra, può crearti un nuovo accesso.
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={busy || !password}
          className="h-9 w-full bg-neutral-100 text-sm font-medium text-neutral-900 disabled:opacity-40"
        >
          {busy ? "Verifica..." : "Entra"}
        </button>
      </form>
    </div>
  );
}
