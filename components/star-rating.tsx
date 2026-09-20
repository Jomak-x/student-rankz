import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  showValue?: boolean;
  className?: string;
}

export function StarRating({
  value,
  max = 5,
  size = "md",
  showValue = false,
  className,
}: StarRatingProps) {
  const sizeMap = { sm: "size-3", md: "size-4", lg: "size-5" };
  const textMap = { sm: "text-xs", md: "text-sm", lg: "text-base" };

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span className="inline-flex items-center gap-0.5" aria-hidden="true">
        {Array.from({ length: max }).map((_, i) => {
          const filled = i < Math.floor(value);
          const partial = !filled && i < value;
          return (
            <Star
              key={i}
              className={cn(sizeMap[size], {
                "fill-primary text-primary": filled,
                "fill-primary/40 text-primary/40": partial,
                "fill-muted text-muted-foreground/30": !filled && !partial,
              })}
            />
          );
        })}
      </span>
      {showValue && (
        <span className={cn("font-medium tabular-nums text-foreground", textMap[size])}>
          {value.toFixed(1)}
        </span>
      )}
      <span className="sr-only">
        {value.toFixed(1)} out of {max} stars
      </span>
    </span>
  );
}
