# Deployment

Deploy the integrated application to Vercel with one Neon project and Resend. This guide does not provision services or confirm that a deployment has been tested.

## Release status

The current `main` branch is the frontend prototype. Database, authentication, verification, and private-draft changes are separate PRs. Merge the reviewed integration and its documented prerequisites before following the full-stack steps below. Until then, backend commands and configuration are not available on `main`.

Public review posting and AI moderation remain disabled. A configured first release supports browsing, student-experience rankings, sign-in, university-email verification, and private drafts. Email verification establishes mailbox control, not enrollment or attendance.

## Environments

Use one Neon project in an appropriate EU region:

| Environment | Database | Authentication | Data |
| --- | --- | --- | --- |
| Production | `main` | Managed Neon Auth for that branch | Real data; initially empty |
| Demo | `demo-synthetic` | Managed Neon Auth for that branch | Explicitly seeded synthetic data |
| Local development | A synthetic development branch | Its managed Auth endpoint when exercising login | Synthetic data |
| Automated tests | Ephemeral local/CI PostgreSQL | Injected test doubles where documented | Disposable test data |

Create demo and development branches from an empty or synthetic parent. Branching can copy existing database and auth data: never use a production branch containing personal data as their parent. Keep demo accounts disposable; users must not put personal information into them.

Every publicly accessible deployment uses real managed authentication. Mock sessions belong only in isolated automated tests, never in public previews or demo deployments.

## Services and configuration

1. Create or select the Neon project and the intended branch. Enable managed Neon Auth separately for each deployed environment.
2. Create a Vercel project connected to the repository. Vercel's Git integration creates deployments from pushes; changes to the production branch can deploy automatically.
3. Configure Resend and its sending domain. Add **exactly** the DNS records shown by the Resend dashboard, including their types and values. Continue only after the dashboard confirms the required verification.
4. Set the integrated application's documented environment variables in Vercel. Use its `.env.example` and [backend setup](BACKEND-SETUP.md) as the authoritative list; do not guess missing variable names.

Configuration includes the database connection, migration connection, matching Neon Auth endpoint and cookie secret, exact application origin, and verification/email secrets. Never prefix secrets with `NEXT_PUBLIC_`, commit them, or put them in screenshots.

Give the demo deployment its own database **and matching Auth endpoint**. A shared preview variable pointing to `dev` does not configure `demo-synthetic`. Set the exact origin for each deployment; do not weaken origin checks to accommodate preview URLs. A dedicated demo Vercel project can be used with the same Neon project when it makes those settings clearer.

Use free service plans only where eligible. [Vercel Hobby](https://vercel.com/docs/plans/hobby) is for personal, noncommercial use. Check [Resend's current limits](https://resend.com/pricing); test messages also consume sending capacity. Do not upgrade or provision paid resources automatically.

## Release sequence

Keep automatic Git deployments and use this order:

1. Review the complete release and its PR merge order. Confirm current CI passes for the exact release commits.
2. Configure and test the release against the synthetic demo environment first. Confirm the database and Auth endpoint refer to the same intended branch.
3. Inspect migrations. Apply only backward-compatible, additive changes to production while the old application is still serving traffic. If a migration breaks the old application, stop and write a coordinated maintenance/deployment plan for that release.
4. Apply the reviewed migrations using the target environment's migration connection. After the full-stack integration is available, the application command is `npm run db:migrate`. Do not seed production.
5. Complete the demo acceptance checks in [TESTING.md](TESTING.md), including real-provider login and email tests. Resolve failures before merging the production release.
6. Merge the reviewed release PRs in their documented order. Vercel's Git integration then deploys the production branch automatically. Confirm the deployed commit matches the intended release.
7. Run the production acceptance checks. Check application and provider logs for failures without exposing credentials or verification codes.

Do not merge first and plan to migrate afterward. Do not run migrations or seeds as part of the application build. Intermediate PRs must remain deployable; when combining dependent feature work, follow the final integration PR's release instructions.

## Demo data

Seeding is a separate, explicit operation against `demo-synthetic`. The final integration PR must document its exact seed command and confirmation flags before release; feature-branch commands are not assumed to exist on `main`.

Confirm the selected branch in the Neon dashboard before any seed command. Use a dedicated terminal environment containing only that branch's credentials. A hostname or an environment label alone does not prove which data the connection reaches.

The seed must be repeatable, clearly synthetic, and absent from builds, deploys, and production migrations. Production should show honest empty states until real catalog data exists.

## Database inspection

Prefer the Neon SQL Editor after explicitly selecting project, branch, and database. For CLI access, follow the [official `neon psql` syntax](https://neon.com/docs/cli/psql), for example:

```bash
neon psql main --project-id YOUR_PROJECT_ID
```

Select the appropriate database and role using the documented `--database-name` and `--role-name` options when needed. Use the application migration command for application schema changes; the SQL Editor is not a substitute migration history.

## Rollback

For a code regression, create a revert branch, revert the release change, run the relevant checks, and open a PR. After review, merging the revert PR triggers the normal Git deployment. Never push directly to `main`.

```bash
git switch -c fix/revert-release origin/main
git revert RELEASE_COMMIT
git push -u origin fix/revert-release
gh pr create --base main --title "Revert release regression"
```

This example assumes an ordinary commit; a merge commit requires reviewing the correct mainline before reverting. A code revert does not undo database migrations or restore deleted data. Keep additive schema changes in place when compatible; destructive database recovery requires a separately reviewed restoration plan.

## Provider references

- [Vercel Git deployments](https://vercel.com/docs/git)
- [Neon CLI](https://neon.com/docs/reference/neon-cli)
- [Resend domain verification](https://resend.com/docs/dashboard/domains/manage-domains)
- [Resend test email addresses](https://resend.com/docs/dashboard/emails/send-test-emails)
