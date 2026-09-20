"use client";

import { useMemo, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UniversityCard } from "@/components/university-card";
import { universities, countries } from "@/lib/demo-data";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function UniversitiesContent() {
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(initialQ);
  const [country, setCountry] = useState("all");
  const [sort, setSort] = useState<"rating" | "reviews" | "name">("rating");

  const filtered = useMemo(() => {
    let result = [...universities];
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.city.toLowerCase().includes(q) ||
          u.country.toLowerCase().includes(q) ||
          u.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    if (country !== "all") {
      result = result.filter((u) => u.country === country);
    }
    if (sort === "rating") result.sort((a, b) => b.scores.overall - a.scores.overall);
    if (sort === "reviews") result.sort((a, b) => b.reviewCount - a.reviewCount);
    if (sort === "name") result.sort((a, b) => a.name.localeCompare(b.name));
    return result;
  }, [query, country, sort]);

  const hasFilters = query || country !== "all";

  const clearFilters = () => {
    setQuery("");
    setCountry("all");
  };

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Universities</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Student-experience ratings for EU universities — demo sample data
          </p>
        </div>
      </div>

      {/* Filters */}
      <div
        className="flex flex-col sm:flex-row gap-3 mb-6"
        role="search"
        aria-label="Filter universities"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, city, or subject…"
            className="pl-9"
            aria-label="Search universities"
          />
        </div>
        <Select value={country} onValueChange={(v) => setCountry(v ?? "all")}>
          <SelectTrigger className="w-full sm:w-40" aria-label="Filter by country">
            <SlidersHorizontal className="size-3.5 mr-1.5 shrink-0" />
            <SelectValue placeholder="Country" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All countries</SelectItem>
            {countries.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort((v ?? "rating") as typeof sort)}>
          <SelectTrigger className="w-full sm:w-36" aria-label="Sort by">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="rating">Top rated</SelectItem>
            <SelectItem value="reviews">Most reviewed</SelectItem>
            <SelectItem value="name">Name A–Z</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Active filters */}
      {hasFilters && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {query && (
            <Badge variant="secondary" className="gap-1 pr-1">
              &ldquo;{query}&rdquo;
              <button
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="rounded hover:bg-muted"
              >
                <X className="size-3" />
              </button>
            </Badge>
          )}
          {country !== "all" && (
            <Badge variant="secondary" className="gap-1 pr-1">
              {country}
              <button
                onClick={() => setCountry("all")}
                aria-label="Clear country filter"
                className="rounded hover:bg-muted"
              >
                <X className="size-3" />
              </button>
            </Badge>
          )}
          <button
            onClick={clearFilters}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Results */}
      <p className="text-xs text-muted-foreground mb-4">
        {filtered.length} {filtered.length === 1 ? "university" : "universities"}
      </p>

      {filtered.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((uni) => (
            <UniversityCard key={uni.id} university={uni} />
          ))}
        </div>
      ) : (
        <div className="py-16 text-center">
          <p className="text-muted-foreground mb-3">No universities match your filters.</p>
          <Button variant="outline" size="sm" onClick={clearFilters}>
            Reset filters
          </Button>
        </div>
      )}
    </div>
  );
}

export default function UniversitiesPage() {
  return (
    <Suspense>
      <UniversitiesContent />
    </Suspense>
  );
}
