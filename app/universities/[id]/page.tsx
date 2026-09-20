import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getUniversity,
  getCoursesByUniversity,
  getInstructorsByUniversity,
  getReviewsByTarget,
  universities,
} from "@/lib/demo-data";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StarRating } from "@/components/star-rating";
import { ScoreBar } from "@/components/score-bar";
import { ReviewCard } from "@/components/review-card";
import { ReviewComposer } from "@/components/review-composer";
import { CompareToggle } from "@/components/compare-toggle";
import Link from "next/link";
import { MapPin, Calendar, Users, ArrowRight } from "lucide-react";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const uni = getUniversity(id);
  if (!uni) return { title: "Not found" };
  return { title: `${uni.name} · Student Reviews` };
}

export function generateStaticParams() {
  return universities.map((u) => ({ id: u.id }));
}

export default async function UniversityPage({ params }: Props) {
  const { id } = await params;
  const uni = getUniversity(id);
  if (!uni) notFound();

  const uniCourses = getCoursesByUniversity(id);
  const uniInstructors = getInstructorsByUniversity(id);
  const uniReviews = getReviewsByTarget("university", id);

  const scoreLabels: { key: keyof typeof uni.scores; label: string }[] = [
    { key: "teaching", label: "Teaching quality" },
    { key: "support", label: "Student support" },
    { key: "facilities", label: "Facilities" },
    { key: "administration", label: "Administration" },
    { key: "value", label: "Value for money" },
    { key: "socialLife", label: "Social life" },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
      {/* Breadcrumb */}
      <nav className="text-xs text-muted-foreground mb-4 flex items-center gap-1.5">
        <Link href="/universities" className="hover:text-foreground">
          Universities
        </Link>
        <span>/</span>
        <span className="text-foreground">{uni.name}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6 mb-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap">
            <h1 className="text-2xl font-bold leading-tight">{uni.name}</h1>
            <Badge variant="outline" className="shrink-0 mt-1">
              {uni.countryCode}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="size-3.5" /> {uni.city}, {uni.country}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="size-3.5" /> Founded {uni.founded}
            </span>
            <span className="flex items-center gap-1">
              <Users className="size-3.5" /> ~{(uni.studentCount / 1000).toFixed(0)}k students
            </span>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <StarRating value={uni.scores.overall} showValue />
            <span className="text-sm text-muted-foreground">
              {uni.reviewCount} demo reviews
            </span>
            <Badge variant="secondary" className="text-xs font-normal">
              Sample data
            </Badge>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <CompareToggle universityId={id} />
          <ReviewComposer targetType="university" targetId={id} targetName={uni.name} />
        </div>
      </div>

      <Separator className="mb-6" />

      <Tabs defaultValue="overview">
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="reviews">Reviews ({uniReviews.length})</TabsTrigger>
          <TabsTrigger value="courses">Courses ({uniCourses.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Description */}
          <div>
            <h2 className="font-semibold mb-2">About</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{uni.description}</p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {uni.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs font-normal">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>

          {/* Scores */}
          <div>
            <h2 className="font-semibold mb-3">
              Category scores
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                — demo sample data, {uni.reviewCount} responses
              </span>
            </h2>
            <div className="space-y-3 max-w-xl">
              {scoreLabels.map(({ key, label }) => (
                <ScoreBar key={key} label={label} value={uni.scores[key]} />
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              These scores are fictional demo fixtures. Scores below a proposed threshold of 20
              distinct verified contributors would be withheld in a real deployment.
            </p>
          </div>

          {/* Recent reviews excerpt */}
          {uniReviews.length > 0 && (
            <div>
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="font-semibold">Recent demo reviews</h2>
              </div>
              <div className="space-y-3">
                {uniReviews.slice(0, 2).map((r) => (
                  <ReviewCard key={r.id} review={r} />
                ))}
              </div>
            </div>
          )}

          {/* Instructors */}
          {uniInstructors.length > 0 && (
            <div>
              <h2 className="font-semibold mb-3">Instructors</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {uniInstructors.map((inst) => (
                  <Link
                    key={inst.id}
                    href={`/instructors/${inst.id}`}
                    className="border border-border rounded-lg p-3 hover:border-primary/40 transition-colors group"
                  >
                    <p className="font-medium text-sm group-hover:text-primary transition-colors">
                      {inst.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{inst.role} · {inst.department}</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <StarRating value={inst.scores.overall} size="sm" showValue />
                      <span className="text-xs text-muted-foreground">({inst.reviewCount})</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="reviews" className="space-y-4">
          {uniReviews.length > 0 ? (
            uniReviews.map((r) => <ReviewCard key={r.id} review={r} />)
          ) : (
            <p className="text-muted-foreground text-sm py-8 text-center">No demo reviews yet.</p>
          )}
          <div className="pt-2">
            <ReviewComposer targetType="university" targetId={id} targetName={uni.name} />
          </div>
        </TabsContent>

        <TabsContent value="courses" className="space-y-3">
          {uniCourses.length > 0 ? (
            uniCourses.map((course) => (
              <Link
                key={course.id}
                href={`/courses/${course.id}`}
                className="flex items-start justify-between gap-3 border border-border rounded-lg p-4 hover:border-primary/40 transition-colors group"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm group-hover:text-primary transition-colors">
                      {course.name}
                    </p>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {course.code}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="text-xs capitalize font-normal shrink-0"
                    >
                      {course.level}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {course.department} · {course.credits} ECTS · {course.semester}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <StarRating value={course.scores.overall} size="sm" showValue />
                  <ArrowRight className="size-4 text-muted-foreground shrink-0" />
                </div>
              </Link>
            ))
          ) : (
            <p className="text-muted-foreground text-sm py-8 text-center">No courses listed.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
