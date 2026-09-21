import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { MobileGate } from "@/components/catalog/mobile-gate";
import { catalogLabel } from "@/lib/shop-info";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Titolo della scheda del browser: "Catalogo · <store collegato>", mai "CatalogFlow". */
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `Catalogo · ${await catalogLabel()}`,
    description: "Gestione catalogo prodotti, sincronizzato con Shopify.",
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // stesso nome della pagina catalogo: "Catalogo · <store>"
  const catalogName = await catalogLabel();

  return (
    <html
      lang="it"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <MobileGate catalogName={catalogName}>{children}</MobileGate>
      </body>
    </html>
  );
}
