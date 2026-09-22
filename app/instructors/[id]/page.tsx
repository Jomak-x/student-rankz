import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { GraduationCap } from "lucide-react";
import { getCatalogService } from "@/server/catalog";
import { readCatalog } from "@/server/catalog/read";
import { CatalogNotice } from "@/components/catalog/catalog-notice";
import { DetailRating, DetailReviews, DetailShell, detailPageNumber, type DetailPageProps } from "@/components/catalog/detail";
import { ScoreBar } from "@/components/score-bar";
import { ServerReviewComposer } from "@/components/server-review-composer";
import { Separator } from "@/components/ui/separator";

export const dynamic = "force-dynamic";
const loadInstructor = cache((id: string) => readCatalog(() => getCatalogService().getInstructorDetail(id)));

export async function generateMetadata({ params }: DetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const result = await loadInstructor(id);
  return { title: result.status === "ready" ? result.data ? `${result.data.fullName} · Instructor Reviews` : "Instructor not found" : "Instructor directory unavailable" };
}

export default async function InstructorPage({ params, searchParams }: DetailPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const result = await loadInstructor(id);
  if (result.status !== "ready") return <DetailShell><CatalogNotice kind={result.status} /></DetailShell>;
  const instructor = result.data;
  if (!instructor) notFound();
  const reviews = await readCatalog(() => getCatalogService().listInstructorReviews(instructor.id, { page: detailPageNumber(query.reviewPage) }));
  const scoreLabels: { key: keyof typeof instructor.scores; label: string }[] = [
    { key: "clarity", label: "Explanation clarity" },
    { key: "support", label: "Student support" },
    { key: "expertise", label: "Subject expertise" },
    { key: "engagement", label: "Engagement" },
  ];

  return (
    <DetailShell>
      <nav aria-label="Breadcrumb" className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
        <Link href="/universities" className="hover:text-primary">Universities</Link><span>/</span>
        <Link href={`/universities/${instructor.universitySlug}`} className="hover:text-primary">{instructor.universityName}</Link><span>/</span><span className="text-foreground">{instructor.fullName}</span>
      </nav>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary/10"><GraduationCap className="size-8 text-primary" /></div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold leading-tight">{instructor.fullName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{[instructor.title, instructor.department].filter(Boolean).join(" · ")}</p>
          <Link href={`/universities/${instructor.universitySlug}`} className="mt-1 inline-block text-sm text-primary hover:underline">{instructor.universityName}</Link>
          <DetailRating value={instructor.scores.overall} reviewCount={instructor.reviewCount} />
        </div>
        <ServerReviewComposer targetType="instructor" targetId={instructor.id} universityId={instructor.universityId} targetName={instructor.fullName} />
      </div>
      <Separator />
      <section className="space-y-2"><h2 className="font-semibold">About</h2><p className="text-sm leading-relaxed text-muted-foreground">{instructor.bio ?? "No biography is available yet."}</p></section>
      <section className="space-y-3">
        <h2 className="font-semibold">Category scores <span className="text-xs font-normal text-muted-foreground">· synthetic sample data</span></h2>
        <div className="max-w-xl space-y-3">{scoreLabels.map(({ key, label }) => <ScoreBar key={key} label={label} value={instructor.scores[key]} />)}</div>
      </section>
      <section className="space-y-3">
        <h2 className="font-semibold">Courses taught</h2>
        {instructor.courses.length === 0 ? <p className="text-sm text-muted-foreground">No courses listed yet.</p> : <div className="grid gap-3 sm:grid-cols-2">{instructor.courses.map((course) => (
          <Link key={course.id} href={`/courses/${course.id}`} className="group rounded-lg border border-border p-4 transition-colors hover:border-primary/40"><h3 className="text-sm font-medium group-hover:text-primary">{course.name}</h3><p className="mt-1 text-xs text-muted-foreground">{course.code} · <span className="capitalize">{course.level}</span></p></Link>
        ))}</div>}
      </section>
      <DetailReviews result={reviews} pathname={`/instructors/${instructor.id}`} searchParams={query} />
    </DetailShell>
  );
}
