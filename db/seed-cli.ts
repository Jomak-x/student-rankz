// Explicitly opt-in seed runner. This script NEVER runs automatically: it is
// not part of build, deploy or CI pipelines (CI database tests invoke the
// seedDatabase() function directly against an ephemeral database).
//
// Two independent, explicit confirmations are required before any write:
//
//   1. SEED_SCOPE environment variable set to "development" or "demo",
//      declaring the operator's intended target.
//   2. The --yes command line flag, confirming the action.
//
// The script cannot verify which physical database or hosted branch a
// DATABASE_URL string points at, and does not attempt to. Confirming the
// scope is a statement by the operator, not a property of the URL. Never
// point SEED_SCOPE at a production database: production must contain only
// real records (or be honestly empty) and must never receive synthetic rows.
//
// Configuration loading matches drizzle.config.ts: the project .env file is
// loaded when present (Node >= 20.12) before validation, so copying
// .env.example to .env is enough for the documented `npm run db:seed`
// workflow. Exported environment variables take precedence over .env values
// (Node semantics). Connection strings are never logged.

import { seedDatabase, createSeedClient } from "@/db/seed";

const ALLOWED_SCOPES = new Set(["development", "demo"]);

function fail(message: string): never {
  console.error(`Refusing to seed: ${message}`);
  console.error("");
  console.error("Synthetic seed requires explicit opt-in:");
  console.error('  1. export SEED_SCOPE=development   # or "demo"');
  console.error("  2. npm run db:seed -- --yes");
  console.error("");
  console.error(
    "Note: a DATABASE_URL cannot prove which branch it points at. Verify the target database yourself before confirming.",
  );
  process.exit(1);
}

async function main(): Promise<void> {
  try {
    process.loadEnvFile();
  } catch {
    // No .env file in the working directory — environment variables only.
  }

  const hasYesFlag = process.argv.includes("--yes");
  const scope = process.env.SEED_SCOPE;
  const url = process.env.DATABASE_URL;

  if (!url) {
    fail("DATABASE_URL is not set.");
  }
  if (!scope || !ALLOWED_SCOPES.has(scope)) {
    fail(
      `SEED_SCOPE must be set to "development" or "demo" (got ${scope ? `"${scope}"` : "nothing"}).`,
    );
  }
  if (!hasYesFlag) {
    fail("the --yes confirmation flag is missing.");
  }

  const client = createSeedClient(url);
  try {
    await seedDatabase(client);
    console.log(
      `Synthetic seed applied to ${scope} database (fictional example data only).`,
    );
  } finally {
    await client.$client.end();
  }
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
