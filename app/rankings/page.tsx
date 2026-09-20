import type { Metadata } from "next";
import { RankingsList } from "@/components/rankings-list";
import { rankUniversities, RANKINGS_LIMIT } from "@/lib/rankings";
import { universities } from "@/lib/demo-data";

export const metadata: Metadata = {
  title: "Rankings",
  description:
    "Top EU universities by student-experience score. Demo prototype — sample data only.",
};

export default function RankingsPage() {
  const ranked = rankUniversities(universities, RANKINGS_LIMIT);

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
      <header>
        <p className="text-xs font-medium uppercase tracking-wide text-primary">
          Student experience
        </p>
        <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight">
          Top {RANKINGS_LIMIT} universities
        </h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
          Ranked by the average overall score students give their day-to-day
          experience — teaching, support, value and social life. This reflects
          how students rate living and studying there, not academic prestige.
        </p>
        {ranked.length > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            Showing {ranked.length} of {universities.length} in the current
            sample · scores and review counts are demo data
          </p>
        )}
      </header>

      <section className="mt-6">
        <RankingsList items={ranked} />
      </section>

      <footer className="mt-8 border-t border-border pt-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Order is determined deterministically from sample review data: overall
          score first, then review count, then name. All scores and review
          counts are illustrative fixtures — not real published rankings.
        </p>
      </footer>
    </div>
  );
}
