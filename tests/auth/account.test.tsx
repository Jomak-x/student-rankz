// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { VerifiedSession } from "@/lib/auth/server";
import AccountPage from "@/app/account/page";

const boundary = vi.hoisted(() => ({
  session: vi.fn<() => Promise<VerifiedSession>>(),
  redirect: vi.fn((path: string): never => { throw new Error(`REDIRECT:${path}`); }),
}));
vi.mock("@/lib/auth/server", () => ({ getVerifiedSession: boundary.session }));
vi.mock("next/navigation", () => ({ redirect: boundary.redirect }));
vi.mock("@/components/auth/sign-out-button", () => ({ SignOutButton: () => <button>Sign out</button> }));
afterEach(cleanup);

describe("protected account page", () => {
  it("redirects anonymous sessions to sign-in without rendering account data", async () => {
    boundary.session.mockResolvedValue({ status: "anonymous" });
    await expect(AccountPage()).rejects.toThrow("REDIRECT:/sign-in?next=%2Faccount");
  });
  it("renders unavailable when the verifier fails closed", async () => {
    boundary.session.mockResolvedValue({ status: "unavailable" });
    render(await AccountPage());
    expect(screen.getByText("Account access is temporarily unavailable")).toBeTruthy();
    expect(screen.queryByText("Your account")).toBeNull();
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
  });
  it("renders verified identity but expressly does not grant affiliation", async () => {
    boundary.session.mockResolvedValue({ status: "authenticated", user: { id: "opaque-provider-subject", name: "Synthetic Tester", email: "synthetic@example.com" } });
    render(await AccountPage());
    expect(screen.getByText("Synthetic Tester")).toBeTruthy();
    expect(screen.getByText("synthetic@example.com")).toBeTruthy();
    expect(screen.getByText(/It does not confirm enrollment, student status, or affiliation/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
  });
});
