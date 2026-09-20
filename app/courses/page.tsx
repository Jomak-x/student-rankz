"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StarRating } from "@/components/star-rating";
import { courses, getUniversity } from "@/lib/demo-data";
import Link from "next/link";

export default function CoursesPage() {
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("all");
  const [sort, setSort] = useState<"rating" | "name">("rating");

  const filtered = useMemo(() => {
    let result = [...courses];
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.code.toLowerCase().includes(q) ||
          c.department.toLowerCase().includes(q) ||
          c.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    if (level !== "all") {
      result = result.filter((c) => c.level === level);
    }
    if (sort === "rating") result.sort((a, b) => b.scores.overall - a.scores.overall);
    if (sort === "name") result.sort((a, b) => a.name.localeCompare(b.name));
    return result;
  }, [query, level, sort]);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Courses</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Course experience reviews — workload, organisation, clarity. Demo sample data.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search courses…"
            className="pl-9"
            aria-label="Search courses"
          />
        </div>
        <Select value={level} onValueChange={(v) => setLevel(v ?? "all")}>
          <SelectTrigger className="w-full sm:w-36" aria-label="Filter by level">
            <SelectValue placeholder="Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All levels</SelectItem>
            <SelectItem value="bachelor">Bachelor</SelectItem>
            <SelectItem value="master">Master</SelectItem>
            <SelectItem value="phd">PhD</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort((v ?? "rating") as typeof sort)}>
          <SelectTrigger className="w-full sm:w-36" aria-label="Sort by">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="rating">Top rated</SelectItem>
            <SelectItem value="name">Name A–Z</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        {filtered.length} {filtered.length === 1 ? "course" : "courses"}
      </p>

      {filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((course) => {
            const uni = getUniversity(course.universityId);
            return (
              <Link
                key={course.id}
                href={`/courses/${course.id}`}
                className="flex items-start justify-between gap-4 border border-border rounded-lg p-4 hover:border-primary/40 transition-colors group block"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2 flex-wrap">
                    <p className="font-semibold text-sm group-hover:text-primary transition-colors">
                      {course.name}
                    </p>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {course.code}
                    </Badge>
                    <Badge variant="secondary" className="text-xs capitalize font-normal shrink-0">
                      {course.level}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {uni?.name} · {course.department} · {course.credits} ECTS
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {course.tags.slice(0, 3).map((t) => (
                      <Badge key={t} variant="secondary" className="text-xs font-normal py-0">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <StarRating value={course.scores.overall} size="sm" showValue />
                  <span className="text-xs text-muted-foreground">{course.reviewCount} reviews</span>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="py-16 text-center">
          <p className="text-muted-foreground text-sm">No courses match your search.</p>
        </div>
      )}
    </div>
  );
}
