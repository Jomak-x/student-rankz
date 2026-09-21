// Migration connection resolution shared by drizzle-kit.
//
// Preference order:
//   1. DATABASE_DIRECT_URL — the migration-specific connection.
//   2. DATABASE_URL — documented fallback for local/CI setups with a single
//      connection.
// Blank (empty or whitespace-only) and absent values count as unset, so an
// empty .env placeholder never wins. Values are never logged.
export function resolveMigrationUrl(
  env: Record<string, string | undefined> = process.env,
): string {
  const direct = env.DATABASE_DIRECT_URL?.trim();
  if (direct) {
    return direct;
  }
  const pooled = env.DATABASE_URL?.trim();
  if (pooled) {
    return pooled;
  }
  // Explicitly empty: drizzle-kit commands that need a database will fail
  // fast with their own credential error instead of misdirecting traffic.
  return "";
}
