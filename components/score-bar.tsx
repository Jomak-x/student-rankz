import { cn } from "@/lib/utils";

interface ScoreBarProps {
  label: string;
  value: number;
  max?: number;
  className?: string;
}

export function ScoreBar({ label, value, max = 5, className }: ScoreBarProps) {
  const pct = (value / max) * 100;

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="text-sm text-muted-foreground w-36 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden" aria-hidden="true">
        <div
          className="h-full bg-primary rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm font-medium tabular-nums w-8 text-right">{value.toFixed(1)}</span>
    </div>
  );
}
