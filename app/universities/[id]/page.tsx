import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MapPin, Calendar, Users } from "lucide-react";
import { getCatalogService } from "@/server/catalog";
import { readCatalog } from "@/server/catalog/read";
import { CatalogNotice } from "@/components/catalog/catalog-notice";
import { DetailPagination, DetailRating, DetailReviews, DetailScore, DetailShell, detailPageNumber, type DetailPageProps } from "@/components/catalog/detail";
import { ScoreBar } from "@/components/score-bar";
import { ServerReviewComposer } from "@/components/server-review-composer";
import { CompareToggle } from "@/components/compare-toggle";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export const dynamic = "force-dynamic";
const loadUniversity = cache((slug: string) => readCatalog(() => getCatalogService().getUniversityDetail(slug)));

export async function generateMetadata({ params }: DetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const result = await loadUniversity(id);
  return { title: result.status === "ready" ? result.data ? `${result.data.name} · Student Reviews` : "University not found" : "University directory unavailable" };
}

export default async function UniversityPage({ params, searchParams }: DetailPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const result = await loadUniversity(id);
  if (result.status !== "ready") return <DetailShell><CatalogNotice kind={result.status} /></DetailShell>;
  const uni = result.data;
  if (!uni) notFound();

  const service = getCatalogService();
  const [reviews, courses] = await Promise.all([
    readCatalog(() => service.listUniversityReviews(uni.slug, { page: detailPageNumber(query.reviewPage) })),
    readCatalog(() => service.listCourses({ universityId: uni.id, page: detailPageNumber(query.coursePage) })),
  ]);
  const pathname = `/universities/${uni.slug}`;
  const scoreLabels: { key: keyof typeof uni.scores; label: string }[] = [
    { key: "teaching", label: "Teaching quality" },
    { key: "support", label: "Student support" },
    { key: "facilities", label: "Facilities" },
    { key: "administration", label: "Administration" },
    { key: "value", label: "Value for money" },
    { key: "socialLife", label: "Social life" },
  ];

  return (
    <DetailShell>
      <nav aria-label="Breadcrumb" className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
        <Link href="/universities" className="hover:text-primary">Universities</Link><span>/</span><span className="text-foreground">{uni.name}</span>
      </nav>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start gap-2"><h1 className="text-2xl font-bold leading-tight">{uni.name}</h1><Badge variant="outline">{uni.countryCode}</Badge></div>
          <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><MapPin className="size-3.5" />{uni.city}, {uni.country}</span>
            {uni.foundedYear !== null && <span className="flex items-center gap-1"><Calendar className="size-3.5" />Founded {uni.foundedYear}</span>}
            {uni.studentCount !== null && <span className="flex items-center gap-1"><Users className="size-3.5" />{uni.studentCount.toLocaleString("en-US")} students</span>}
          </div>
          <DetailRating value={uni.scores.overall} reviewCount={uni.reviewCount} />
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <CompareToggle universityId={uni.slug} />
          <ServerReviewComposer targetType="university" targetId={uni.id} universityId={uni.id} targetName={uni.name} />
        </div>
      </div>
      <Separator />
      <nav aria-label="University sections" className="flex flex-wrap gap-4 text-sm text-primary">
        <a href="#overview">Overview</a><a href="#courses">Courses ({uni.courseCount})</a><a href="#reviews">Sample reviews ({uni.reviewCount})</a>
      </nav>
      <section id="overview" className="space-y-3">
        <h2 className="font-semibold">About</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{uni.description ?? "No description is available yet."}</p>
        <Badge variant="secondary" className="capitalize">{uni.type}</Badge>
        {uni.programmes.length > 0 && <div className="space-y-2"><h3 className="text-sm font-medium">Programmes</h3><ul className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">{uni.programmes.map((programme) => <li key={programme.id}>{programme.name} · <span className="capitalize">{programme.level}</span></li>)}</ul></div>}
      </section>
      <section className="space-y-3">
        <h2 className="font-semibold">Category scores <span className="text-xs font-normal text-muted-foreground">· synthetic sample data</span></h2>
        <div className="max-w-xl space-y-3">{scoreLabels.map(({ key, label }) => <ScoreBar key={key} label={label} value={uni.scores[key]} />)}</div>
      </section>
      <section id="courses" className="scroll-mt-6 space-y-3">
        <h2 className="font-semibold">Courses</h2>
        {courses.status !== "ready" ? <CatalogNotice kind={courses.status} title="Courses could not be loaded" /> : <>
          {courses.data.items.length === 0 ? <CatalogNotice kind="empty" title="No courses on this page" /> : courses.data.items.map((course) => (
            <Link key={course.id} href={`/courses/${course.id}`} className="group flex flex-col gap-3 rounded-lg border border-border p-4 transition-colors hover:border-primary/40 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0"><h3 className="text-sm font-medium group-hover:text-primary">{course.name}</h3><p className="mt-1 text-xs text-muted-foreground">{course.code} · {course.credits} credits · <span className="capitalize">{course.level}</span>{course.department && ` · ${course.department}`}</p></div>
              <div className="shrink-0"><DetailScore value={course.scores.overall} /></div>
            </Link>
          ))}
          <DetailPagination pagination={courses.data} pathname={pathname} searchParams={query} pageKey="coursePage" anchor="courses" label="Courses" />
        </>}
      </section>
      <DetailReviews result={reviews} pathname={pathname} searchParams={query} />
    </DetailShell>
  );
}
