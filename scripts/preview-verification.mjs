import { mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium, expect } from "@playwright/test";

// Isolated preview only: real React component + latest production CSS, with
// explicitly synthetic HTTP responses. Never adds a route or identity bypass.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, ".github/previews/fullstack-integration");
const staticRoot = path.join(root, ".next/static");
await readFile(path.join(root, ".next/BUILD_ID")); // Parent owns the build.
const css = (await readdir(path.join(staticRoot, "chunks"))).filter(name => name.endsWith(".css"));
if (!css.length) throw new Error("Production CSS missing; wait for the parent build.");
const bundle = await build({
  stdin: {
    contents: `
      import React from "react";
      import { createRoot } from "react-dom/client";
      import { VerificationPanel } from "@/components/affiliation/verification-panel";
      document.documentElement.classList.toggle("dark", new URLSearchParams(location.search).get("theme") === "dark");
      createRoot(document.getElementById("root")).render(
        <main className="mx-auto max-w-2xl px-4 py-8 text-foreground">
          <aside role="note" className="rounded-lg border border-border bg-muted px-4 py-3 text-sm">
            <strong>Synthetic preview · mocked transport</strong>
            <p>No email sent. No live authentication or account verification.</p>
          </aside>
          <h1 className="mt-6 text-2xl font-bold">University mailbox verification</h1>
          <VerificationPanel />
        </main>
      );
    `,
    resolveDir: root,
    loader: "tsx",
  },
  bundle: true,
  write: false,
  platform: "browser",
  jsx: "automatic",
  alias: { "@": root },
  define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
  logLevel: "silent",
});
const html = `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1">${css.map(name => `<link rel="stylesheet" href="/_next/static/chunks/${name}">`).join("")}<title>Synthetic verification preview</title></head><body class="bg-background font-sans"><div id="root"></div><script src="/preview.js"></script></body></html>`;
let browser;
try {
  const origin = "http://verification-preview.invalid";
  browser = await chromium.launch();
  await mkdir(output, { recursive: true });
  for (const state of ["empty", "light", "dark", "mobile", "success", "error"]) {
    const context = await browser.newContext({ viewport: state === "mobile" ? { width: 390, height: 1100 } : { width: 1100, height: 1000 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    let verified = false;
    const universityId = "00000000-0000-4000-8000-000000009001";
    await page.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname.startsWith("/api/affiliation")) {
        let status = 200;
        let data;
        if (url.pathname === "/api/affiliation") {
          data = { items: state === "empty" ? [] : [{ universityId, universityName: "Example University (synthetic)", verified, verifiedAt: verified ? "2026-01-01T12:00:00.000Z" : null }], hasMore: false, nextOffset: null };
        } else if (url.pathname.endsWith("/initiate")) {
          data = { ok: true, universityId };
        } else if (url.pathname.endsWith("/consume")) {
          if (state === "error") {
            status = 400;
            data = { error: { code: "INVALID_CODE", message: "Synthetic invalid code response." } };
          } else {
            verified = true;
            data = { ok: true, universityId };
          }
        } else throw new Error("Unexpected preview request");
        return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
      }
      if (url.pathname === "/") return route.fulfill({ contentType: "text/html", body: html });
      if (url.pathname === "/preview.js") return route.fulfill({ contentType: "text/javascript", body: Buffer.from(bundle.outputFiles[0].contents) });
      if (url.pathname.startsWith("/_next/static/")) {
        const file = path.resolve(staticRoot, url.pathname.slice("/_next/static/".length));
        if (!file.startsWith(staticRoot + path.sep)) return route.abort();
        return route.fulfill({ contentType: file.endsWith(".css") ? "text/css" : "font/woff2", body: await readFile(file) });
      }
      return route.abort();
    });
    await page.goto(`${origin}/?theme=${state === "dark" ? "dark" : "light"}`);
    await expect(page.getByRole("button", { name: "Request code", exact: true })).toBeEnabled();
    if (state !== "empty") {
      await page.getByLabel("University email", { exact: true }).fill("student@university.example");
      await page.getByRole("button", { name: "Request code", exact: true }).click();
      await expect(page.getByLabel("Verification code", { exact: true })).toBeVisible();
      if (state === "success" || state === "error") {
        await page.getByLabel("Verification code", { exact: true }).fill("123456");
        await page.getByRole("button", { name: "Verify code", exact: true }).click();
        if (state === "success") {
          await expect(page.getByText("Mailbox control verified. This does not prove enrollment or student status.", { exact: true })).toBeVisible();
        } else {
          await expect(page.getByRole("alert")).toContainText("This code is invalid or has expired.");
          await expect(page.getByLabel("University email")).toHaveValue("student@university.example");
          await expect(page.getByLabel("Verification code")).toHaveValue("123456");
        }
      }
    } else {
      await expect(page.getByText("No mailbox verifications yet.", { exact: true })).toBeVisible();
    }
    await expect(page.getByRole("note")).toContainText("Synthetic preview · mocked transport");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
    await page.screenshot({ path: path.join(output, `verification-${state}.png`), fullPage: true, animations: "disabled" });
    await context.close();
  }
  console.log("Captured 6 synthetic verification previews using the production component and build CSS.");
} finally {
  await browser?.close();
}
