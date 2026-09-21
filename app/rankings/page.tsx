import type { Metadata } from "next";
import { CatalogNotice } from "@/components/catalog/catalog-notice";
import { RankingsList } from "@/components/rankings-list";
import { RANKINGS_LIMIT } from "@/lib/rankings";
import { getCatalogService } from "@/server/catalog";
import { readCatalog } from "@/server/catalog/read";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rankings",
  description: "EU universities ranked by published student-experience sample scores.",
};

export default async function RankingsPage() {
  const catalog = await readCatalog(() => getCatalogService().getTopUniversities({ limit: RANKINGS_LIMIT }));

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
      <header>
        <p className="text-xs font-medium uppercase tracking-wide text-primary">Student experience</p>
        <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight">Top universities</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
          Ranked by the average overall score students give their day-to-day experience — teaching,
          support, value and social life. This reflects how students rate living and studying there,
          not academic prestige.
        </p>
        {catalog.status === "ready" && catalog.data.length > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            Showing {catalog.data.length} universities with published sample scores and their stored review counts.
          </p>
        )}
      </header>

      <section className="mt-6">
        {catalog.status === "ready" ? (
          catalog.data.length > 0 ? <RankingsList items={catalog.data} /> : <CatalogNotice kind="empty" />
        ) : (
          <CatalogNotice kind={catalog.status} />
        )}
      </section>

      {catalog.status === "ready" && catalog.data.length > 0 && (
        <footer className="mt-8 border-t border-border pt-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Order uses the catalog&apos;s published sample data: overall score first, then review count, then name.
          </p>
        </footer>
      )}
    </div>
  );
}
