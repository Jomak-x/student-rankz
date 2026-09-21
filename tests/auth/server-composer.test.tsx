// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ServerReviewComposer, type ReviewDraftTargetType } from "@/components/server-review-composer";
import { parseCreateInput } from "@/server/drafts/validate";

const fetchMock = vi.fn();
const universityId = "00000000-0000-4000-8000-000000000001";
const targetIds = {
  university: universityId,
  course: "00000000-0000-4000-8000-000000000002",
  instructor: "00000000-0000-4000-8000-000000000003",
} satisfies Record<ReviewDraftTargetType, string>;

function draftResponse(options: RequestInit) {
  // Keep the production parser real: HTTP success requires an accepted payload.
  const parsed = parseCreateInput(JSON.parse(String(options.body)));
  return {
    ok: true,
    status: 201,
    json: vi.fn().mockResolvedValue({
      id: "draft-1",
      targetType: parsed.targetType,
      universityId: parsed.universityId,
      courseId: parsed.targetType === "course" ? parsed.targetId : null,
      instructorId: parsed.targetType === "instructor" ? parsed.targetId : null,
      title: parsed.title,
      body: parsed.body,
      rating: parsed.rating,
      revision: 1,
      createdAt: "2026-09-21T00:00:00.000Z",
      updatedAt: "2026-09-21T00:00:00.000Z",
    }),
  };
}

function errorResponse(status: number, code: string, message = "internal detail") {
  return {
    ok: false,
    status,
    json: vi.fn().mockResolvedValue({ error: { code, message } }),
  };
}

async function fillReview() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Write a review" }));
  await user.click(screen.getByRole("button", { name: "4 stars" }));
  await user.type(screen.getByLabelText("Title"), "Helpful course");
  await user.type(
    screen.getByLabelText("Review"),
    "The coursework was challenging but the support was excellent.",
  );
  return user;
}

describe("server review composer", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    fetchMock.mockImplementation((_url: string, options: RequestInit) => draftResponse(options));
    vi.stubGlobal("fetch", fetchMock);
    window.history.pushState({}, "", "/courses/course-1?tab=reviews");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  function renderComposer(targetType: ReviewDraftTargetType = "course") {
    return render(
      <ServerReviewComposer
        targetType={targetType}
        targetId={targetIds[targetType]}
        universityId={universityId}
        targetName="Data Structures"
      />,
    );
  }

  it.each(["university", "course", "instructor"] as const)("saves a %s draft using the actual service input contract", async (targetType) => {
    renderComposer(targetType);
    const user = await fillReview();

    await user.click(screen.getByRole("button", { name: "Save draft" }));

    await screen.findByText("Private draft saved");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/drafts");
    expect(options.method).toBe("POST");
    expect(options.headers).toEqual({ "Content-Type": "application/json" });
    const payload = JSON.parse(String(options.body));
    expect(payload).toEqual({
      targetType,
      universityId,
      targetId: targetIds[targetType],
      title: "Helpful course",
      body: "The coursework was challenging but the support was excellent.",
      rating: 4,
      clientRequestKey: expect.any(String),
    });
    expect(parseCreateInput(payload)).toEqual({
      ...payload,
      targetId: targetType === "university" ? null : targetIds[targetType],
    });
  });

  it("retries an ambiguous network failure with the frozen payload and key", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network unavailable"));
    renderComposer();
    const user = await fillReview();

    await user.click(screen.getByRole("button", { name: "Save draft" }));

    await screen.findByText(/couldn't confirm whether your draft was saved/i);
    const firstPayload = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect((screen.getByLabelText("Title") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText("Review") as HTMLTextAreaElement).disabled).toBe(true);

    await user.click(screen.getByRole("button", { name: "Retry saved draft" }));

    await screen.findByText("Private draft saved");
    const secondPayload = JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body));
    expect(secondPayload).toEqual(firstPayload);
  });

  it("retains editable input after a validation failure without exposing server details", async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(400, "INVALID_INPUT", "database-only detail"));
    renderComposer();
    const user = await fillReview();

    await user.click(screen.getByRole("button", { name: "Save draft" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Check the review details");
    expect(screen.queryByText("database-only detail")).toBeNull();
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Helpful course");
    expect((screen.getByLabelText("Review") as HTMLTextAreaElement).value).toBe("The coursework was challenging but the support was excellent.");
    expect((screen.getByLabelText("Title") as HTMLInputElement).disabled).toBe(false);
  });

  it("keeps the review input and provides a local return link after a 401", async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(401, "UNAUTHENTICATED"));
    renderComposer();
    const user = await fillReview();

    await user.click(screen.getByRole("button", { name: "Save draft" }));

    expect((await screen.findByRole("link", { name: "Sign in" })).getAttribute("href")).toBe(
      "/sign-in?next=%2Fcourses%2Fcourse-1",
    );
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Helpful course");
  });

  it("confirms a private saved draft and links to the account drafts page", async () => {
    renderComposer();
    const user = await fillReview();

    await user.click(screen.getByRole("button", { name: "Save draft" }));

    expect(await screen.findByText("Private draft saved")).toBeTruthy();
    expect(screen.getByText(/has not been published or added to any rating totals/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: "View drafts" }).getAttribute("href")).toBe("/account/drafts");
    await user.click(screen.getByRole("button", { name: "Write another" }));
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("");
  });
});
