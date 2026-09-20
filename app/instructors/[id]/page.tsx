import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getInstructor,
  getUniversity,
  getCourse,
  getReviewsByTarget,
  instructors,
} from "@/lib/demo-data";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { StarRating } from "@/components/star-rating";
import { ScoreBar } from "@/components/score-bar";
import { ReviewCard } from "@/components/review-card";
import { ReviewComposer } from "@/components/review-composer";
import Link from "next/link";
import { BookOpen, GraduationCap } from "lucide-react";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const inst = getInstructor(id);
  if (!inst) return { title: "Not found" };
  return { title: `${inst.name} · Instructor Reviews` };
}

export function generateStaticParams() {
  return instructors.map((i) => ({ id: i.id }));
}

export default async function InstructorPage({ params }: Props) {
  const { id } = await params;
  const inst = getInstructor(id);
  if (!inst) notFound();

  const uni = getUniversity(inst.universityId);
  const instCourses = inst.courses.map(getCourse).filter(Boolean);
  const instReviews = getReviewsByTarget("instructor", id);

  const scoreLabels: { key: keyof typeof inst.scores; label: string }[] = [
    { key: "clarity", label: "Explanation clarity" },
    { key: "support", label: "Student support" },
    { key: "expertise", label: "Subject expertise" },
    { key: "engagement", label: "Engagement" },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8">
      {/* Breadcrumb */}
      <nav className="text-xs text-muted-foreground mb-4 flex items-center gap-1.5 flex-wrap">
        <Link href="/universities" className="hover:text-foreground">
          Universities
        </Link>
        {uni && (
          <>
            <span>/</span>
            <Link href={`/universities/${uni.id}`} className="hover:text-foreground">
              {uni.name}
            </Link>
          </>
        )}
        <span>/</span>
        <span className="text-foreground">{inst.name}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-6">
        {/* Avatar placeholder */}
        <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <GraduationCap className="size-8 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold">{inst.name}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {inst.role} · {inst.department}
          </p>
          {uni && (
            <Link
              href={`/universities/${uni.id}`}
              className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
            >
              <BookOpen className="size-3" /> {uni.name}
            </Link>
          )}
          <div className="flex items-center gap-2 mt-2">
            <StarRating value={inst.scores.overall} showValue />
            <span className="text-sm text-muted-foreground">{inst.reviewCount} demo reviews</span>
            <Badge variant="secondary" className="text-xs font-normal">
              Sample data
            </Badge>
          </div>
        </div>
        <div className="shrink-0">
          <ReviewComposer targetType="instructor" targetId={id} targetName={inst.name} />
        </div>
      </div>

      <Separator className="mb-6" />

      <div className="space-y-6">
        {/* Bio */}
        <div>
          <h2 className="font-semibold mb-2">About</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{inst.bio}</p>
        </div>

        {/* Scores */}
        <div>
          <h2 className="font-semibold mb-3">
            Category scores
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              — demo, {inst.reviewCount} responses
            </span>
          </h2>
          <div className="space-y-3 max-w-xl">
            {scoreLabels.map(({ key, label }) => (
              <ScoreBar key={key} label={label} value={inst.scores[key]} />
            ))}
          </div>
        </div>

        {/* Courses */}
        {instCourses.length > 0 && (
          <div>
            <h2 className="font-semibold mb-3">Courses taught</h2>
            <div className="space-y-2">
              {instCourses.map((course) => {
                if (!course) return null;
                return (
                  <Link
                    key={course.id}
                    href={`/courses/${course.id}`}
                    className="flex items-center justify-between gap-3 border border-border rounded-lg p-3 hover:border-primary/40 transition-colors group"
                  >
                    <div>
                      <p className="font-medium text-sm group-hover:text-primary transition-colors">
                        {course.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {course.code} · {course.credits} ECTS · {course.semester}
                      </p>
                    </div>
                    <StarRating value={course.scores.overall} size="sm" showValue />
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Reviews */}
        <div>
          <h2 className="font-semibold mb-3">Demo reviews</h2>
          {instReviews.length > 0 ? (
            <div className="space-y-3">
              {instReviews.map((r) => (
                <ReviewCard key={r.id} review={r} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No demo reviews yet.</p>
          )}
          <div className="mt-3">
            <ReviewComposer targetType="instructor" targetId={id} targetName={inst.name} />
          </div>
        </div>
      </div>
    </div>
  );
}
