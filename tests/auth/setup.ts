import { afterEach, vi } from "vitest";

// Offline tests must explicitly mock the SDK boundary. An accidental network call fails.
vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network disabled in auth unit tests"); }));
afterEach(() => { vi.unstubAllEnvs(); });
