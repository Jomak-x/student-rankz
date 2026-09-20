import { expect, it, vi } from "vitest";
import type { createAuthClient } from "@neondatabase/auth/next";

type Client = ReturnType<typeof createAuthClient>;
const provider = vi.hoisted(() => ({
  create: vi.fn(),
  signIn: vi.fn<Client["signIn"]["email"]>(),
  signUp: vi.fn<Client["signUp"]["email"]>(),
  signOut: vi.fn<Client["signOut"]>(),
}));
vi.mock("@neondatabase/auth/next", () => ({ createAuthClient: provider.create }));
import { authClient } from "@/lib/auth/client";

it("lazily delegates to the installed same-origin SDK without server configuration", async () => {
  expect(provider.create).not.toHaveBeenCalled();
  provider.create.mockReturnValue({ signIn: { email: provider.signIn }, signUp: { email: provider.signUp }, signOut: provider.signOut });
  const failure = { data: null, error: { status: 503, statusText: "Unavailable", message: "Unavailable" } };
  provider.signIn.mockResolvedValue(failure);
  provider.signUp.mockResolvedValue(failure);
  provider.signOut.mockResolvedValue(failure);
  const input = { email: "synthetic@example.com", password: "synthetic-password" };
  await expect(authClient.signInEmail(input)).resolves.toEqual(failure);
  await expect(authClient.signUpEmail({ ...input, name: "Synthetic Tester" })).resolves.toEqual(failure);
  await expect(authClient.signOut()).resolves.toEqual(failure);
  expect(provider.create).toHaveBeenCalledExactlyOnceWith();
  expect(provider.signIn).toHaveBeenCalledWith(input);
  expect(provider.signUp).toHaveBeenCalledWith({ ...input, name: "Synthetic Tester" });
  expect(provider.signOut).toHaveBeenCalledExactlyOnceWith();
});
