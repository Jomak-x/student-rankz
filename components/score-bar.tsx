import { cn } from "@/lib/utils";

interface ScoreBarProps {
  label: string;
  value: number | null;
  max?: number;
  className?: string;
}

export function ScoreBar({ label, value, max = 5, className }: ScoreBarProps) {
  const pct = value === null ? 0 : Math.max(0, Math.min(100, (value / max) * 100));

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="w-28 shrink-0 text-sm text-muted-foreground sm:w-36">{label}</span>
      <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        {value !== null && <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />}
      </div>
      <span className="w-14 shrink-0 text-right text-sm font-medium tabular-nums">{value === null ? "Unrated" : value.toFixed(1)}</span>
    </div>
  );
}
