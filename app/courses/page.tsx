import Link from "next/link";
import { Search } from "lucide-react";
import type { CatalogCourse, CatalogPage } from "@/lib/catalog-types";
import { CatalogNotice } from "@/components/catalog/catalog-notice";
import { StarRating } from "@/components/star-rating";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCatalogService } from "@/server/catalog";
import { readCatalog } from "@/server/catalog/read";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

function valueOf(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

function pageOf(value: string | undefined) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function pageHref(q: string | undefined, level: string | undefined, sort: string | undefined, page: number) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (level) params.set("level", level);
  if (sort) params.set("sort", sort);
  params.set("page", String(page));
  return `/courses?${params.toString()}`;
}

export default async function CoursesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = valueOf(params.q);
  const level = valueOf(params.level);
  const sort = valueOf(params.sort) ?? "overall";
  const page = pageOf(valueOf(params.page));
  const catalog = await readCatalog(() => getCatalogService().listCourses({ q, level, sort, page }));

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Courses</h1>
        <p className="text-sm text-muted-foreground mt-1">Course experience sample reviews — workload, organisation, and clarity.</p>
      </div>

      <form key={JSON.stringify([q, level, sort])} method="get" className="flex flex-col sm:flex-row gap-3 mb-6" role="search" aria-label="Filter courses">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder="Search courses…" className="pl-9" aria-label="Search courses" />
        </div>
        <label className="sr-only" htmlFor="level">Filter by level</label>
        <select id="level" name="level" defaultValue={level ?? ""} className="h-8 w-full sm:w-36 rounded-lg border border-input bg-transparent px-2.5 text-sm">
          <option value="">All levels</option>
          <option value="bachelor">Bachelor</option>
          <option value="master">Master</option>
          <option value="phd">PhD</option>
        </select>
        <label className="sr-only" htmlFor="sort">Sort courses</label>
        <select id="sort" name="sort" defaultValue={sort} className="h-8 w-full sm:w-36 rounded-lg border border-input bg-transparent px-2.5 text-sm">
          <option value="overall">Top rated</option>
          <option value="name">Name A–Z</option>
          <option value="code">Course code</option>
        </select>
        <Button type="submit">Apply</Button>
      </form>

      {catalog.status === "ready" ? (
        <CourseResults q={q} level={level} sort={sort} data={catalog.data} />
      ) : (
        <CatalogNotice kind={catalog.status} />
      )}
    </div>
  );
}

function CourseResults({ q, level, sort, data }: { q: string | undefined; level: string | undefined; sort: string; data: CatalogPage<CatalogCourse> }) {
  const hasFilters = Boolean(q || level);

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-xs text-muted-foreground">{data.total} {data.total === 1 ? "course" : "courses"}</p>
        {hasFilters && <Link href="/courses" className="text-xs text-primary hover:underline">Clear filters</Link>}
      </div>
      {data.items.length === 0 && <CatalogNotice kind="empty" title={hasFilters ? "No courses match your filters" : undefined} />}
      <div className="space-y-3">
        {data.items.map((course) => <CourseRow key={course.id} course={course} />)}
      </div>
      {(data.page > 1 || data.hasNextPage) && (
        <nav className="mt-6 flex items-center justify-between" aria-label="Course pages">
          {data.page > 1 ? <Link className="text-sm text-primary hover:underline" href={pageHref(q, level, sort, data.page - 1)}>Previous</Link> : <span />}
          <span className="text-xs text-muted-foreground">Page {data.page} of {data.totalPages}</span>
          {data.hasNextPage ? <Link className="text-sm text-primary hover:underline" href={pageHref(q, level, sort, data.page + 1)}>Next</Link> : <span />}
        </nav>
      )}
    </>
  );
}

function CourseRow({ course }: { course: CatalogCourse }) {
  const score = course.scores.overall;
  return (
    <Link href={`/courses/${course.id}`} className="flex items-start justify-between gap-4 border border-border rounded-lg p-4 hover:border-primary/40 transition-colors group block">
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2 flex-wrap">
          <p className="font-semibold text-sm group-hover:text-primary transition-colors">{course.name}</p>
          <Badge variant="outline" className="text-xs shrink-0">{course.code}</Badge>
          <Badge variant="secondary" className="text-xs capitalize font-normal shrink-0">{course.level}</Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {course.universityName}{course.department ? ` · ${course.department}` : ""} · {course.credits} ECTS
        </p>
        {course.description && <p className="mt-2 text-xs text-muted-foreground line-clamp-2 leading-relaxed">{course.description}</p>}
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        {score === null ? <span className="text-xs font-medium text-muted-foreground">No score</span> : <StarRating value={score} size="sm" showValue />}
        <span className="text-xs text-muted-foreground">{course.reviewCount} sample {course.reviewCount === 1 ? "review" : "reviews"}</span>
      </div>
    </Link>
  );
}
