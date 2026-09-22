import Link from "next/link";
import type { ReactNode } from "react";
import type { CatalogPage, CatalogPageInfo, CatalogSampleReview } from "@/lib/catalog-types";
import type { CatalogRead } from "@/server/catalog/read";
import { CatalogNotice } from "./catalog-notice";
import { ReviewCard } from "@/components/review-card";
import { StarRating } from "@/components/star-rating";
import { Badge } from "@/components/ui/badge";

export type DetailSearchParams = Record<string, string | string[] | undefined>;
export type DetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<DetailSearchParams>;
};

export function detailPageNumber(value: string | string[] | undefined): number {
  const page = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : 1;
  return Number.isSafeInteger(page) && page > 0 ? Math.min(page, 10_000) : 1;
}

export function DetailShell({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">{children}</div>;
}

export function DetailScore({ value }: { value: number | null }) {
  return value === null
    ? <span className="text-sm text-muted-foreground">Unrated</span>
    : <StarRating value={value} showValue />;
}

export function DetailRating({ value, reviewCount }: { value: number | null; reviewCount: number }) {
  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <DetailScore value={value} />
        <span className="text-sm text-muted-foreground">{reviewCount} sample reviews</span>
        <Badge variant="secondary">Synthetic demo data</Badge>
      </div>
      <p className="text-xs text-muted-foreground">Scores and public reviews are synthetic examples. Saved private drafts do not change them.</p>
    </div>
  );
}

export function DetailPagination({ pagination, pathname, searchParams, pageKey, anchor, label }: {
  pagination: CatalogPageInfo;
  pathname: string;
  searchParams: DetailSearchParams;
  pageKey: string;
  anchor: string;
  label: string;
}) {
  if (pagination.totalPages <= 1 && pagination.page === 1) return null;
  const href = (page: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (key === pageKey || value === undefined) continue;
      for (const item of Array.isArray(value) ? value : [value]) query.append(key, item);
    }
    query.set(pageKey, String(page));
    return `${pathname}?${query.toString()}#${anchor}`;
  };
  return (
    <nav aria-label={`${label} pagination`} className="flex flex-wrap items-center gap-4 text-sm">
      {pagination.page > 1 && <Link className="text-primary underline underline-offset-4" href={href(Math.min(pagination.page - 1, Math.max(1, pagination.totalPages)))}>Previous {label.toLowerCase()}</Link>}
      <span className="text-muted-foreground">{pagination.page > pagination.totalPages ? "Page outside available results" : `Page ${pagination.page} of ${pagination.totalPages}`}</span>
      {pagination.hasNextPage && <Link className="text-primary underline underline-offset-4" href={href(pagination.page + 1)}>Next {label.toLowerCase()}</Link>}
    </nav>
  );
}

export function DetailReviews({ result, pathname, searchParams }: {
  result: CatalogRead<CatalogPage<CatalogSampleReview> | null>;
  pathname: string;
  searchParams: DetailSearchParams;
}) {
  return (
    <section id="reviews" className="scroll-mt-6 space-y-3">
      <h2 className="font-semibold">Sample reviews</h2>
      <p className="text-sm text-muted-foreground">These reviews and author names are fictional, synthetic demo content.</p>
      {result.status !== "ready" ? <CatalogNotice kind={result.status} title="Sample reviews could not be loaded" /> : (
        <>
          {result.data && result.data.items.length > 0
            ? result.data.items.map((review) => <ReviewCard key={review.id} review={review} />)
            : <CatalogNotice kind="empty" title="No sample reviews on this page" />}
          {result.data && <DetailPagination pagination={result.data} pathname={pathname} searchParams={searchParams} pageKey="reviewPage" anchor="reviews" label="Reviews" />}
        </>
      )}
    </section>
  );
}
