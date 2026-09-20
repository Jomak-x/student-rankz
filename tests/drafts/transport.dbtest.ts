// Compile-time transport contract (see .polly/database-service-contract.md).
//
// The drafts service must run unchanged on both supported Drizzle
// transports: the Neon HTTP driver that server/db.ts uses in production and
// the node-postgres driver the ephemeral tests use. This file contains no
// runtime code beyond literals — `tsc --noEmit` is the gate that proves the
// production client is accepted by every service function, so the service
// never relies on node-postgres-only behaviour (the service uses no
// interactive transactions, which the Neon HTTP transport does not provide).

import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type { AppDatabase } from "@/server/db";
import type { DraftsDatabase } from "@/server/drafts/service";

type AssertAssignable<Value extends Target, Target> = Value;

// Production transport: Neon HTTP via getDb().
const _productionTransport: AssertAssignable<AppDatabase, DraftsDatabase> =
  undefined as unknown as AppDatabase;
void _productionTransport;

// Test transport: ephemeral Postgres over node-postgres.
const _testTransport: AssertAssignable<
  NodePgDatabase<Record<string, never>>,
  DraftsDatabase
> = undefined as unknown as NodePgDatabase<Record<string, never>>;
void _testTransport;

export {};
