import { AlertCircle } from "lucide-react";

export function AuthUnavailable() {
  return (
    <div
      role="status"
      className="flex gap-3 rounded-lg border border-border bg-muted/50 p-4 text-sm"
    >
      <AlertCircle
        className="mt-0.5 size-4 shrink-0 text-primary"
        aria-hidden="true"
      />
      <div className="space-y-1">
        <p className="font-medium text-foreground">
          Account access is temporarily unavailable
        </p>
        <p className="leading-relaxed text-muted-foreground">
          Please try again later. You can still browse universities and rankings.
        </p>
      </div>
    </div>
  );
}
