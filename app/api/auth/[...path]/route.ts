import { getAuth } from "@/lib/auth/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ path: string[] }> };

function unavailable(): Response {
  return Response.json(
    { error: { message: "Authentication is temporarily unavailable." } },
    { status: 503, headers: { "Cache-Control": "private, no-store" } },
  );
}

async function handle(method: "GET" | "POST", request: Request, context: Context) {
  const auth = getAuth();
  if (!auth) return unavailable();
  try {
    // The SDK resolves this path against the provider URL. Keep it relative to
    // the configured endpoint, including after Next decodes route parameters.
    const { path } = await context.params;
    if (!path.length || path.some((segment) => !/^[a-zA-Z0-9_-]+$/.test(segment))) {
      return Response.json(
        { error: { message: "Invalid authentication endpoint." } },
        { status: 400, headers: { "Cache-Control": "private, no-store" } },
      );
    }
    const response = await auth.handler()[method](request, context);
    if (response.status >= 500) return unavailable();
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch {
    return unavailable();
  }
}

export async function GET(request: Request, context: Context) {
  return handle("GET", request, context);
}

export async function POST(request: Request, context: Context) {
  return handle("POST", request, context);
}
