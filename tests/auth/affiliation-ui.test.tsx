// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VerificationPanel } from "@/components/affiliation/verification-panel";

const universityId = "11111111-1111-4111-8111-111111111111";
const email = "student@university.example";
const item = { universityId, universityName: "Example University", verified: false, verifiedAt: null as string | null };
const fetchMock = vi.fn<typeof fetch>();
const page = (items = [] as typeof item[], hasMore = false, nextOffset: number | null = null) => Response.json({ items, hasMore, nextOffset });
const success = () => Response.json({ ok: true, universityId });
const failure = (status: number, code: string) => Response.json({ error: { code, message: "SECRET provider diagnostic" } }, { status });
const input = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const button = (name: string) => screen.getByRole("button", { name }) as HTMLButtonElement;

async function ready() {
  const view = render(<VerificationPanel />);
  await waitFor(() => expect(button("Request code").disabled).toBe(false));
  return view;
}

async function requestCode() {
  const user = userEvent.setup();
  await user.type(input("University email"), email);
  await user.click(button("Request code"));
  await screen.findByLabelText("Verification code");
  return user;
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("university mailbox verification", () => {
  it("requests a code without verifying, locks the email, and consumes the original address", async () => {
    fetchMock.mockResolvedValueOnce(page()).mockResolvedValueOnce(success()).mockResolvedValueOnce(success())
      .mockResolvedValueOnce(page([{ ...item, verified: true, verifiedAt: "2026-09-21T12:00:00Z" }]));
    const storage = vi.spyOn(Storage.prototype, "setItem");
    await ready();
    const user = await requestCode();
    expect(input("University email").readOnly).toBe(true);
    expect(screen.getByText(/Code requested. Check your email/)).toBeTruthy();
    expect(screen.queryByText("Mailbox verified")).toBeNull();
    expect(screen.queryByText(/Mailbox control verified/)).toBeNull();
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/affiliation/initiate", expect.objectContaining({
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }), cache: "no-store",
    }));
    await user.type(input("Verification code"), "012345");
    await user.click(button("Verify code"));
    expect(await screen.findByText("Mailbox verified")).toBeTruthy();
    expect(screen.getByText(/Mailbox control verified. This does not prove enrollment/)).toBeTruthy();
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/affiliation/consume", expect.objectContaining({ body: JSON.stringify({ email, code: "012345" }) }));
    expect(input("University email").value).toBe("");
    expect(screen.queryByLabelText("Verification code")).toBeNull();
    expect(storage).not.toHaveBeenCalled();
  });

  it("loads owned status on mount and fetches fresh status without retaining email or code after remount", async () => {
    fetchMock.mockResolvedValueOnce(page([item])).mockResolvedValueOnce(success())
      .mockResolvedValueOnce(page([{ ...item, verified: true, verifiedAt: "2026-09-21T12:00:00Z" }]));
    const view = await ready();
    expect(screen.getByText("Not verified")).toBeTruthy();
    expect(screen.queryByLabelText("Verification code")).toBeNull();
    const user = await requestCode();
    await user.type(input("Verification code"), "123456");
    view.unmount();
    await ready();
    expect(screen.getByText("Mailbox verified")).toBeTruthy();
    expect(input("University email").value).toBe("");
    expect(screen.queryByLabelText("Verification code")).toBeNull();
    expect(fetchMock).toHaveBeenLastCalledWith("/api/affiliation?offset=0", expect.objectContaining({ cache: "no-store" }));
  });

  it("follows server pagination and retries a failed page without losing existing results", async () => {
    const second = { ...item, universityId: "22222222-2222-4222-8222-222222222222", universityName: "Second University", verified: true };
    fetchMock.mockResolvedValueOnce(page([item], true, 50)).mockResolvedValueOnce(failure(503, "UNAVAILABLE"))
      .mockResolvedValueOnce(page([second]));
    await ready();
    const user = userEvent.setup();
    await user.click(button("Load more verifications"));
    expect((await screen.findByRole("alert")).textContent).toContain("temporarily unavailable");
    expect(screen.getByText("Example University")).toBeTruthy();
    await user.click(button("Retry loading status"));
    expect(await screen.findByText("Second University")).toBeTruthy();
    expect(fetchMock).toHaveBeenLastCalledWith("/api/affiliation?offset=50", expect.objectContaining({ cache: "no-store" }));
    expect(screen.queryByRole("button", { name: "Load more verifications" })).toBeNull();
  });

  it("invalidates the pending challenge when editing the address", async () => {
    fetchMock.mockResolvedValueOnce(page()).mockResolvedValueOnce(success()).mockResolvedValueOnce(success());
    await ready();
    const user = await requestCode();
    await user.type(input("Verification code"), "123456");
    await user.click(button("Edit address"));
    expect(input("University email").readOnly).toBe(false);
    expect(input("University email").value).toBe(email);
    expect(screen.queryByLabelText("Verification code")).toBeNull();
    await user.clear(input("University email"));
    await user.type(input("University email"), "other@university.example");
    await user.click(button("Request code"));
    await screen.findByLabelText("Verification code");
    expect(input("Verification code").value).toBe("");
    expect(fetchMock).toHaveBeenLastCalledWith("/api/affiliation/initiate", expect.objectContaining({ body: JSON.stringify({ email: "other@university.example" }) }));
  });

  it.each([
    [400, "INVALID_EMAIL", "Enter a valid university email address."],
    [400, "UNKNOWN_DOMAIN", "This email domain is not supported."],
    [409, "ALREADY_VERIFIED", "Refresh your verification status."],
    [429, "RATE_LIMITED", "Too many attempts."],
    [503, "UNAVAILABLE", "temporarily unavailable"],
    [503, "SEND_FAILED", "couldn't confirm the code request"],
    [401, "UNAUTHENTICATED", "Please sign in again"],
    [403, "FORBIDDEN", "Refresh the page"],
  ])("preserves the address after initiate failure %s/%s", async (status, code, message) => {
    fetchMock.mockResolvedValueOnce(page()).mockResolvedValueOnce(failure(status as number, code as string));
    await ready();
    const user = userEvent.setup();
    await user.type(input("University email"), email);
    await user.click(button("Request code"));
    expect((await screen.findByRole("alert")).textContent).toContain(message);
    expect(input("University email").value).toBe(email);
    expect(screen.queryByLabelText("Verification code")).toBeNull();
    expect(screen.queryByText(/Code requested/)).toBeNull();
    expect(screen.queryByText("Mailbox verified")).toBeNull();
    expect(screen.queryByText(/SECRET/)).toBeNull();
    if (status === 401) expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/sign-in?next=%2Faccount");
  });

  it.each([
    [400, "INVALID_CODE"], [400, "NOT_PENDING"], [429, "RATE_LIMITED"],
    [503, "UNAVAILABLE"], [401, "UNAUTHENTICATED"],
  ])("preserves the locked email and entered code after consume failure %s/%s", async (status, code) => {
    fetchMock.mockResolvedValueOnce(page()).mockResolvedValueOnce(success()).mockResolvedValueOnce(failure(status as number, code as string));
    await ready();
    const user = await requestCode();
    await user.type(input("Verification code"), "123456");
    await user.click(button("Verify code"));
    await screen.findByRole("alert");
    expect(input("Verification code").value).toBe("123456");
    expect(input("University email").value).toBe(email);
    expect(input("University email").readOnly).toBe(true);
    expect(button("Resend code").disabled).toBe(false);
    expect(button("Verify code").disabled).toBe(false);
    expect(screen.queryByText(/Mailbox control verified/)).toBeNull();
    expect(screen.queryByText(/SECRET/)).toBeNull();
    if (status === 401) expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/sign-in?next=%2Faccount");
  });

  it("retries an invalid code, preserves input on resend failure, and uses the latest code after resend", async () => {
    fetchMock.mockResolvedValueOnce(page()).mockResolvedValueOnce(success()).mockResolvedValueOnce(failure(400, "INVALID_CODE"))
      .mockResolvedValueOnce(failure(503, "SEND_FAILED")).mockResolvedValueOnce(success()).mockResolvedValueOnce(success()).mockResolvedValueOnce(page([{ ...item, verified: true }]));
    await ready();
    const user = await requestCode();
    await user.type(input("Verification code"), "111111");
    await user.click(button("Verify code"));
    await screen.findByRole("alert");
    await user.click(button("Resend code"));
    expect((await screen.findByRole("alert")).textContent).toContain("couldn't confirm the code request");
    expect(input("Verification code").value).toBe("111111");
    await user.click(button("Resend code"));
    await screen.findByText(/Code requested/);
    expect(input("Verification code").value).toBe("");
    await user.type(input("Verification code"), "222222");
    await user.click(button("Verify code"));
    expect(await screen.findByText("Mailbox verified")).toBeTruthy();
  });

  it("requires exactly six digits before consuming", async () => {
    fetchMock.mockResolvedValueOnce(page()).mockResolvedValueOnce(success());
    await ready();
    const user = await requestCode();
    await user.type(input("Verification code"), "123ab");
    await user.click(button("Verify code"));
    expect((await screen.findByRole("alert")).textContent).toContain("six-digit code");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("allows retrying an invalid code directly without requesting another", async () => {
    fetchMock.mockResolvedValueOnce(page()).mockResolvedValueOnce(success())
      .mockResolvedValueOnce(failure(400, "INVALID_CODE")).mockResolvedValueOnce(success())
      .mockResolvedValueOnce(page([{ ...item, verified: true }]));
    await ready();
    const user = await requestCode();
    await user.type(input("Verification code"), "123456");
    await user.click(button("Verify code"));
    await screen.findByRole("alert");
    await user.clear(input("Verification code"));
    await user.type(input("Verification code"), "654321");
    await user.click(button("Verify code"));
    expect(await screen.findByText("Mailbox verified")).toBeTruthy();
    expect(fetchMock).toHaveBeenNthCalledWith(4, "/api/affiliation/consume", expect.objectContaining({ body: JSON.stringify({ email, code: "654321" }) }));
  });

  it.each(["initiate", "consume"] as const)("preserves input without claiming success after a %s network failure", async operation => {
    fetchMock.mockResolvedValueOnce(page());
    if (operation === "consume") fetchMock.mockResolvedValueOnce(success());
    fetchMock.mockRejectedValueOnce(new Error("SECRET network diagnostic"));
    await ready();
    const user = userEvent.setup();
    if (operation === "consume") {
      await requestCode();
      await user.type(input("Verification code"), "123456");
    } else await user.type(input("University email"), email);
    await user.click(button(operation === "consume" ? "Verify code" : "Request code"));
    expect((await screen.findByRole("alert")).textContent).toContain("temporarily unavailable");
    expect(input("University email").value).toBe(email);
    if (operation === "consume") expect(input("Verification code").value).toBe("123456");
    expect(screen.queryByText(/Mailbox control verified|Code requested|SECRET/)).toBeNull();
  });

  it("blocks concurrent submits and address changes while consuming", async () => {
    let finish!: (response: Response) => void;
    fetchMock.mockResolvedValueOnce(page()).mockResolvedValueOnce(success())
      .mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
      .mockResolvedValueOnce(page([{ ...item, verified: true }]));
    await ready();
    const user = await requestCode();
    await user.type(input("Verification code"), "123456");
    await user.click(button("Verify code"));
    expect(button("Verifying…").disabled).toBe(true);
    expect(button("Edit address").disabled).toBe(true);
    expect(button("Resend code").disabled).toBe(true);
    expect(button("Refresh status").disabled).toBe(true);
    expect(input("Verification code").disabled).toBe(true);
    fireEvent.submit(input("Verification code").closest("form")!);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await act(async () => finish(success()));
    expect(await screen.findByText("Mailbox verified")).toBeTruthy();
  });

  it("aborts an unmounted pending request and ignores its late success after a fresh mount", async () => {
    let finish!: (response: Response) => void;
    fetchMock.mockResolvedValueOnce(page()).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
      .mockResolvedValueOnce(page());
    const view = await ready();
    const user = userEvent.setup();
    await user.type(input("University email"), email);
    await user.click(button("Request code"));
    const signal = fetchMock.mock.calls[1][1]?.signal;
    view.unmount();
    expect(signal?.aborted).toBe(true);
    await ready();
    await act(async () => finish(success()));
    expect(input("University email").value).toBe("");
    expect(screen.queryByLabelText("Verification code")).toBeNull();
    expect(screen.queryByText(/Code requested/)).toBeNull();
  });

  it.each([401, 429, 503])("shows safe, retryable status-loading failure %s", async status => {
    fetchMock.mockResolvedValueOnce(failure(status, "UNAVAILABLE")).mockResolvedValueOnce(page([item]));
    await ready();
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.queryByText(/SECRET/)).toBeNull();
    if (status === 401) expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/sign-in?next=%2Faccount");
    const user = userEvent.setup();
    await user.click(button("Retry loading status"));
    expect(await screen.findByText("Example University")).toBeTruthy();
  });

  it("fails closed on malformed status data and mismatched consume responses", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ items: [{ ...item, verified: "true" }], hasMore: false, nextOffset: null }))
      .mockResolvedValueOnce(success())
      .mockResolvedValueOnce(Response.json({ ok: true, universityId: "22222222-2222-4222-8222-222222222222" }));
    await ready();
    expect(screen.queryByText("Mailbox verified")).toBeNull();
    const user = await requestCode();
    await user.type(input("Verification code"), "123456");
    await user.click(button("Verify code"));
    await waitFor(() => expect(button("Verify code").disabled).toBe(false));
    expect(screen.queryByText(/Mailbox control verified/)).toBeNull();
    expect(input("Verification code").value).toBe("123456");
  });
});
