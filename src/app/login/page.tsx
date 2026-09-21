import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { catalogLabel } from "@/lib/shop-info";

export default async function LoginPage() {
  // stesso titolo della pagina catalogo: "Catalogo · <store collegato>"
  const name = await catalogLabel();

  return (
    <Suspense fallback={null}>
      <LoginForm catalogName={name} />
    </Suspense>
  );
}
