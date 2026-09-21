# Integration

The final integration joins the database-backed public catalog, managed-auth boundary, and private draft API. Public university, course, instructor, home, and ranking reads come from the catalog service. Scores and review counts are derived from stored synthetic sample reviews in demo mode; no fixture fallback is used.

Review composers receive real catalog UUID targets and save only authenticated private drafts. Drafts are never public, do not alter catalog aggregates, and have no browser `localStorage` fallback. The only catalog browser persistence is the compare selection, stored as university slugs in `student-rankz-catalog-compare`.

Affiliation remains unavailable pending approval. Public review posting, publication, AI moderation, and score changes from drafts are deferred.

## Source provenance

PR #9 contains the integration prerequisites and the cherry-pick provenance for the source work. Preserve that provenance when reviewing the final diff.

| Slice | Source commit |
| --- | --- |
| Database foundation | `e26e7ad4868683e9eaa4b83ea9eb194cc2acf31b` |
| Managed auth | `5fb5bc2c069f8a50ec453ac02885170dc993dcda` |
| Rankings/UI | `a8f90849ddebe7c921fc5f768b59a0afa49b3839` |
| Private drafts | `166748e212d46d62045080ac8db462f0ed425239` (PR #8) |
| Approved catalog integration | [`ee3daae`](https://github.com/Jomak-x/student-rankz/commit/ee3daae433776482d7919485a40b7a5335aaa30a) |
| Approved deployment/testing source | [`55aad06`](https://github.com/Jomak-x/student-rankz/commit/55aad064edd663fae2390de0aa3811acf5ef716e) |

## Merge plan

Review source PRs independently for their provenance and scope. Do not merge or cherry-pick their patches separately. After final integration approval, merge only PR #9, then close the source PRs as superseded. This avoids duplicate patches and source-order conflicts.

No provider, deployment, or live validation is claimed by this integration document.
