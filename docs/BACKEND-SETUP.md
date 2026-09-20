# Backend setup

This is the setup plan for the backend; the frontend PR currently uses demo data and browser-only drafts. No services are provisioned by this document. See [architecture](./ARCHITECTURE.md) for the integration boundaries.

## Set up now

| Service | Initial setup |
| --- | --- |
| Neon | One project in an EU region, with production and development branches. |
| Vercel | Connect the repository. Keep demo previews on the free plan where eligible. |
| Resend | Use the free tier; verify a sending domain before sending to real users. |
| AI gateway | Deferred. No gateway account, model keys or paid moderation service required now. |

### Neon: one project, separate branches

Choose the EU region when creating the project. Use `main` for production and `dev` for development. Seed development with synthetic data. Once production contains identities, use schema-only branching where supported instead of copying production rows into development. Authentication data must also stay isolated.

Start with a shared development branch. Add temporary branches for PRs that change the backend, derived from the synthetic development branch; delete them when the PR closes. There is no need to create database branches for frontend-only changes. Deploy schema changes by applying reviewed migrations to production, not by merging database branches.

Use a small compute with scale-to-zero and a bounded autoscaling range. Monitor usage and configure available alerts; an alert is not a hard spending cap. Increase capacity only when measured load justifies it. A second project is unnecessary for this MVP; it would only become useful for stricter administrative isolation.

Use the pooled connection for application traffic and a direct connection for migration tools that require one. References: [branching](https://neon.com/docs/introduction/branching), [regions](https://neon.com/docs/introduction/regions), [connection pooling](https://neon.com/docs/connect/connection-pooling).

### Vercel and Resend

Vercel Hobby is restricted to non-commercial personal use. Use it while the project fits those terms; reassess before commercial/team operation. Mock data alone does not establish eligibility. [Hobby terms](https://vercel.com/docs/plans/hobby).

Resend's free tier currently allows 3,000 emails per month with a 100-per-day limit. Rate-limit verification requests and avoid optional notification emails initially. An EU sending region does not by itself establish EU storage for message contents or logs. Check data-processing terms before using real student addresses. [Pricing](https://resend.com/pricing), [privacy information](https://resend.com/security/gdpr).

A Vercel preview URL is enough for the demo. For a branded site and authenticated email, register a domain; DNS hosting is commonly included with registration, so you do not necessarily buy a separate DNS service. Verify a sending subdomain such as `mail.example.eu` using the exact DNS records Resend supplies. [Domain setup](https://resend.com/docs/dashboard/domains/introduction).

## CLI workflow

Use the Neon CLI across coding agents; MCP is optional. The following are inspection commands, not provisioning commands:

```bash
neon --help
neon branches list --project-id YOUR_PROJECT_ID
neon branches create --help
```

Follow the [CLI authentication guide](https://neon.com/docs/cli) to sign in locally. Keep tokens and connection strings out of chats and commits. `gh`, Node and npm are also useful; Vercel CLI is optional. No additional email CLI is required.

## Environment configuration

These are proposed server-side names, to finalize when integration is implemented:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Pooled connection for the matching environment |
| `DATABASE_DIRECT_URL` | Migration connection, restricted to migration tooling |
| `RESEND_API_KEY` | Transactional email credential |
| `EMAIL_FROM` | Verified sender address |

Add auth-specific configuration after selecting and testing the provider. Do not configure model keys yet. Store secrets in local ignored environment files and Vercel's environment settings; never use `NEXT_PUBLIC_` for secrets. Production must use production credentials; development and previews must use their corresponding isolated data and auth configuration. [Vercel environments](https://vercel.com/docs/environment-variables).

## Implementation order

1. Add the database schema and migrations, then replace fixture reads.
2. Integrate authentication. Evaluate Neon Auth first; self-hosted Better Auth is the fallback. Confirm verification, recovery, preview isolation and pricing before committing to the provider.
3. Add university affiliation verification separately from login: approved exact domains, account-bound single-use codes, expiry and request limits. A personal login email is allowed. University mailbox access proves mailbox control, not enrollment or attendance.
4. Add private review drafts and ownership checks. Keep public submission/publication disabled while moderation is deferred.
5. Once a gateway is available, implement lexical checks, inexpensive model review and stronger-model escalation. Publish only after successful checks; failures stay pending. Add reporting and appeals before public launch.

Before enabling real submissions, test expired/replayed verification codes, cross-university authorization, identity isolation, and moderation failure handling. No paid queue, separate worker service or hired moderation team is required for the prototype. Public anonymity means other users cannot see authors; the service still processes private account data.
