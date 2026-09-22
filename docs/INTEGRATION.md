# Integration

PR #9 is the final integration draft. It joins database-backed catalog reads, private drafts, Managed Auth, and university-email verification. Public catalog rows have no fixture fallback. Drafts use real catalog UUIDs, remain private, and do not affect rankings. Compare slugs are the only catalog browser persistence.

Affiliation is wired in this draft: account pages initiate with `{ email }`, consume with `{ email, code }`, and display signed-in status pages. The internal cleanup route and daily cron are part of the final integration contract. Public posting and AI moderation remain deferred.

## Provenance and readiness gates

| Source | Provenance status |
| --- | --- |
| Database foundation [`e26e7ad`](https://github.com/Jomak-x/student-rankz/commit/e26e7ad4868683e9eaa4b83ea9eb194cc2acf31b) | Database configuration and seed-safety foundation |
| Managed Auth [`5fb5bc2`](https://github.com/Jomak-x/student-rankz/commit/5fb5bc2c069f8a50ec453ac02885170dc993dcda) | Auth session and caller-authorization contract |
| Rankings [`a8f9084`](https://github.com/Jomak-x/student-rankz/commit/a8f90849ddebe7c921fc5f768b59a0afa49b3839) | Rankings UI accessibility correction |
| Private drafts [`166748e`](https://github.com/Jomak-x/student-rankz/commit/166748e212d46d62045080ac8db462f0ed425239) | Draft validation and ownership correction |
| Draft-source recovery [`488e1bb`](https://github.com/Jomak-x/student-rankz/commit/488e1bb11d67e8f7924e0e225aab9fbfecae9e60) | Stacked draft CI recovery source |
| Catalog CI [`ee3daae`](https://github.com/Jomak-x/student-rankz/commit/ee3daae433776482d7919485a40b7a5335aaa30a) | Catalog feature-script ordering source |
| Deployment/testing docs [`55aad06`](https://github.com/Jomak-x/student-rankz/commit/55aad064edd663fae2390de0aa3811acf5ef716e) | Approved deployment and testing source |
| Integrated catalog [`eed5dc9`](https://github.com/Jomak-x/student-rankz/commit/eed5dc994f7185234e1a462bd2c1ce3aca0e1b52) | Independently approved by Sonnet |
| Affiliation cleanup [`b5fb0c9`](https://github.com/Jomak-x/student-rankz/commit/b5fb0c975ddcde84578c33b1fec89489beae263b) | Independently approved by Sonnet |
| Recipient ledger [`6684364`](https://github.com/Jomak-x/student-rankz/commit/6684364a2c6f18399d0ed33b2d27b574fe312ecb) | Historical source included in the final integration; no independent-approval claim |

The final PR #9 delta still requires final independent integration review and user approval. Configure Neon Auth, Resend/DNS, an authorized sender/mailbox, and Vercel cron before release; no source approval or local test substitutes for configured acceptance.

Managed Auth login and session code is complete. Configured-provider acceptance remains unperformed.

Retain source provenance, but merge only PR #9 after final independent integration review and user approval. Close source PRs as superseded and do not merge or cherry-pick duplicate patches.
