import { CatalogView } from "@/components/catalog/catalog-table";
import { AccountBar } from "@/components/catalog/account-bar";
import { catalogLabel } from "@/lib/shop-info";

export default async function HomePage() {
  // "Catalogo · <store collegato>": nome vero dello store Shopify, con fallback
  // sul dominio configurato se lo store non risponde.
  const name = await catalogLabel();

  return (
    <div className="mx-auto w-full max-w-[1800px] space-y-4 p-6">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold">
          Catalogo {name}
        </h1>
        <AccountBar />
      </div>

      <CatalogView />
    </div>
  );
}
