"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FilePenLine, LoaderCircle, Star, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { DraftDto } from "@/server/drafts/types";

const PAGE_SIZE = 10;

type DraftListResponse = {
  items: DraftDto[];
  hasMore: boolean;
  nextOffset: number | null;
};

type DraftErrorResponse = {
  error?: { code?: string; message?: string };
};

function isDraftListResponse(value: unknown): value is DraftListResponse {
  if (typeof value !== "object" || value === null) return false;
  const response = value as Partial<DraftListResponse>;
  return (
    Array.isArray(response.items) &&
    typeof response.hasMore === "boolean" &&
    (typeof response.nextOffset === "number" || response.nextOffset === null)
  );
}

function isDraft(value: unknown): value is DraftDto {
  if (typeof value !== "object" || value === null) return false;
  const draft = value as Partial<DraftDto>;
  return (
    typeof draft.id === "string" &&
    typeof draft.body === "string" &&
    typeof draft.rating === "number" &&
    typeof draft.revision === "number"
  );
}

async function readError(response: Response): Promise<string | null> {
  try {
    const payload = (await response.json()) as DraftErrorResponse;
    return typeof payload.error?.message === "string" ? payload.error.message : null;
  } catch {
    return null;
  }
}

async function fetchDraftPage(offset: number): Promise<DraftListResponse> {
  const response = await fetch(`/api/drafts?limit=${PAGE_SIZE}&offset=${offset}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error((await readError(response)) || "Could not load your drafts.");
  }

  const payload: unknown = await response.json();
  if (!isDraftListResponse(payload)) {
    throw new Error("Could not load your drafts.");
  }
  return payload;
}

function targetLabel(targetType: DraftDto["targetType"]): string {
  return `${targetType.charAt(0).toUpperCase()}${targetType.slice(1)} draft`;
}

function draftTitle(draft: DraftDto): string {
  return draft.title || "Untitled draft";
}

function appendUniqueDrafts(current: DraftDto[], incoming: DraftDto[]): DraftDto[] {
  const existingIds = new Set(current.map((draft) => draft.id));
  return [...current, ...incoming.filter((draft) => !existingIds.has(draft.id))];
}

export function DraftList() {
  const [drafts, setDrafts] = useState<DraftDto[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [appendError, setAppendError] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedDraft = drafts.find((draft) => draft.id === selectedId) ?? null;

  const loadDrafts = useCallback(async (offset: number, append: boolean) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    if (append) setAppendError(null);
    else setListError(null);

    try {
      const payload = await fetchDraftPage(offset);

      setDrafts((current) => append ? appendUniqueDrafts(current, payload.items) : payload.items);
      setHasMore(payload.hasMore);
      setNextOffset(payload.nextOffset);
    } catch {
      if (append) setAppendError(offset);
      else setListError("We couldn't load your drafts. Please try again.");
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    void fetchDraftPage(0).then(
      (payload) => {
        if (!active) return;
        setDrafts(payload.items);
        setHasMore(payload.hasMore);
        setNextOffset(payload.nextOffset);
        setLoading(false);
      },
      () => {
        if (!active) return;
        setListError("We couldn't load your drafts. Please try again.");
        setLoading(false);
      },
    );

    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground" role="status">
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        Loading your private drafts…
      </div>
    );
  }

  if (listError) {
    return (
      <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-4">
        <p role="alert" className="text-sm text-foreground">
          {listError}
        </p>
        <Button type="button" variant="outline" onClick={() => void loadDrafts(0, false)}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section aria-labelledby="draft-list-heading" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="draft-list-heading" className="text-lg font-semibold">Saved drafts</h2>
          <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-300">
            Private
          </Badge>
        </div>

        {drafts.length === 0 ? (
          <Card className="border border-border/70 shadow-sm">
            <CardContent className="flex flex-col items-start gap-2 py-6">
              <FilePenLine className="size-5 text-primary" aria-hidden="true" />
              <p className="font-medium">No private drafts yet</p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Drafts you save will stay here until you edit or delete them.
              </p>
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-2" aria-label="Saved drafts">
            {drafts.map((draft) => (
              <li key={draft.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(draft.id)}
                  className="w-full rounded-lg border border-border bg-card p-3 text-left shadow-sm transition-colors hover:border-orange-300 hover:bg-orange-50/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 dark:hover:border-orange-900/60 dark:hover:bg-orange-950/20"
                  aria-pressed={selectedId === draft.id}
                >
                  <span className="block truncate font-medium">{draftTitle(draft)}</span>
                  <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{targetLabel(draft.targetType)}</span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1"><Star className="size-3 fill-orange-500 text-orange-500" aria-hidden="true" />{draft.rating}/5</span>
                  </span>
                  <span className="sr-only">Edit draft</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {hasMore && nextOffset !== null ? (
          <div className="space-y-2">
            {appendError !== null ? (
              <p role="alert" className="text-sm text-destructive">
                We couldn&apos;t load more drafts. Your current edits are still here.
              </p>
            ) : null}
            <Button
              type="button"
              variant="outline"
              disabled={loadingMore}
              onClick={() => void loadDrafts(appendError ?? nextOffset, true)}
            >
              {loadingMore ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
              {loadingMore ? "Loading drafts…" : appendError !== null ? "Retry loading drafts" : "Load more drafts"}
            </Button>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="draft-editor-heading">
        {selectedDraft ? (
          <DraftEditor
            key={selectedDraft.id}
            draft={selectedDraft}
            onSaved={(updated) => {
              setDrafts((current) => current.map((draft) => draft.id === updated.id ? updated : draft));
            }}
            onRecovered={(latest) => {
              setDrafts((current) => current.map((draft) => draft.id === latest.id ? latest : draft));
            }}
            onDeleted={(id) => {
              setDrafts((current) => current.filter((draft) => draft.id !== id));
              setSelectedId(null);
            }}
          />
        ) : (
          <Card className="border border-dashed border-orange-200 bg-orange-50/40 shadow-none dark:border-orange-900/60 dark:bg-orange-950/20">
            <CardContent className="py-8 text-sm text-muted-foreground">
              Select a draft to edit it.
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}

interface DraftEditorProps {
  draft: DraftDto;
  onSaved: (draft: DraftDto) => void;
  onRecovered: (draft: DraftDto) => void;
  onDeleted: (id: string) => void;
}

function DraftEditor({ draft, onSaved, onRecovered, onDeleted }: DraftEditorProps) {
  const [title, setTitle] = useState(draft.title ?? "");
  const [body, setBody] = useState(draft.body);
  const [rating, setRating] = useState(draft.rating);
  const [revision, setRevision] = useState(draft.revision);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [hasConflict, setHasConflict] = useState(false);
  const mutationInFlight = useRef(false);

  const mutationPending = saving || deleting || recovering;

  async function saveDraft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutationInFlight.current) return;
    mutationInFlight.current = true;
    setSaving(true);
    setError(null);
    setStatus(null);
    setHasConflict(false);

    try {
      const response = await fetch(`/api/drafts/${encodeURIComponent(draft.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || null,
          body,
          rating,
          revision,
        }),
      });

      if (response.status === 409) {
        setError("This draft changed elsewhere. Your edits are still here.");
        setHasConflict(true);
        return;
      }
      if (!response.ok) {
        setError((await readError(response)) || "We couldn't save this draft. Your edits are still here.");
        return;
      }

      const updated: unknown = await response.json();
      if (!isDraft(updated)) {
        setError("We couldn't save this draft. Your edits are still here.");
        return;
      }
      setTitle(updated.title ?? "");
      setBody(updated.body);
      setRating(updated.rating);
      setRevision(updated.revision);
      onSaved(updated);
      setStatus("Changes saved privately.");
    } catch {
      setError("We couldn't save this draft. Your edits are still here.");
    } finally {
      setSaving(false);
      mutationInFlight.current = false;
    }
  }

  async function recoverLatestRevision() {
    if (mutationInFlight.current) return;
    mutationInFlight.current = true;
    setRecovering(true);
    setError(null);
    setStatus(null);

    try {
      const response = await fetch(`/api/drafts/${encodeURIComponent(draft.id)}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        setError("We couldn't refresh this draft. Your edits are still here.");
        return;
      }
      const latest: unknown = await response.json();
      if (!isDraft(latest)) {
        setError("We couldn't refresh this draft. Your edits are still here.");
        return;
      }
      setRevision(latest.revision);
      onRecovered(latest);
      setHasConflict(false);
      setStatus("Latest revision loaded. Your edits are still in the form.");
    } catch {
      setError("We couldn't refresh this draft. Your edits are still here.");
    } finally {
      setRecovering(false);
      mutationInFlight.current = false;
    }
  }

  async function deleteDraft() {
    if (mutationInFlight.current) return;
    mutationInFlight.current = true;
    setDeleting(true);
    setError(null);
    setStatus(null);

    try {
      const response = await fetch(`/api/drafts/${encodeURIComponent(draft.id)}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        setError((await readError(response)) || "We couldn't delete this draft. Please try again.");
        return;
      }
      const deleted: unknown = await response.json();
      if (
        typeof deleted !== "object" ||
        deleted === null ||
        (deleted as { id?: unknown }).id !== draft.id
      ) {
        setError("We couldn't delete this draft. Please try again.");
        return;
      }
      onDeleted(draft.id);
    } catch {
      setError("We couldn't delete this draft. Please try again.");
    } finally {
      setDeleting(false);
      mutationInFlight.current = false;
    }
  }

  return (
    <Card className="border border-border/70 shadow-sm">
      <CardHeader>
        <CardTitle id="draft-editor-heading">Edit private draft</CardTitle>
        <CardDescription>
          Changes are saved privately. This draft cannot be published from here.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={saveDraft} noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="draft-title">Title</Label>
            <Input
              id="draft-title"
              disabled={mutationPending}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={140}
              placeholder="Add a title"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="draft-body">Review</Label>
            <Textarea
              id="draft-body"
              disabled={mutationPending}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={5000}
              rows={7}
              required
            />
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">Rating</legend>
            <div className="flex gap-1" role="radiogroup" aria-label="Draft rating">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  disabled={mutationPending}
                  aria-checked={rating === value}
                  aria-label={`${value} star${value === 1 ? "" : "s"}`}
                  onClick={() => setRating(value)}
                  className="rounded p-1 text-muted-foreground transition-colors hover:text-orange-600 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <Star className={`size-5 ${value <= rating ? "fill-orange-500 text-orange-500" : ""}`} aria-hidden="true" />
                </button>
              ))}
            </div>
          </fieldset>

          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          {hasConflict ? (
            <Button type="button" variant="outline" disabled={mutationPending} onClick={() => void recoverLatestRevision()}>
              {recovering ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
              {recovering ? "Refreshing revision…" : "Refresh latest revision"}
            </Button>
          ) : null}
          {status ? <p role="status" className="text-sm text-muted-foreground">{status}</p> : null}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <Button type="button" variant="destructive" disabled={mutationPending} onClick={() => void deleteDraft()}>
              {deleting ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
              {deleting ? "Deleting…" : "Delete draft"}
            </Button>
            <Button type="submit" disabled={mutationPending}>
              {saving ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
