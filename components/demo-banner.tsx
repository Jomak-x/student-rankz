import { FlaskConical } from "lucide-react";

export function DemoBanner() {
  return (
    <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900/50 py-2 px-4 text-center text-xs text-amber-800 dark:text-amber-300 flex items-center justify-center gap-1.5">
      <FlaskConical className="size-3 shrink-0" />
      <span>
        <strong>Demo · sample data</strong> — all reviews, ratings, and rankings are fictional
        fixtures for prototype purposes only. Nothing shown represents real published reviews or
        verified student data.
      </span>
    </div>
  );
}
