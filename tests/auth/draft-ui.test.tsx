// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DraftList } from "@/components/drafts/draft-list";
import type { DraftDto } from "@/server/drafts/types";

const draft: DraftDto = {
  id: "11111111-1111-4111-8111-111111111111",
  targetType: "university",
  universityId: "22222222-2222-4222-8222-222222222222",
  courseId: null,
  instructorId: null,
  title: "Great library hours",
  body: "The library stays open late during exam weeks.",
  rating: 4,
  revision: 3,
  createdAt: "2026-09-21T12:00:00.000Z",
  updatedAt: "2026-09-21T12:00:00.000Z",
};

function listResponse(items: DraftDto[], hasMore = false, nextOffset: number | null = null) {
  return Response.json({ items, hasMore, nextOffset });
}

afterEach(cleanup);
beforeEach(() => {
  vi.mocked(fetch).mockReset();
});

describe("private draft list and editor", () => {
  it("shows an empty private state", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(listResponse([]));

    render(<DraftList />);

    expect(await screen.findByText("No private drafts yet")).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith("/api/drafts?limit=10&offset=0", { cache: "no-store" });
  });

  it("shows a retryable error when the list request fails", async () => {
    vi.mocked(fetch)
      .mockRejectedValueOnce(new TypeError("Network disabled"))
      .mockResolvedValueOnce(listResponse([]));
    const user = userEvent.setup();

    render(<DraftList />);

    expect((await screen.findByRole("alert")).textContent).toContain("We couldn't load your drafts");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("No private drafts yet")).toBeTruthy();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("refreshes the latest revision after a conflict without replacing the user's edits", async () => {
    const latest = { ...draft, title: "Server title", body: "A newer saved review body.", revision: 4 };
    const saved = { ...latest, title: "Updated library hours", body: draft.body, revision: 5 };
    vi.mocked(fetch)
      .mockResolvedValueOnce(listResponse([draft]))
      .mockResolvedValueOnce(Response.json({ error: { code: "CONFLICT", message: "stale" } }, { status: 409 }))
      .mockResolvedValueOnce(Response.json(latest))
      .mockResolvedValueOnce(Response.json(saved));
    const user = userEvent.setup();

    render(<DraftList />);

    await user.click(await screen.findByRole("button", { name: /Great library hours/ }));
    const title = screen.getByLabelText("Title");
    await user.clear(title);
    await user.type(title, "Updated library hours");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Your edits are still here");
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Updated library hours");
    expect(fetch).toHaveBeenLastCalledWith(
      `/api/drafts/${draft.id}`,
      expect.objectContaining({ method: "PATCH" }),
    );
    const request = vi.mocked(fetch).mock.calls[1][1] as RequestInit;
    expect(JSON.parse(request.body as string)).toMatchObject({
      title: "Updated library hours",
      body: draft.body,
      rating: draft.rating,
      revision: 3,
    });

    await user.click(screen.getByRole("button", { name: "Refresh latest revision" }));
    expect((await screen.findByRole("status")).textContent).toContain("Latest revision loaded");
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Updated library hours");
    expect((screen.getByLabelText("Review") as HTMLTextAreaElement).value).toBe(draft.body);
    expect(fetch).toHaveBeenLastCalledWith(
      `/api/drafts/${draft.id}`,
      { cache: "no-store" },
    );

    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect((await screen.findByRole("status")).textContent).toContain("Changes saved privately");
    const retryRequest = vi.mocked(fetch).mock.calls[3][1] as RequestInit;
    expect(JSON.parse(retryRequest.body as string)).toMatchObject({ revision: 4 });
  });

  it("deletes a draft only after the delete button is pressed", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(listResponse([draft]))
      .mockResolvedValueOnce(Response.json({ id: draft.id }));
    const user = userEvent.setup();

    render(<DraftList />);

    await user.click(await screen.findByRole("button", { name: /Great library hours/ }));
    expect(fetch).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Delete draft" }));

    expect(await screen.findByText("No private drafts yet")).toBeTruthy();
    expect(fetch).toHaveBeenLastCalledWith(
      `/api/drafts/${draft.id}`,
      { method: "DELETE" },
    );
  });

  it("loads the next page from the API-provided offset", async () => {
    const secondDraft = { ...draft, id: "33333333-3333-4333-8333-333333333333", title: "Helpful office hours" };
    vi.mocked(fetch)
      .mockResolvedValueOnce(listResponse([draft], true, 1))
      .mockResolvedValueOnce(listResponse([secondDraft]));
    const user = userEvent.setup();

    render(<DraftList />);

    expect(await screen.findByText("Great library hours")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Load more drafts" }));
    expect(await screen.findByText("Helpful office hours")).toBeTruthy();
    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith(
      "/api/drafts?limit=10&offset=1",
      { cache: "no-store" },
    ));
  });

  it("keeps an unsaved editor mounted when loading another page fails and retries that offset", async () => {
    const secondDraft = { ...draft, id: "44444444-4444-4444-8444-444444444444", title: "Clear course notes" };
    vi.mocked(fetch)
      .mockResolvedValueOnce(listResponse([draft], true, 1))
      .mockRejectedValueOnce(new TypeError("Network disabled"))
      .mockResolvedValueOnce(listResponse([draft, secondDraft]));
    const user = userEvent.setup();

    render(<DraftList />);

    await user.click(await screen.findByRole("button", { name: /Great library hours/ }));
    const title = screen.getByLabelText("Title");
    await user.clear(title);
    await user.type(title, "Unsaved library update");
    await user.click(screen.getByRole("button", { name: "Load more drafts" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Your current edits are still here");
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Unsaved library update");
    await user.click(screen.getByRole("button", { name: "Retry loading drafts" }));
    expect(await screen.findByText("Clear course notes")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /Great library hours/ })).toHaveLength(1);
    expect(fetch).toHaveBeenLastCalledWith(
      "/api/drafts?limit=10&offset=1",
      { cache: "no-store" },
    );
  });
});

it("locks editor input until a pending save completes", async () => {
  let finish!: (value: Response) => void;
  vi.mocked(fetch).mockResolvedValueOnce(listResponse([draft]))
    .mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve; }));
  const user = userEvent.setup();
  render(<DraftList />);
  await user.click(await screen.findByRole("button", { name: /Great library hours/ }));
  await user.click(screen.getByRole("button", { name: "Save changes" }));
  expect((screen.getByLabelText("Title") as HTMLInputElement).disabled).toBe(true);
  expect((screen.getByLabelText("Review") as HTMLTextAreaElement).disabled).toBe(true);
  expect((screen.getByRole("radio", { name: "5 stars" }) as HTMLButtonElement).disabled).toBe(true);
  finish(Response.json({ ...draft, revision: 4 }));
  await screen.findByText("Changes saved privately.");
  expect((screen.getByLabelText("Title") as HTMLInputElement).disabled).toBe(false);
});
