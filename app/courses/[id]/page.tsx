import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCatalogService } from "@/server/catalog";
import { readCatalog } from "@/server/catalog/read";
import { CatalogNotice } from "@/components/catalog/catalog-notice";
import { DetailRating, DetailReviews, DetailShell, detailPageNumber, type DetailPageProps } from "@/components/catalog/detail";
import { ScoreBar } from "@/components/score-bar";
import { ServerReviewComposer } from "@/components/server-review-composer";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export const dynamic = "force-dynamic";
const loadCourse = cache((id: string) => readCatalog(() => getCatalogService().getCourseDetail(id)));

export async function generateMetadata({ params }: DetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const result = await loadCourse(id);
  return { title: result.status === "ready" ? result.data ? `${result.data.name} · Course Reviews` : "Course not found" : "Course directory unavailable" };
}

export default async function CoursePage({ params, searchParams }: DetailPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const result = await loadCourse(id);
  if (result.status !== "ready") return <DetailShell><CatalogNotice kind={result.status} /></DetailShell>;
  const course = result.data;
  if (!course) notFound();
  const reviews = await readCatalog(() => getCatalogService().listCourseReviews(course.id, { page: detailPageNumber(query.reviewPage) }));
  const scoreLabels: { key: keyof typeof course.scores; label: string }[] = [
    { key: "workload", label: "Workload balance" },
    { key: "organisation", label: "Organisation" },
    { key: "clarity", label: "Content clarity" },
    { key: "assessmentFairness", label: "Assessment fairness" },
  ];

  return (
    <DetailShell>
      <nav aria-label="Breadcrumb" className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
        <Link href="/courses" className="hover:text-primary">Courses</Link><span>/</span>
        <Link href={`/universities/${course.universitySlug}`} className="hover:text-primary">{course.universityName}</Link><span>/</span><span className="text-foreground">{course.name}</span>
      </nav>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start gap-2"><h1 className="text-2xl font-bold leading-tight">{course.name}</h1><Badge variant="outline">{course.code}</Badge><Badge variant="secondary" className="capitalize">{course.level}</Badge></div>
          <p className="mt-2 text-sm text-muted-foreground">{course.credits} credits{course.department && ` · ${course.department}`}</p>
          <Link href={`/universities/${course.universitySlug}`} className="mt-1 inline-block text-sm text-primary hover:underline">{course.universityName}</Link>
          <DetailRating value={course.scores.overall} reviewCount={course.reviewCount} />
        </div>
        <ServerReviewComposer targetType="course" targetId={course.id} universityId={course.universityId} targetName={course.name} />
      </div>
      <Separator />
      <section className="space-y-2"><h2 className="font-semibold">About this course</h2><p className="text-sm leading-relaxed text-muted-foreground">{course.description ?? "No description is available yet."}</p></section>
      <section className="space-y-3">
        <h2 className="font-semibold">Category scores <span className="text-xs font-normal text-muted-foreground">· synthetic sample data</span></h2>
        <div className="max-w-xl space-y-3">{scoreLabels.map(({ key, label }) => <ScoreBar key={key} label={label} value={course.scores[key]} />)}</div>
      </section>
      {course.offerings.length > 0 && <section className="space-y-3"><h2 className="font-semibold">Course offerings</h2><ul className="flex flex-wrap gap-2">{course.offerings.map((offering) => <li key={offering.id}><Badge variant="outline">{offering.term} · {offering.academicYear}</Badge></li>)}</ul></section>}
      <section className="space-y-3">
        <h2 className="font-semibold">Instructors</h2>
        {course.instructors.length === 0 ? <p className="text-sm text-muted-foreground">No instructors listed yet.</p> : <div className="grid gap-3 sm:grid-cols-2">{course.instructors.map((instructor) => (
          <Link key={instructor.id} href={`/instructors/${instructor.id}`} className="group rounded-lg border border-border p-4 transition-colors hover:border-primary/40"><h3 className="text-sm font-medium group-hover:text-primary">{instructor.fullName}</h3>{instructor.title && <p className="mt-1 text-xs text-muted-foreground">{instructor.title}</p>}</Link>
        ))}</div>}
      </section>
      <DetailReviews result={reviews} pathname={`/courses/${course.id}`} searchParams={query} />
    </DetailShell>
  );
}
