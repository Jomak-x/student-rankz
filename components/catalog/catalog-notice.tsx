import Link from "next/link";

export function CatalogNotice({ kind, title }: { kind: "unconfigured" | "unavailable" | "empty"; title?: string }) {
  const copy = {
    unconfigured: ["The directory is not available yet", "The directory has not been connected. Please check back later."],
    unavailable: ["The directory is temporarily unavailable", "We couldn't load the directory. Please try again later."],
    empty: ["Nothing to show yet", "No matching entries are available. Try changing your filters."],
  }[kind];
  return <div role="status" className="rounded-xl border border-border bg-muted/30 p-6 space-y-2">
    <h2 className="font-semibold">{title ?? copy[0]}</h2>
    <p className="text-sm text-muted-foreground">{copy[1]}</p>
    <Link href="/universities" className="inline-block text-sm text-primary underline underline-offset-4">Browse universities</Link>
  </div>;
}
