"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Save, Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { DraftDto } from "@/server/drafts/types";

export type ReviewDraftTargetType = "university" | "course" | "instructor";

export interface ServerReviewComposerProps {
  targetType: ReviewDraftTargetType;
  targetId: string;
  universityId: string;
  targetName: string;
}

type DraftPayload = {
  targetType: ReviewDraftTargetType;
  universityId: string;
  targetId: string;
  title: string;
  body: string;
  rating: number;
  clientRequestKey: string;
};

type FieldErrors = {
  rating?: string;
  title?: string;
  body?: string;
};

function createClientRequestKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function currentLocalPathname(): string {
  if (typeof window === "undefined") return "/";
  const pathname = window.location.pathname;
  return pathname.startsWith("/") && !pathname.startsWith("//") && !pathname.includes("\\")
    ? pathname
    : "/";
}

function isDraftDto(value: unknown): value is DraftDto {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<DraftDto>;
  return typeof draft.id === "string" && typeof draft.body === "string" &&
    typeof draft.rating === "number";
}

function validate(rating: number, title: string, body: string): FieldErrors {
  const errors: FieldErrors = {};
  if (rating === 0) errors.rating = "Please select a rating";
  if (!title.trim()) errors.title = "Title is required";
  if (body.trim().length < 20) errors.body = "Please write at least 20 characters";
  return errors;
}

export function ServerReviewComposer({
  targetType,
  targetId,
  universityId,
  targetName,
}: ServerReviewComposerProps) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [requiresSignIn, setRequiresSignIn] = useState(false);
  const [pending, setPending] = useState(false);
  const [retryPayload, setRetryPayload] = useState<DraftPayload | null>(null);
  const [savedDraft, setSavedDraft] = useState<DraftDto | null>(null);
  const submitting = useRef(false);

  const frozen = retryPayload !== null;
  const disabled = pending || frozen;

  function buildPayload(): DraftPayload {
    return {
      targetType,
      universityId,
      targetId,
      title: title.trim(),
      body: body.trim(),
      rating,
      clientRequestKey: createClientRequestKey(),
    };
  }

  function clearRequestState() {
    setRetryPayload(null);
    setFormError(null);
    setRequiresSignIn(false);
  }

  function startNewDraft() {
    clearRequestState();
    setErrors({});
  }

  function writeAnother() {
    clearRequestState();
    setSavedDraft(null);
    setRating(0);
    setHoverRating(0);
    setTitle("");
    setBody("");
    setErrors({});
  }

  async function submit(payload: DraftPayload) {
    if (submitting.current) return;

    submitting.current = true;
    setPending(true);
    setFormError(null);
    setRequiresSignIn(false);

    try {
      const response = await fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        let data: unknown;
        try {
          data = await response.json();
        } catch {
          setRetryPayload(payload);
          setFormError("We couldn't confirm whether your draft was saved. Retry the unchanged draft.");
          return;
        }
        if (!isDraftDto(data)) {
          setRetryPayload(payload);
          setFormError("We couldn't confirm whether your draft was saved. Retry the unchanged draft.");
          return;
        }
        setRetryPayload(null);
        setSavedDraft(data);
        return;
      }

      // Read the documented error envelope without exposing its server message.
      try {
        await response.json();
      } catch {
        // Status still determines the safe, user-facing recovery action.
      }

      if (response.status === 401) {
        setRetryPayload(null);
        setRequiresSignIn(true);
        setFormError("Please sign in to save a private draft.");
      } else if (response.status === 400) {
        setRetryPayload(null);
        setFormError("We couldn't save this draft. Check the review details and try again.");
      } else if (response.status === 409) {
        setRetryPayload(null);
        setFormError("This draft could not be saved. Start a new draft and try again.");
      } else if (response.status >= 500) {
        setRetryPayload(payload);
        setFormError("We couldn't confirm whether your draft was saved. Retry the unchanged draft.");
      } else {
        setRetryPayload(null);
        setFormError("We couldn't save this draft right now. Please try again.");
      }
    } catch {
      setRetryPayload(payload);
      setFormError("We couldn't confirm whether your draft was saved. Retry the unchanged draft.");
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;

    if (retryPayload) {
      void submit(retryPayload);
      return;
    }

    const nextErrors = validate(rating, title, body);
    setErrors(nextErrors);
    clearRequestState();
    if (Object.keys(nextErrors).length > 0) return;

    void submit(buildPayload());
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="default" size="sm">Write a review</Button>} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Write a review</DialogTitle>
          <DialogDescription>
            Reviewing: <strong>{targetName}</strong>
          </DialogDescription>
        </DialogHeader>

        {savedDraft ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
              <Save className="size-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold">Private draft saved</p>
              <p className="mt-1 text-sm text-muted-foreground">
                This draft is saved to your account. It has not been published or added to any rating totals.
              </p>
            </div>
            <div className="mt-2 flex gap-2">
              <Button variant="outline" size="sm" onClick={writeAnother}>Write another</Button>
              <Link href="/account/drafts" className={buttonVariants({ size: "sm" })}>View drafts</Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-2 space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label>Overall rating</Label>
              <div className="flex gap-1" role="group" aria-label="Select rating">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-label={`${value} star${value > 1 ? "s" : ""}`}
                    className="rounded p-0.5 focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed"
                    disabled={disabled}
                    onClick={() => setRating(value)}
                    onMouseEnter={() => setHoverRating(value)}
                    onMouseLeave={() => setHoverRating(0)}
                  >
                    <Star
                      className={cn("size-6 transition-colors", {
                        "fill-primary text-primary": value <= (hoverRating || rating),
                        "fill-muted text-muted-foreground/40": value > (hoverRating || rating),
                      })}
                    />
                  </button>
                ))}
              </div>
              {errors.rating ? <p className="text-xs text-destructive">{errors.rating}</p> : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="server-review-title">Title</Label>
              <Input
                id="server-review-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Summarise your experience"
                disabled={disabled}
                aria-describedby={errors.title ? "server-title-error" : undefined}
              />
              {errors.title ? <p id="server-title-error" className="text-xs text-destructive">{errors.title}</p> : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="server-review-body">Review</Label>
              <Textarea
                id="server-review-body"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Share what studying here was really like…"
                rows={4}
                disabled={disabled}
                aria-describedby={errors.body ? "server-body-error" : undefined}
              />
              <div className="flex items-start justify-between">
                {errors.body ? <p id="server-body-error" className="text-xs text-destructive">{errors.body}</p> : <span />}
                <span className="text-xs tabular-nums text-muted-foreground">{body.length} / 5000</span>
              </div>
            </div>

            {formError ? (
              <div role="alert" className="space-y-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <p>{formError}</p>
                {requiresSignIn ? (
                  <Link
                    href={`/sign-in?next=${encodeURIComponent(currentLocalPathname())}`}
                    className="font-medium underline underline-offset-4"
                  >
                    Sign in
                  </Link>
                ) : null}
                {frozen ? (
                  <>
                    <p className="text-xs">To change this review, start a new draft. The earlier save may still appear in your drafts.</p>
                    <Button type="button" variant="outline" size="sm" onClick={startNewDraft}>
                      Start a new draft
                    </Button>
                  </>
                ) : null}
              </div>
            ) : null}

            <div className="flex items-center justify-between pt-1">
              <Badge variant="secondary" className="text-xs font-normal">Private draft · not published</Badge>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving draft…" : frozen ? "Retry saved draft" : "Save draft"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
