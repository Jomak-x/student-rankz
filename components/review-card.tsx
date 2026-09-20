import type { Review } from "@/lib/demo-data";
import { StarRating } from "./star-rating";
import { Badge } from "./ui/badge";
import { Card, CardContent } from "./ui/card";

interface ReviewCardProps {
  review: Review;
}

export function ReviewCard({ review }: ReviewCardProps) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <p className="font-medium text-sm">{review.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {review.authorAlias}
              {review.programme && ` · ${review.programme}`}
              {" · "}
              {review.year}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <StarRating value={review.rating} size="sm" showValue />
          </div>
        </div>
        <p className="text-sm leading-relaxed text-foreground/90">{review.body}</p>
        {(review.pros || review.cons) && (
          <div className="mt-3 flex flex-col gap-1.5">
            {review.pros && (
              <p className="text-xs text-muted-foreground">
                <span className="text-green-600 dark:text-green-400 font-medium">+ </span>
                {review.pros}
              </p>
            )}
            {review.cons && (
              <p className="text-xs text-muted-foreground">
                <span className="text-destructive font-medium">– </span>
                {review.cons}
              </p>
            )}
          </div>
        )}
        {review.verified && (
          <div className="mt-2">
            <Badge variant="secondary" className="text-xs font-normal">
              Demo · sample review
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
