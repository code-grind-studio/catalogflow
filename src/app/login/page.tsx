"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const expired = params.get("expired") === "1";

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
        return;
      }
      const next = params.get("next") ?? "/";
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
          <h1 className="text-sm font-semibold text-neutral-100">Catalogo CatalogFlow</h1>
          <p className="mt-1 text-xs text-neutral-500">
            Accesso riservato. La sessione dura 30 minuti.
          </p>
        </div>

        {expired && (
          <p className="border border-amber-700/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
            Sessione scaduta dopo 30 minuti: accedi di nuovo.
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

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
