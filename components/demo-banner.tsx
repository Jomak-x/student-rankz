"use client";

import { useState } from "react";
import { FlaskConical, X } from "lucide-react";

export function DemoBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200/70 dark:border-amber-900/50 py-1.5 px-4 flex items-center justify-between gap-2 text-xs text-amber-800 dark:text-amber-300">
      <span className="flex items-center gap-1.5">
        <FlaskConical className="size-3 shrink-0" aria-hidden="true" />
        <strong>Demo · sample data</strong>
        <span className="text-amber-700/70 dark:text-amber-400/70 hidden sm:inline">
          — all ratings and reviews are illustrative fixtures, not real published data
        </span>
      </span>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss demo notice"
        className="rounded text-amber-700/60 hover:text-amber-800 dark:text-amber-400/60 dark:hover:text-amber-300"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}
