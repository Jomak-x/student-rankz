"use client";

import { useState } from "react";
import { Search, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UniversityCard } from "@/components/university-card";
import { RankingsList } from "@/components/rankings-list";
import { universities } from "@/lib/demo-data";
import { rankUniversities } from "@/lib/rankings";
import { useRouter } from "next/navigation";

const featured = universities.slice(0, 6);
const topThree = rankUniversities(universities, 3);

export default function HomePage() {
  const [query, setQuery] = useState("");
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/universities${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`);
  };

  return (
    <div className="flex flex-col">
      {/* Compact hero */}
      <section className="border-b border-border px-4 sm:px-6 py-8 sm:py-10">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Find your university.
          </h1>
          <p className="mt-1.5 text-muted-foreground text-sm">
            Student-experience ratings for EU universities and courses — teaching, support, facilities.
          </p>

          <form onSubmit={handleSearch} className="mt-4 flex gap-2 max-w-md">
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

      {/* University grid — immediately useful */}
      <section className="px-4 sm:px-6 py-6">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Universities
            </h2>
            <Link
              href="/universities"
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              View all <ArrowRight className="size-3" />
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {featured.map((uni) => (
              <UniversityCard key={uni.id} university={uni} />
            ))}
          </div>
        </div>
      </section>
      {/* Rankings preview — compact editorial rows */}
      <section className="border-t border-border px-4 sm:px-6 py-6">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Top by student experience
            </h2>
            <Link
              href="/rankings"
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              All rankings <ArrowRight className="size-3" />
            </Link>
          </div>
          <RankingsList items={topThree} compact />
        </div>
      </section>
    </div>
  );
}
