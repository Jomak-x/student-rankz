import { getDb } from "@/server/db";
import { deleteReviewDraft, getReviewDraft, updateReviewDraft } from "@/server/drafts";
import { draftResponse, readDraftJson } from "@/server/http/draft-request";

export const dynamic = "force-dynamic";

type DraftContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: DraftContext): Promise<Response> {
  return draftResponse(request, false, async (owner) => {
    const { id } = await context.params;
    return getReviewDraft(getDb(), owner, id);
  });
}

export async function PATCH(request: Request, context: DraftContext): Promise<Response> {
  return draftResponse(request, true, async (owner) => {
    const { id } = await context.params;
    const input = await readDraftJson(request);
    return updateReviewDraft(getDb(), owner, id, input);
  });
}

export async function DELETE(request: Request, context: DraftContext): Promise<Response> {
  return draftResponse(request, true, async (owner) => {
    const { id } = await context.params;
    return deleteReviewDraft(getDb(), owner, id);
  });
}
