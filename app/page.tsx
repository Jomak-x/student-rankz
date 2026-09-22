import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { CatalogNotice } from "@/components/catalog/catalog-notice";
import { RankingsList } from "@/components/rankings-list";
import { UniversityCard } from "@/components/university-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCatalogService } from "@/server/catalog";
import { readCatalog } from "@/server/catalog/read";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const catalog = await readCatalog(() => getCatalogService().getTopUniversities({ limit: 3 }));

  return (
    <div className="flex flex-col">
      <section className="border-b border-border px-4 sm:px-6 py-8 sm:py-10">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Find your university.</h1>
          <p className="mt-1.5 text-muted-foreground text-sm">
            Published sample ratings for EU universities and courses — teaching, support, facilities.
          </p>
          <form action="/universities" method="get" className="mt-4 flex gap-2 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input name="q" placeholder="Search universities…" className="pl-9" aria-label="Search universities" />
            </div>
            <Button type="submit">Search</Button>
          </form>
        </div>
      </section>

      <section className="px-4 sm:px-6 py-6">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Featured universities</h2>
            <Link href="/universities" className="text-sm text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="size-3" />
            </Link>
          </div>
          {catalog.status === "ready" ? (
            catalog.data.length > 0 ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {catalog.data.map((university) => (
                  <UniversityCard key={university.id} university={university} />
                ))}
              </div>
            ) : (
              <CatalogNotice kind="empty" title="No featured universities yet" />
            )
          ) : (
            <CatalogNotice kind={catalog.status} />
          )}
        </div>
      </section>

      {catalog.status === "ready" && catalog.data.length > 0 && (
        <section className="border-t border-border px-4 sm:px-6 py-6">
          <div className="mx-auto max-w-5xl">
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Top by student experience
              </h2>
              <Link href="/rankings" className="text-sm text-primary hover:underline flex items-center gap-1">
                All rankings <ArrowRight className="size-3" />
              </Link>
            </div>
            <RankingsList items={catalog.data} compact />
          </div>
        </section>
      )}
    </div>
  );
}
