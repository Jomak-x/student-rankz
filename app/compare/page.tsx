"use client";

import { useCompare } from "@/hooks/use-compare";
import { getUniversity, universities } from "@/lib/demo-data";
import { StarRating } from "@/components/star-rating";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, PlusCircle, GitCompareArrows } from "lucide-react";
import Link from "next/link";

const scoreKeys: { key: string; label: string }[] = [
  { key: "overall", label: "Overall" },
  { key: "teaching", label: "Teaching quality" },
  { key: "support", label: "Student support" },
  { key: "facilities", label: "Facilities" },
  { key: "administration", label: "Administration" },
  { key: "value", label: "Value for money" },
  { key: "socialLife", label: "Social life" },
];

function ScoreCell({ value, best }: { value: number; best: number }) {
  const isBest = value === best;
  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className={`text-base font-semibold tabular-nums ${isBest ? "text-primary" : "text-foreground"}`}
      >
        {value.toFixed(1)}
      </span>
      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden max-w-[72px]">
        <div
          className={`h-full rounded-full transition-all ${isBest ? "bg-primary" : "bg-muted-foreground/40"}`}
          style={{ width: `${(value / 5) * 100}%` }}
        />
      </div>
    </div>
  );
}

export default function ComparePage() {
  const { selected, remove, toggle, canAdd, hydrated } = useCompare();

  const unis = selected.map((id) => getUniversity(id)).filter(Boolean);
  const available = universities.filter((u) => !selected.includes(u.id));

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
        <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <GitCompareArrows className="size-5 text-primary" />
          <h1 className="text-2xl font-bold">Compare Universities</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Select up to 3 universities to compare student-experience scores.{" "}
          <Badge variant="secondary" className="text-xs font-normal ml-1">
            Demo sample data
          </Badge>
        </p>
      </div>

      {/* Slot selectors */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[0, 1, 2].map((slot) => {
          const uni = unis[slot];
          return (
            <div
              key={slot}
              className="border border-border rounded-xl p-4 min-h-[100px] flex flex-col"
            >
              {uni ? (
                <div className="flex-1 flex flex-col gap-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/universities/${uni.id}`}
                      className="font-semibold text-sm hover:text-primary transition-colors leading-tight"
                    >
                      {uni.name}
                    </Link>
                    <button
                      onClick={() => remove(uni.id)}
                      aria-label={`Remove ${uni.name} from comparison`}
                      className="text-muted-foreground hover:text-foreground rounded"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {uni.city}, {uni.country}
                  </p>
                  <StarRating value={uni.scores.overall} size="sm" showValue />
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
                  {canAdd ? (
                    <>
                      <p className="text-xs text-muted-foreground">Slot {slot + 1}</p>
                      <Select
                        onValueChange={(id) => id && toggle(id)}
                        value=""
                      >
                        <SelectTrigger className="w-full text-xs" aria-label="Add university to compare">
                          <PlusCircle className="size-3.5 mr-1.5" />
                          <SelectValue placeholder="Add university" />
                        </SelectTrigger>
                        <SelectContent>
                          {available.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">—</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {unis.length === 0 ? (
        <div className="py-16 flex flex-col items-center gap-4 text-center border border-dashed border-border rounded-xl">
          <GitCompareArrows className="size-10 text-muted-foreground/40" />
          <div>
            <p className="font-medium text-sm">No universities selected</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add universities from the slots above or from a university page.
            </p>
          </div>
          <Link href="/universities">
            <Button variant="outline" size="sm">
              Browse universities
            </Button>
          </Link>
        </div>
      ) : unis.length === 1 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          Add at least one more university to compare.
        </p>
      ) : (
        /* Comparison table */
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 pr-4 font-medium text-muted-foreground w-40">
                  Category
                </th>
                {unis.map((uni) => (
                  <th key={uni!.id} className="text-center py-3 px-3 font-medium">
                    <Link
                      href={`/universities/${uni!.id}`}
                      className="hover:text-primary transition-colors"
                    >
                      {uni!.name}
                    </Link>
                    <div className="text-xs font-normal text-muted-foreground mt-0.5">
                      {uni!.city}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scoreKeys.map(({ key, label }) => {
                const values = unis.map((u) => (u!.scores as Record<string, number>)[key]);
                const best = Math.max(...values);
                return (
                  <tr key={key} className="border-b border-border/50">
                    <td className="py-3 pr-4 text-muted-foreground">{label}</td>
                    {values.map((val, i) => (
                      <td key={i} className="py-3 px-3 text-center">
                        <ScoreCell value={val} best={best} />
                      </td>
                    ))}
                  </tr>
                );
              })}
              <tr>
                <td className="py-3 pr-4 text-muted-foreground">Demo reviews</td>
                {unis.map((uni) => (
                  <td key={uni!.id} className="py-3 px-3 text-center">
                    <span className="tabular-nums">{uni!.reviewCount}</span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          <p className="text-xs text-muted-foreground mt-3">
            Scores are fictional demo fixtures. Best score in each row highlighted in orange.
          </p>
        </div>
      )}
    </div>
  );
}
