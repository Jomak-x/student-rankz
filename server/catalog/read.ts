import "server-only";
import { isCatalogUnavailableError } from "./errors";

export type CatalogRead<T> = { status: "ready"; data: T } | { status: "unconfigured" | "unavailable" };
/** Render infrastructure failures honestly, without leaking SQL/connection causes. */
export async function readCatalog<T>(load: () => Promise<T>): Promise<CatalogRead<T>> {
  try { return { status: "ready", data: await load() }; }
  catch (error) {
    return { status: isCatalogUnavailableError(error) && error.reason === "database-not-configured" ? "unconfigured" : "unavailable" };
  }
}
