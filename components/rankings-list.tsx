import Link from "next/link";
import type { CatalogUniversity } from "@/lib/catalog-types";
import { cn } from "@/lib/utils";

interface RankingsListProps {
  items: CatalogUniversity[];
  /** Tighter rows for the home page preview */
  compact?: boolean;
}

export function RankingsList({ items, compact = false }: RankingsListProps) {
  if (items.length === 0) {
    return <RankingsEmpty />;
  }

  return (
    <ol className="divide-y divide-border" aria-label="University rankings">
      {items.map((university, index) => {
        const rank = index + 1;
        return (
          <li key={university.id}>
            <Link
              href={`/universities/${university.slug}`}
              className={cn(
                "group flex items-center gap-3 sm:gap-4 -mx-2 px-2 rounded-md transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring",
                compact ? "py-2" : "py-3",
              )}
            >
              <span
                className={cn(
                  "shrink-0 w-7 sm:w-8 text-right font-semibold tabular-nums leading-none",
                  compact ? "text-base" : "text-lg sm:text-xl",
                  rank <= 3 ? "text-primary" : "text-muted-foreground",
                )}
              >
                {rank}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block truncate font-medium leading-snug transition-colors group-hover:text-primary",
                    compact ? "text-sm" : "text-sm sm:text-base",
                  )}
                >
                  {university.name}
                </span>
                {!compact && (
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    {university.city}, {university.country}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-right">
                <span className="font-semibold tabular-nums text-sm sm:text-base">
                  {university.scores.overall === null
                    ? "No score"
                    : university.scores.overall.toFixed(1)}
                  {university.scores.overall !== null && <span className="sr-only"> out of 5</span>}
                </span>
                <span className="block text-[11px] text-muted-foreground tabular-nums">
                  {university.reviewCount} sample {university.reviewCount === 1 ? "review" : "reviews"}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

export function RankingsEmpty() {
  return (
    <div className="py-12 text-center" role="status">
      <p className="font-medium">No universities to rank yet</p>
      <p className="text-sm text-muted-foreground mt-1">
        Rankings will appear here once published sample scores are available.
      </p>
    </div>
  );
}
