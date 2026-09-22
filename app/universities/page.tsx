import Link from "next/link";
import { Search, SlidersHorizontal } from "lucide-react";
import { CatalogNotice } from "@/components/catalog/catalog-notice";
import { UniversityCard } from "@/components/university-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCatalogService } from "@/server/catalog";
import { readCatalog } from "@/server/catalog/read";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

function valueOf(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

function pageOf(value: string | undefined) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function pageHref(q: string | undefined, country: string | undefined, sort: string | undefined, page: number) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (country) params.set("country", country);
  if (sort) params.set("sort", sort);
  params.set("page", String(page));
  return `/universities?${params.toString()}`;
}

export default async function UniversitiesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = valueOf(params.q);
  const country = valueOf(params.country);
  const sort = valueOf(params.sort) ?? "overall";
  const page = pageOf(valueOf(params.page));
  const catalog = await readCatalog(() =>
    Promise.all([
      getCatalogService().listUniversities({ q, country, sort, page }),
      getCatalogService().listCountries(),
    ]),
  );

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Universities</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Student-experience ratings from published sample reviews.
          </p>
        </div>
      </div>

      <form key={JSON.stringify([q, country, sort])} method="get" className="flex flex-col sm:flex-row gap-3 mb-6" role="search" aria-label="Filter universities">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder="Search by name, city, or country…" className="pl-9" aria-label="Search universities" />
        </div>
        <label className="sr-only" htmlFor="country">Filter by country</label>
        <div className="relative w-full sm:w-40">
          <SlidersHorizontal className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <select id="country" name="country" defaultValue={country ?? ""} className="h-8 w-full appearance-none rounded-lg border border-input bg-transparent py-1 pr-2 pl-7 text-sm">
            <option value="">All countries</option>
            {catalog.status === "ready" && catalog.data[1].map((item) => (
              <option key={item.countryCode} value={item.countryCode}>{item.country}</option>
            ))}
          </select>
        </div>
        <label className="sr-only" htmlFor="sort">Sort universities</label>
        <select id="sort" name="sort" defaultValue={sort} className="h-8 w-full sm:w-36 rounded-lg border border-input bg-transparent px-2.5 text-sm">
          <option value="overall">Top rated</option>
          <option value="reviews">Most reviewed</option>
          <option value="name">Name A–Z</option>
        </select>
        <Button type="submit">Apply</Button>
      </form>

      {catalog.status === "ready" ? (
        <UniversityResults q={q} country={country} sort={sort} data={catalog.data[0]} />
      ) : (
        <CatalogNotice kind={catalog.status} />
      )}
    </div>
  );
}

function UniversityResults({
  q,
  country,
  sort,
  data,
}: {
  q: string | undefined;
  country: string | undefined;
  sort: string;
  data: Awaited<ReturnType<ReturnType<typeof getCatalogService>["listUniversities"]>>;
}) {
  const hasFilters = Boolean(q || country);

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-xs text-muted-foreground">
          {data.total} {data.total === 1 ? "university" : "universities"}
        </p>
        {hasFilters && <Link href="/universities" className="text-xs text-primary hover:underline">Clear filters</Link>}
      </div>
      {data.items.length === 0 && <CatalogNotice kind="empty" title={hasFilters ? "No universities match your filters" : undefined} />}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.items.map((university) => <UniversityCard key={university.id} university={university} />)}
      </div>
      {(data.page > 1 || data.hasNextPage) && (
        <nav className="mt-6 flex items-center justify-between" aria-label="University pages">
          {data.page > 1 ? (
            <Link className="text-sm text-primary hover:underline" href={pageHref(q, country, sort, data.page - 1)}>Previous</Link>
          ) : <span />}
          <span className="text-xs text-muted-foreground">Page {data.page} of {data.totalPages}</span>
          {data.hasNextPage ? (
            <Link className="text-sm text-primary hover:underline" href={pageHref(q, country, sort, data.page + 1)}>Next</Link>
          ) : <span />}
        </nav>
      )}
    </>
  );
}
