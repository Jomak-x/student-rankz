import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getCourse,
  getUniversity,
  getInstructorsByIds,
  getReviewsByTarget,
  courses,
} from "@/lib/demo-data";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StarRating } from "@/components/star-rating";
import { ScoreBar } from "@/components/score-bar";
import { ReviewCard } from "@/components/review-card";
import { ReviewComposer } from "@/components/review-composer";
import Link from "next/link";
import { ArrowRight, BookOpen, Calendar, Layers } from "lucide-react";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const course = getCourse(id);
  if (!course) return { title: "Not found" };
  return { title: `${course.name} · Course Reviews` };
}

export function generateStaticParams() {
  return courses.map((c) => ({ id: c.id }));
}

export default async function CoursePage({ params }: Props) {
  const { id } = await params;
  const course = getCourse(id);
  if (!course) notFound();

  const uni = getUniversity(course.universityId);
  const courseInstructors = getInstructorsByIds(course.instructorIds);
  const courseReviews = getReviewsByTarget("course", id);

  const scoreLabels: { key: keyof typeof course.scores; label: string }[] = [
    { key: "workload", label: "Workload balance" },
    { key: "organisation", label: "Organisation" },
    { key: "clarity", label: "Content clarity" },
    { key: "assessmentFairness", label: "Assessment fairness" },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
      {/* Breadcrumb */}
      <nav className="text-xs text-muted-foreground mb-4 flex items-center gap-1.5 flex-wrap">
        <Link href="/courses" className="hover:text-foreground">
          Courses
        </Link>
        <span>/</span>
        {uni && (
          <>
            <Link href={`/universities/${uni.id}`} className="hover:text-foreground">
              {uni.name}
            </Link>
            <span>/</span>
          </>
        )}
        <span className="text-foreground">{course.name}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6 mb-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap">
            <h1 className="text-2xl font-bold leading-tight">{course.name}</h1>
            <Badge variant="outline" className="shrink-0 mt-1">
              {course.code}
            </Badge>
            <Badge variant="secondary" className="capitalize font-normal shrink-0 mt-1">
              {course.level}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
            {uni && (
              <span className="flex items-center gap-1">
                <BookOpen className="size-3.5" />
                <Link href={`/universities/${uni.id}`} className="hover:text-primary">
                  {uni.name}
                </Link>
              </span>
            )}
            <span className="flex items-center gap-1">
              <Layers className="size-3.5" /> {course.department}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="size-3.5" /> {course.semester}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <StarRating value={course.scores.overall} showValue />
            <span className="text-sm text-muted-foreground">{course.reviewCount} demo reviews</span>
            <Badge variant="secondary" className="text-xs font-normal">
              Sample data
            </Badge>
          </div>
        </div>
        <div className="shrink-0">
          <ReviewComposer targetType="course" targetId={id} targetName={course.name} />
        </div>
      </div>

      <Separator className="mb-6" />

      <Tabs defaultValue="overview">
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="reviews">Reviews ({courseReviews.length})</TabsTrigger>
          {courseInstructors.length > 0 && (
            <TabsTrigger value="instructors">
              Instructors ({courseInstructors.length})
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div>
            <h2 className="font-semibold mb-2">About this course</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{course.description}</p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {course.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs font-normal">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <h2 className="font-semibold mb-3">
              Category scores
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                — demo, {course.reviewCount} responses
              </span>
            </h2>
            <div className="space-y-3 max-w-xl">
              {scoreLabels.map(({ key, label }) => (
                <ScoreBar key={key} label={label} value={course.scores[key]} />
              ))}
            </div>
          </div>

          {courseReviews.length > 0 && (
            <div>
              <h2 className="font-semibold mb-3">Recent demo reviews</h2>
              <div className="space-y-3">
                {courseReviews.slice(0, 2).map((r) => (
                  <ReviewCard key={r.id} review={r} />
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="reviews" className="space-y-4">
          {courseReviews.length > 0 ? (
            courseReviews.map((r) => <ReviewCard key={r.id} review={r} />)
          ) : (
            <p className="text-muted-foreground text-sm py-8 text-center">No demo reviews yet.</p>
          )}
          <div className="pt-2">
            <ReviewComposer targetType="course" targetId={id} targetName={course.name} />
          </div>
        </TabsContent>

        {courseInstructors.length > 0 && (
          <TabsContent value="instructors" className="space-y-3">
            {courseInstructors.map((inst) => (
              <Link
                key={inst.id}
                href={`/instructors/${inst.id}`}
                className="flex items-start justify-between gap-4 border border-border rounded-lg p-4 hover:border-primary/40 transition-colors group"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-sm group-hover:text-primary transition-colors">
                    {inst.name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {inst.role} · {inst.department}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                    {inst.bio}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <StarRating value={inst.scores.overall} size="sm" showValue />
                  <span className="text-xs text-muted-foreground">{inst.reviewCount} reviews</span>
                  <ArrowRight className="size-4 text-muted-foreground mt-1" />
                </div>
              </Link>
            ))}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
