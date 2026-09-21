import { getDb } from "@/server/db";
import { createReviewDraft, listReviewDrafts } from "@/server/drafts";
import { draftResponse, readDraftJson, readDraftListOptions } from "@/server/http/draft-request";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return draftResponse(request, false, async (owner) => {
    const options = readDraftListOptions(request);
    return listReviewDrafts(getDb(), owner, options);
  });
}

export async function POST(request: Request): Promise<Response> {
  return draftResponse(request, true, async (owner) => {
    const input = await readDraftJson(request);
    return createReviewDraft(getDb(), owner, input);
  }, 201);
}
