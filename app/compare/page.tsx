"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCompare } from "@/hooks/use-compare";
import type { CatalogUniversityDetail, UniversityExperienceScores } from "@/lib/catalog-types";
import { CatalogNotice } from "@/components/catalog/catalog-notice";
import { Button } from "@/components/ui/button";

const dimensions: [keyof UniversityExperienceScores, string][] = [
  ["overall", "Overall"], ["teaching", "Teaching"], ["support", "Support"], ["facilities", "Facilities"],
  ["administration", "Administration"], ["value", "Value"], ["socialLife", "Social life"],
];
type Result = { status: "ready"; data: (CatalogUniversityDetail | null)[] } | { status: "unconfigured" | "unavailable" };

export default function ComparePage() {
  const { selected, remove, hydrated } = useCompare();
  const key = selected.join(",");
  const [loaded, setLoaded] = useState<{ key: string; result: Result } | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!hydrated || !key) return;
    const controller = new AbortController();
    const query = new URLSearchParams();
    key.split(",").forEach(slug => query.append("slug", slug));
    void fetch(`/api/catalog/compare?${query}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const result: Result = await response.json();
        if (!controller.signal.aborted) setLoaded({ key, result: result.status === "ready" || result.status === "unconfigured" ? result : { status: "unavailable" } });
      }).catch(() => { if (!controller.signal.aborted) setLoaded({ key, result: { status: "unavailable" } }); });
    return () => controller.abort();
  }, [key, hydrated, retry]);
  const result = loaded?.key === key ? loaded.result : null;
  return <div className="max-w-6xl mx-auto px-4 py-10 space-y-6">
    <div><h1 className="text-3xl font-bold">Compare universities</h1><p className="mt-2 text-muted-foreground">Choose up to three universities. Scores reflect stored sample reviews, not academic prestige.</p></div>
    <Link className="text-primary underline underline-offset-4" href="/universities">Add universities</Link>
    {selected.length > 0 && <div className="flex flex-wrap gap-2">{selected.map(slug => <Button key={slug} size="sm" variant="outline" onClick={() => remove(slug)} aria-label={`Remove ${slug}`}>Remove {slug}</Button>)}</div>}
    {!hydrated ? <p role="status">Loading your selection…</p> : !selected.length ? <CatalogNotice kind="empty" title="No universities selected" /> : !result ? <p role="status">Loading comparison…</p> : result.status !== "ready" ? <><CatalogNotice kind={result.status} /><Button variant="outline" onClick={() => setRetry(value => value + 1)}>Try again</Button></> : <>
      {result.data.some(item => !item) && <p role="status" className="text-sm text-muted-foreground">Some selected universities are no longer available. Remove them to choose another.</p>}
      <div className="overflow-x-auto rounded-lg border border-border"><table className="w-full text-sm"><thead><tr><th className="p-4 text-left">Student experience</th>{result.data.filter((item): item is CatalogUniversityDetail => item !== null).map(uni => <th className="p-4 min-w-40" key={uni.id}><Link className="text-primary" href={`/universities/${uni.slug}`}>{uni.name}</Link><p className="text-xs text-muted-foreground font-normal mt-1">{uni.reviewCount} sample reviews</p></th>)}</tr></thead>
        <tbody>{dimensions.map(([dimension, label]) => <tr className="border-t border-border" key={dimension}><th className="p-4 text-left font-medium">{label}</th>{result.data.filter((item): item is CatalogUniversityDetail => item !== null).map(uni => <td className="p-4 text-center tabular-nums" key={uni.id}>{uni.scores[dimension] === null ? "Not rated" : uni.scores[dimension]?.toFixed(1)}</td>)}</tr>)}</tbody></table></div>
    </>}
  </div>;
}
