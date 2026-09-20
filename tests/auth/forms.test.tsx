// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AuthClientAdapter } from "@/lib/auth/client";
import { SignInForm } from "@/components/auth/sign-in-form";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { SignOutButton } from "@/components/auth/sign-out-button";

const mocks = vi.hoisted(() => ({
  signInEmail: vi.fn<AuthClientAdapter["signInEmail"]>(),
  signUpEmail: vi.fn<AuthClientAdapter["signUpEmail"]>(),
  signOut: vi.fn<AuthClientAdapter["signOut"]>(),
  push: vi.fn(), refresh: vi.fn(),
}));
vi.mock("@/lib/auth/client", () => ({ authClient: mocks }));
vi.mock("next/navigation", () => ({ useRouter: () => mocks }));
afterEach(cleanup);
beforeEach(() => { vi.resetAllMocks(); });
const failure = { data: null, error: { message: "SECRET provider details", status: 401, statusText: "Unauthorized" } };

async function credentials(signup = false) {
  const user = userEvent.setup();
  if (signup) await user.type(screen.getByLabelText("Name"), "Synthetic Tester");
  await user.type(screen.getByLabelText("Email"), "synthetic@example.com");
  await user.type(screen.getByLabelText("Password", { exact: true }), "synthetic-password");
  return user;
}

describe("auth forms through typed mocked provider boundary", () => {
  it.each(["sign-in", "sign-up"])("%s validates before contacting the provider", async (mode) => {
    const { container } = render(mode === "sign-in" ? <SignInForm available redirectTo="/account" /> : <SignUpForm available redirectTo="/account" />);
    fireEvent.submit(container.querySelector("form")!);
    expect(screen.getByText("Enter a valid email address.")).toBeTruthy();
    expect(screen.getByLabelText("Email").getAttribute("aria-invalid")).toBe("true");
    expect(mocks.signInEmail).not.toHaveBeenCalled();
    expect(mocks.signUpEmail).not.toHaveBeenCalled();
  });

  it.each(["sign-in", "sign-up"])("%s unavailable config disables submission and links to the other page", (mode) => {
    const { container } = render(mode === "sign-in" ? <SignInForm available={false} redirectTo="/account" /> : <SignUpForm available={false} redirectTo="/account" />);
    expect((screen.getByLabelText("Email") as HTMLInputElement).disabled).toBe(true);
    fireEvent.submit(container.querySelector("form")!);
    expect(mocks.signInEmail).not.toHaveBeenCalled();
    expect(mocks.signUpEmail).not.toHaveBeenCalled();
    expect(container.querySelector(`a[href="/${mode === "sign-in" ? "sign-up" : "sign-in"}?next=%2Faccount"]`)).toBeTruthy();
  });

  it.each(["provider", "network"])("sign-in handles %s failure without leaking details", async (kind) => {
    if (kind === "provider") mocks.signInEmail.mockResolvedValue(failure);
    else mocks.signInEmail.mockRejectedValue(new Error("SECRET network details"));
    render(<SignInForm available redirectTo="/account" />);
    const user = await credentials();
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByText(/SECRET/)).toBeNull();
    expect(mocks.push).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Sign in" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("sign-in disables duplicate submission until completion", async () => {
    let finish!: (value: Awaited<ReturnType<AuthClientAdapter["signInEmail"]>>) => void;
    mocks.signInEmail.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    render(<SignInForm available redirectTo="/account" />);
    const user = await credentials();
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect((screen.getByRole("button", { name: /Signing in/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText("Email") as HTMLInputElement).disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: /Signing in/ }));
    expect(mocks.signInEmail).toHaveBeenCalledTimes(1);
    finish(failure);
    await screen.findByRole("alert");
  });

  it("sign-in navigates and refreshes on typed provider success", async () => {
    mocks.signInEmail.mockResolvedValue({ data: { redirect: false, token: "synthetic", user: { id: "user-1", name: "Synthetic Tester", email: "synthetic@example.com", emailVerified: false, createdAt: new Date(), updatedAt: new Date() } }, error: null });
    render(<SignInForm available redirectTo="/courses" />);
    const user = await credentials();
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(mocks.signInEmail).toHaveBeenCalledWith({ email: "synthetic@example.com", password: "synthetic-password" });
    expect(mocks.push).toHaveBeenCalledWith("/courses");
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it.each(["provider", "network"])("sign-up handles %s failure", async (kind) => {
    if (kind === "provider") mocks.signUpEmail.mockResolvedValue(failure);
    else mocks.signUpEmail.mockRejectedValue(new Error("SECRET network details"));
    render(<SignUpForm available redirectTo="/account" />);
    const user = await credentials(true);
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByText(/SECRET/)).toBeNull();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("sign-up accepts personal email but does not imply verification without a session", async () => {
    mocks.signUpEmail.mockResolvedValue({ data: { token: null, user: { id: "user-1", name: "Synthetic Tester", email: "synthetic@example.com", emailVerified: false, createdAt: new Date(), updatedAt: new Date() } }, error: null });
    render(<SignUpForm available redirectTo="/account" />);
    const user = await credentials(true);
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("status")).toBeTruthy();
    expect(screen.getByText(/If email verification is enabled/)).toBeTruthy();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("sign-up navigates and refreshes when the provider issues a session", async () => {
    mocks.signUpEmail.mockResolvedValue({ data: { token: "synthetic-token", user: { id: "user-1", name: "Synthetic Tester", email: "synthetic@example.com", emailVerified: false, createdAt: new Date(), updatedAt: new Date() } }, error: null });
    render(<SignUpForm available redirectTo="/courses" />);
    const user = await credentials(true);
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(mocks.push).toHaveBeenCalledWith("/courses");
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it.each(["provider", "network"])("sign-out %s failure keeps the user on the page", async (kind) => {
    if (kind === "provider") mocks.signOut.mockResolvedValue(failure);
    else mocks.signOut.mockRejectedValue(new Error("SECRET"));
    render(<SignOutButton />);
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("sign-out refreshes server navigation on success", async () => {
    mocks.signOut.mockResolvedValue({ data: { success: true }, error: null });
    render(<SignOutButton />);
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/sign-in"));
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });
});
