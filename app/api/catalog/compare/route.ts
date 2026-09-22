import { getCatalogService } from "@/server/catalog";
import { readCatalog } from "@/server/catalog/read";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const slugs = new URL(request.url).searchParams.getAll("slug");
  const headers = { "Cache-Control": "no-store" };
  if (slugs.length > 3 || slugs.some(slug => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 120)) {
    return Response.json({ status: "invalid" }, { status: 400, headers });
  }
  const result = await readCatalog(async () => {
    const service = getCatalogService();
    return Promise.all([...new Set(slugs)].map(slug => service.getUniversityDetail(slug)));
  });
  return Response.json(result, { status: result.status === "ready" ? 200 : 503, headers });
}
