"use client";

import { useState } from "react";
import { Search, ArrowRight, TrendingUp, BookOpen, UserCheck } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UniversityCard } from "@/components/university-card";
import { universities } from "@/lib/demo-data";
import { useRouter } from "next/navigation";

const featured = universities.slice(0, 3);

export default function HomePage() {
  const [query, setQuery] = useState("");
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/universities?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="border-b border-border bg-gradient-to-b from-muted/30 to-background px-4 sm:px-6 py-14 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="outline" className="mb-4 text-xs font-normal px-3 py-1">
            Demo prototype · sample data only
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
            Choose where to study.
            <br />
            <span className="text-primary">Know what studying there is really like.</span>
          </h1>
          <p className="mt-4 text-muted-foreground text-base max-w-lg mx-auto">
            Student-experience reviews for EU universities and courses — teaching, support,
            facilities and more. Ranked by students, not league tables.
          </p>

          <form onSubmit={handleSearch} className="mt-8 flex gap-2 max-w-md mx-auto">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search universities…"
                className="pl-9"
                aria-label="Search universities"
              />
            </div>
            <Button type="submit">Search</Button>
          </form>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-border px-4 sm:px-6 py-6">
        <div className="mx-auto max-w-4xl grid grid-cols-3 gap-4 text-center">
          {[
            { icon: TrendingUp, value: `${universities.length}`, label: "Universities" },
            {
              icon: BookOpen,
              value: `${universities.reduce((s, u) => s + u.reviewCount, 0)}+`,
              label: "Demo reviews",
            },
            { icon: UserCheck, value: "5", label: "Countries" },
          ].map(({ icon: Icon, value, label }) => (
            <div key={label} className="flex flex-col items-center gap-1">
              <Icon className="size-5 text-primary" aria-hidden="true" />
              <p className="text-xl font-bold tabular-nums">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Featured universities */}
      <section className="px-4 sm:px-6 py-10">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="font-semibold text-lg">Featured universities</h2>
            <Link
              href="/universities"
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              View all <ArrowRight className="size-3" />
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {featured.map((uni) => (
              <UniversityCard key={uni.id} university={uni} />
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border bg-muted/20 px-4 sm:px-6 py-10">
        <div className="mx-auto max-w-4xl">
          <h2 className="font-semibold text-lg text-center mb-6">How it works</h2>
          <div className="grid sm:grid-cols-3 gap-6 text-center">
            {[
              {
                title: "Search & filter",
                body: "Find universities by name, country, or subject area. Browse demo ratings and reviews.",
              },
              {
                title: "Compare up to 3",
                body: "Add universities to your comparison view and see scores across categories side by side.",
              },
              {
                title: "Write a review",
                body: "Share your experience. Drafts save privately to your device — nothing is published in this demo.",
              },
            ].map(({ title, body }) => (
              <div key={title} className="space-y-2">
                <p className="font-medium">{title}</p>
                <p className="text-sm text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
