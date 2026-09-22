import { describe, expect, it } from "vitest";

import { safeRedirect } from "@/lib/auth/redirect";

describe("safeRedirect", () => {
  it.each([
    ["root", "/", "/"],
    ["local path", "/account", "/account"],
    ["query and fragment", "/account?tab=security#sessions", "/account?tab=security#sessions"],
    ["safe encoded query", "/account?next=%2Fsettings", "/account?next=%2Fsettings"],
    ["Unicode path", "/caf%C3%A9", "/caf%C3%A9"],
  ])("preserves a safe %s", (_label, value, expected) => {
    expect(safeRedirect(value)).toBe(expected);
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["number", 1],
    ["object", { pathname: "/account" }],
    ["empty", ""],
    ["relative path", "account"],
    ["absolute HTTPS URL", "https://evil.example/account"],
    ["absolute HTTP URL", "http://evil.example/account"],
    ["protocol relative URL", "//evil.example/account"],
    ["backslash authority", "/\\evil.example/account"],
    ["mixed slash authority", "/%5cevil.example/account"],
    ["encoded protocol relative URL", "%2F%2Fevil.example/account"],
    ["double-encoded protocol relative URL", "%252F%252Fevil.example/account"],
    ["deeply encoded protocol relative URL", "%25252F%25252Fevil.example/account"],
    ["encoded absolute URL", "%68%74%74%70%73%3A%2F%2Fevil.example"],
    ["encoded backslash", "/%5Cevil.example"],
    ["double-encoded backslash", "/%255Cevil.example"],
    ["newline", "/account\nSet-Cookie: bad=1"],
    ["carriage return", "/account\rSet-Cookie: bad=1"],
    ["tab", "/account\tbad"],
    ["encoded newline", "/account%0ASet-Cookie%3A%20bad%3D1"],
    ["encoded null", "/account%00evil"],
    ["malformed percent encoding", "/account/%E0%A4%A"],
    ["six encoding layers", "%252525252F%252525252Fevil.example"],
    ["oversized input", `/${"a".repeat(2048)}`],
  ])("falls back for %s", (_label, value) => {
    expect(safeRedirect(value)).toBe("/account");
  });

  it("does not invoke coercion hooks on untrusted non-string input", () => {
    const value = {
      toString() {
        throw new Error("must not be called");
      },
    };

    expect(safeRedirect(value)).toBe("/account");
  });
});
