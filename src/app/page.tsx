import { CatalogView } from "@/components/catalog/catalog-table";
import { AccountBar } from "@/components/catalog/account-bar";

export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-[1800px] space-y-4 p-6">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold">Catalogo CatalogFlow</h1>
        <span className="text-xs text-muted-foreground">sincronizzato con Shopify</span>
        <AccountBar />
      </div>

      <CatalogView />
    </div>
  );
}
