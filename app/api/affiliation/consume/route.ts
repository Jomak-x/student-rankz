import { getVerificationService } from "@/server/affiliation/runtime";
import { verificationBody, verificationResponse, VerificationRequestError } from "@/server/http/affiliation-request";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return verificationResponse(request, true, async principal => {
    const input = await verificationBody(request, true);
    const result = await getVerificationService().consume(principal, input.email, input.code);
    if (!result.ok) throw new VerificationRequestError(result.error);
    return result;
  });
}
