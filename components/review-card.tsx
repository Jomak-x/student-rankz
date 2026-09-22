import type { CatalogSampleReview } from "@/lib/catalog-types";
import { Badge } from "./ui/badge";
import { Card, CardContent } from "./ui/card";

export function ReviewCard({ review }: { review: CatalogSampleReview }) {
  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="break-words text-sm font-medium">{review.title}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {review.authorAlias}
              {review.programmeLabel && ` · ${review.programmeLabel}`}
              {review.experienceYear !== null && ` · ${review.experienceYear}`}
            </p>
          </div>
          <Badge variant="secondary" className="text-xs font-normal">Synthetic sample review</Badge>
        </div>
        <p className="whitespace-pre-line break-words text-sm leading-relaxed text-foreground/90">{review.body}</p>
        {review.pros && <p className="break-words text-xs text-muted-foreground"><span className="font-medium text-primary">Pros: </span>{review.pros}</p>}
        {review.cons && <p className="break-words text-xs text-muted-foreground"><span className="font-medium">Cons: </span>{review.cons}</p>}
      </CardContent>
    </Card>
  );
}
