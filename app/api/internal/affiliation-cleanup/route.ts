import { createHash, timingSafeEqual } from "node:crypto";
import { cleanupRecipientSendLog } from "@/server/affiliation/cleanup";
import { getVerificationDatabase } from "@/server/affiliation/runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
const json = (value: unknown, status: number) => Response.json(value, { status, headers: { "Cache-Control": "private, no-store" } });
const digest = (value: string) => createHash("sha256").update(value).digest();

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32 || /\s/.test(secret)) return json({ error: "Maintenance unavailable." }, 503);
  const header = request.headers.get("authorization") ?? "";
  if (!timingSafeEqual(digest(header), digest(`Bearer ${secret}`))) return json({ error: "Unauthorized." }, 401);
  // Retention policy is fixed by the service's database clock. No browser
  // session, query token, recipient, cutoff, or request body can change it.
  if (new URL(request.url).search || request.body || (request.headers.get("content-length") ?? "0") !== "0") {
    return json({ error: "Invalid maintenance request." }, 400);
  }
  try {
    const deleted = await cleanupRecipientSendLog(getVerificationDatabase());
    return json({ deleted }, 200);
  } catch { return json({ error: "Maintenance unavailable." }, 503); }
}

// Next otherwise delegates HEAD to GET, which must not trigger maintenance.
export function HEAD() { return new Response(null, { status: 405, headers: { "Cache-Control": "private, no-store", Allow: "GET" } }); }
