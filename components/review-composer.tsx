"use client";

import React, { useState } from "react";
import { Star, Save } from "lucide-react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";
import type { PendingReview } from "@/lib/demo-data";
import { useLocalStorage } from "@/hooks/use-local-storage";

interface ReviewComposerProps {
  targetType: PendingReview["targetType"];
  targetId: string;
  targetName: string;
}

export function ReviewComposer({ targetType, targetId, targetName }: ReviewComposerProps) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [, setPending] = useLocalStorage<PendingReview[]>(
    "student-rankz-pending-reviews",
    []
  );

  const validate = () => {
    const e: Record<string, string> = {};
    if (rating === 0) e.rating = "Please select a rating";
    if (!title.trim()) e.title = "Title is required";
    if (body.trim().length < 20) e.body = "Please write at least 20 characters";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const review: PendingReview = {
      id: `pending-${Date.now()}`,
      targetType,
      targetId,
      targetName,
      rating,
      title: title.trim(),
      body: body.trim(),
      createdAt: new Date().toISOString(),
    };
    const ok = setPending((prev) => [...(Array.isArray(prev) ? prev : []), review]);
    if (ok) {
      setSaveError("");
      setSaved(true);
    } else {
      setSaveError("Could not save — browser storage may be full or blocked.");
    }
  };

  const handleOpenChange = (o: boolean) => {
    setOpen(o);
    if (!o) {
      setRating(0);
      setHoverRating(0);
      setTitle("");
      setBody("");
      setErrors({});
      setSaved(false);
      setSaveError("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="default" size="sm">Write a review</Button>} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Write a review</DialogTitle>
          <DialogDescription>
            Reviewing: <strong>{targetName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="mt-1 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
          <strong>Demo prototype</strong> — this form saves privately to your browser only. Nothing
          is published, sent to a server, or added to any rating totals.
        </div>

        {saved ? (
          <div className="py-6 flex flex-col items-center gap-3 text-center">
            <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Save className="size-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold">Saved on this device · demo, not published</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your review draft is stored locally. In a real app it would go through moderation
                before appearing.
              </p>
            </div>
            <div className="flex gap-2 mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSaved(false);
                  setSaveError("");
                  setRating(0);
                  setTitle("");
                  setBody("");
                }}
              >
                Write another
              </Button>
              <Button size="sm" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 mt-2" noValidate>
            {/* Star rating */}
            <div className="space-y-1.5">
              <Label>Overall rating</Label>
              <div
                className="flex gap-1"
                role="group"
                aria-label="Select rating"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-label={`${n} star${n > 1 ? "s" : ""}`}
                    className="p-0.5 rounded focus-visible:outline-2 focus-visible:outline-ring"
                    onClick={() => setRating(n)}
                    onMouseEnter={() => setHoverRating(n)}
                    onMouseLeave={() => setHoverRating(0)}
                  >
                    <Star
                      className={cn("size-6 transition-colors", {
                        "fill-primary text-primary": n <= (hoverRating || rating),
                        "fill-muted text-muted-foreground/40": n > (hoverRating || rating),
                      })}
                    />
                  </button>
                ))}
              </div>
              {errors.rating && (
                <p className="text-xs text-destructive">{errors.rating}</p>
              )}
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="review-title">Title</Label>
              <Input
                id="review-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Summarise your experience"
                aria-describedby={errors.title ? "title-error" : undefined}
              />
              {errors.title && (
                <p id="title-error" className="text-xs text-destructive">
                  {errors.title}
                </p>
              )}
            </div>

            {/* Body */}
            <div className="space-y-1.5">
              <Label htmlFor="review-body">Review</Label>
              <Textarea
                id="review-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Share what studying here was really like…"
                rows={4}
                aria-describedby={errors.body ? "body-error" : undefined}
              />
              <div className="flex justify-between items-start">
                {errors.body ? (
                  <p id="body-error" className="text-xs text-destructive">
                    {errors.body}
                  </p>
                ) : (
                  <span />
                )}
                <span className="text-xs text-muted-foreground tabular-nums">
                  {body.length} / 1000
                </span>
              </div>
            </div>

            {saveError && (
              <p role="alert" className="text-xs text-destructive">{saveError}</p>
            )}
            <div className="flex items-center justify-between pt-1">
              <Badge variant="secondary" className="text-xs font-normal">
                Demo · saved locally only
              </Badge>
              <Button type="submit">Save draft</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
