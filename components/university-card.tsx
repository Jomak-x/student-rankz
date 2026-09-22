import Link from "next/link";
import { MapPin, Users } from "lucide-react";
import type { CatalogUniversity } from "@/lib/catalog-types";
import { CompareToggle } from "./compare-toggle";
import { StarRating } from "./star-rating";
import { Badge } from "./ui/badge";
import { Card, CardContent } from "./ui/card";

interface UniversityCardProps {
  university: CatalogUniversity;
  compact?: boolean;
}

export function UniversityCard({ university, compact = false }: UniversityCardProps) {
  const score = university.scores.overall;

  return (
    <Card className="h-full hover:border-primary/40 transition-colors group">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/universities/${university.slug}`} className="min-w-0" aria-label={`View ${university.name}`}>
            <p className="font-semibold text-sm leading-tight group-hover:text-primary transition-colors truncate">
              {university.name}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <MapPin className="size-3 shrink-0" />
              {university.city}, {university.country}
            </p>
          </Link>
          <Badge variant="outline" className="shrink-0 text-xs">
            {university.countryCode}
          </Badge>
        </div>

        <div className="mt-3 flex items-center gap-2">
          {score === null ? (
            <span className="text-xs font-medium text-muted-foreground">No score</span>
          ) : (
            <StarRating value={score} size="sm" showValue />
          )}
          <span className="text-xs text-muted-foreground">
            ({university.reviewCount} sample {university.reviewCount === 1 ? "review" : "reviews"})
          </span>
        </div>

        {!compact && (
          <>
            {university.description && (
              <p className="mt-2 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                {university.description}
              </p>
            )}
            <div className="mt-3 flex items-center justify-between gap-2">
              <CompareToggle universityId={university.slug} />
              {university.studentCount !== null && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                  <Users className="size-3" />
                  {university.studentCount.toLocaleString()} students
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
