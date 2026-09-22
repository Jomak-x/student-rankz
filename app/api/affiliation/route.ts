import { listOwnedVerifications } from "@/server/affiliation/runtime";
import { verificationOffset, verificationResponse } from "@/server/http/affiliation-request";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return verificationResponse(request, false, principal => listOwnedVerifications(principal, verificationOffset(request)));
}
