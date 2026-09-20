# Should we build Student Rankz?

**My recommendation: yes, spend one week building and testing a focused MVP. Do not assume it will reach millions of users.**

**Product scope:** university reviews and student-experience rankings bring students in; programme/course and optional instructor reviews help them after enrollment. See the concise [product and growth direction](PRODUCT-DIRECTION.md).

The previous brief was oversized for an AI-assisted founder project. It treated potential later-stage staffing and architecture as immediate requirements. That was the wrong baseline.

## Can it get a few million users in a year?

Possible is different from likely. We have no customer or acquisition evidence supporting a high likelihood yet.

- **2 million distinct visitors over a year:** roughly 167,000 new people/month on average, with a higher later-month rate if starting near zero. Returning visitors cannot be counted again toward this annual total.
- **2 million registered accounts:** substantially harder; most readers will not register.
- **2 million monthly active users by year-end:** a major consumer-product success, not a reasonable base forecast.

The hard part is getting students to find it, contribute, and return. AI makes building cheaper; it does not create a student audience.

Our strongest pitch is **useful course and teaching feedback from people with verified university connections**, with public anonymity and multilingual access. Similar products exist, including [Profrate](https://profrate.de/), so execution and distribution must make the difference.

## EU, not Germany

The product should support EU institutions and multiple languages from the start. Germany is not the default market.

Seed the EU directory from reusable sources; enable contribution wherever institution verification and moderation are ready. Promote through whichever student communities we can reach. Focusing recruitment is a way to fill useful course pages, not a restriction of the product to one country.

“All EU universities listed” and “every university's student-email rules verified” are separate milestones.

## Can AI handle moderation?

**Yes: local filter → cheap model → stronger model for uncertain cases.** Every admitted submission and edit gets the model check before publication.

No routine hired human reviewer is required for the MVP. The founder handles exceptional privacy/legal complaints and unresolved cases. A stronger model can review context and policy; it cannot independently prove whether an allegation happened.

Use the existing AI gateway. Select models by language-quality tests and actual gateway pricing. Gateway access does not necessarily mean free inference.

For illustration, 10,000 reviews with 10% stronger-model escalation can cost around **$12 in model tokens** under the explicit hypothetical rates in the [plan](CEO-DECISION-AND-ARCHITECTURE.md). This is an example, not a supplier quote.

## Can we build it in one week?

**A focused working MVP is a reasonable one-week target with AI-assisted development. It is not a guarantee of comprehensive EU coverage or launch readiness.**

Build search, university/course/instructor pages, university ratings/comparison, login, university-email verification, anonymous reviews, the two-model moderation queue, reporting and a small admin screen. Publish ordered university rankings only once actual review counts justify them. Use Next.js, shadcn, Vercel and Neon. Skip general chat, uploads, subscriptions and elaborate analytics.

Budget roughly **$50–$150/month in early technology costs** as an allowance, subject to usage and provider choices. No salary for a dedicated moderator is assumed; founder time and any legal preparation are additional.

**Decision:** build the small version, recruit real students immediately, and judge whether they contribute and use it. Spend a week testing the opportunity, rather than months preparing for scale we have not earned.
