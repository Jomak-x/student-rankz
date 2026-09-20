import Link from "next/link";
import type { University } from "@/lib/demo-data";
import { StarRating } from "./star-rating";
import { Badge } from "./ui/badge";
import { Card, CardContent } from "./ui/card";
import { MapPin, Users } from "lucide-react";

interface UniversityCardProps {
  university: University;
  compact?: boolean;
}

export function UniversityCard({ university, compact = false }: UniversityCardProps) {
  return (
    <Link href={`/universities/${university.id}`} aria-label={`View ${university.name}`}>
      <Card className="h-full hover:border-primary/40 transition-colors group">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-sm leading-tight group-hover:text-primary transition-colors truncate">
                {university.name}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <MapPin className="size-3 shrink-0" />
                {university.city}, {university.country}
              </p>
            </div>
            <Badge variant="outline" className="shrink-0 text-xs">
              {university.countryCode}
            </Badge>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <StarRating value={university.scores.overall} size="sm" showValue />
            <span className="text-xs text-muted-foreground">
              ({university.reviewCount} demo reviews)
            </span>
          </div>

          {!compact && (
            <>
              <p className="mt-2 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                {university.description}
              </p>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex flex-wrap gap-1">
                  {university.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs font-normal py-0">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                  <Users className="size-3" />
                  {(university.studentCount / 1000).toFixed(0)}k students
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
