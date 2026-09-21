// Explicitly opt-in DEMO RATINGS seed runner. This script NEVER runs
// automatically: nothing in build, deploy, migration or CI invokes it (CI
// database tests call seedDemoRatings() directly against an ephemeral
// database).
//
// Three independent, explicit confirmations are required before any write:
//
//   1. SEED_SCOPE=demo              — the operator declares a demo target.
//   2. --yes                        — the operator confirms the action.
//   3. --acknowledge-demo-data      — the operator acknowledges that these
//                                     rows are synthetic demo data only.
//
// Environment safeguard: the script refuses to run when NODE_ENV=production
// or VERCEL_ENV is set. This is a coarse guard against obvious production
// runtimes — it is NOT proof of which database a connection string points at.
// A DATABASE_URL cannot prove which physical database or hosted branch it
// references, and this script does not pretend to; verifying the target is
// the operator's responsibility. Production (main) must contain only real
// records or be honestly empty and must never receive synthetic rows.

import { seedDemoRatings, createDemoRatingsSeedClient } from "@/db/demo-ratings-seed";

function fail(message: string): never {
  console.error(`Refusing to seed demo ratings: ${message}`);
  console.error("");
  console.error("Synthetic demo ratings require explicit opt-in:");
  console.error("  1. export SEED_SCOPE=demo            # declare a demo target");
  console.error("  2. npm run db:seed:demo -- --yes     # confirm the action");
  console.error("  3. add --acknowledge-demo-data       # acknowledge synthetic demo data");
  console.error("");
  console.error(
    "Note: a DATABASE_URL cannot prove which database or hosted branch it points at. Verify the target database yourself before confirming. Production must never receive synthetic rows.",
  );
  process.exit(1);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const hasYesFlag = args.includes("--yes");
  const hasAckFlag = args.includes("--acknowledge-demo-data");
  const scope = process.env.SEED_SCOPE;
  const url = process.env.DATABASE_URL;

  // Coarse environment safeguard first: production runtimes are refused
  // outright, regardless of flags.
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV) {
    fail(
      `the environment looks like a production runtime (NODE_ENV=${JSON.stringify(
        process.env.NODE_ENV,
      )}, VERCEL_ENV=${JSON.stringify(process.env.VERCEL_ENV)}).`,
    );
  }
  if (!url) {
    fail("DATABASE_URL is not set.");
  }
  if (scope !== "demo") {
    fail(
      `SEED_SCOPE must be exactly "demo" for this dataset (got ${
        scope ? `"${scope}"` : "nothing"
      }).`,
    );
  }
  if (!hasYesFlag) {
    fail("the --yes confirmation flag is missing.");
  }
  if (!hasAckFlag) {
    fail("the --acknowledge-demo-data acknowledgment is missing.");
  }

  const client = createDemoRatingsSeedClient(url);
  try {
    const summary = await seedDemoRatings(client);
    console.log(
      `Synthetic demo ratings applied to the demo database (scope "demo"): ` +
        `${summary.reviews} fictional sample reviews, ${summary.ratings} rating rows ` +
        `(universities: ${summary.bySubject.university}, courses: ${summary.bySubject.course}, ` +
        `instructors: ${summary.bySubject.instructor}).`,
    );
    console.log(
      "These rows are provenance-marked demo data. Production must never receive them.",
    );
  } finally {
    await client.$client.end();
  }
}

main().catch((error) => {
  console.error("Demo ratings seed failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
