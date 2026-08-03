# Nexora: product and business brief

Written to be handed to someone with no access to the codebase, as context for business,
pricing, positioning or go to market work. Everything here was verified against the
running product and the live database in July 2026, not taken from marketing copy. Where
the product does not yet do what the pricing page implies, that is called out.

---

## 1. What it is, in one paragraph

Nexora is a vertical SaaS product for specialist dental practices whose new patients arrive
by referral from other dentists. It keeps a running record of where every patient came
from, maintains a page per referring office covering who refers, how often and when you
last visited, and wraps outreach around that record: mail, email, review replies and visit
logging. The premise is that specialists lose referral relationships slowly and invisibly,
and that a practice which measures the decline can act on it while it is still cheap to fix.

## 2. Who it is for

The buyer is a specialist practice: orthodontics, oral surgery, endodontics, periodontics.
The original repository name was `ortho-connector-pro` and the package was
`referring-office-intelligence`, which is a fair description of the actual product.

What makes this segment specific:

- Their new patient flow depends on general dentists choosing to refer, not on consumer
  marketing. A handful of relationships drive a large share of revenue.
- The relationship is maintained socially, by visits, lunches, gifts and follow up, usually
  by the doctor or one marketing coordinator.
- The knowledge lives in one person's head. When that person leaves, it leaves.
- A single referring office going quiet is material. Losing one office sending four
  patients a month is a real revenue event, and it typically goes unnoticed for months.

The economics support the price. A single retained referral relationship is worth many
multiples of the subscription, which is why a $149 to $799 per month tool is defensible in
this niche where it would not be for a general dental practice.

## 3. The job it does

**Primary job:** tell me where my patients actually come from, and tell me when that
changes, before it costs me a quarter.

**Secondary job:** hold the relationship history that currently lives in one person's
memory, so it survives staff turnover and can be acted on by someone else.

**Tertiary job:** make the outreach itself less annoying to run. Print the labels, draft
the letter, log the visit, reply to the review.

## 4. What it actually does today

All of this is built and working.

**Attribution and measurement**
- Every new patient is attributed to a source: a referring office, Google, a campaign, or
  walk in. Counts are kept daily and rolled up monthly.
- Twelve months of history per source, so trends are visible rather than anecdotal.
- Offices are scored and tiered automatically as VIP, Warm, Dormant or Cold.

**Referring office records**
- One page per office: contact people, phone, email, address, notes, interaction history.
- Marketing visit logging, including what was discussed and what was left behind.

**Outreach**
- Email campaigns, physical letter campaigns and gift campaigns, each with per recipient
  delivery tracking.
- Mailing label generation with a layout engine and PDF export, including Avery style
  sheet layouts.
- Letters and emails can be drafted automatically per office.

**Reputation**
- Google reviews synced for the practice and for nearby competitors.
- Replies can be drafted and posted back to Google Business Profile through the official
  OAuth integration.
- Competitor watchlist with periodic snapshots.

**Growth**
- Discovery of nearby practices through Google Places, filtered by distance, rating and
  type, with import into the network.
- Map view of the referral network.
- Analytics dashboards and an assistant that produces insights and forecasts.
- A biweekly digest email summarising practice activity.

**Under the hood**
- React and Supabase, 41 Postgres tables with row level security on every one, 29 edge
  functions, Stripe for billing, Resend for email, Google Places and Google Business
  Profile, Mapbox for maps.

## 5. How it makes money

Monthly subscription, taken through Stripe Checkout with a webhook keeping subscription
state in the database.

| Plan | Price | Stated limits |
| --- | --- | --- |
| Solo | $149 / month | 1 user, up to 50 referring offices |
| Group | $399 / month | 10 users, up to 200 referring offices |
| Multi location | $799 / month | Unlimited users, unlimited offices |

The ladder is designed to climb with practice size, which is the right instinct: a
multi location group genuinely gets more value than a solo practice, and the office count
is a reasonable proxy for that value.

## 6. The commercially important problem

**The pricing ladder currently has no teeth. Every tier delivers the same product.**

Two specific findings:

1. **There is no way to add a second user.** The database has the tables for it
   (`clinics`, `user_invitations`, roles, an `accept_invitation` function) but the
   application has no invite screen, no team management and no way to accept an
   invitation. So the headline differentiator of the Group plan (ten accounts) and of the
   Multi location plan (unlimited accounts) cannot be delivered at all today.

2. **The office limits are not enforced anywhere.** `subscription_plans` has `max_offices`
   and `max_users` columns, but nothing in the frontend, the edge functions or the database
   reads them. A Solo customer at $149 can add 500 referring offices.

The commercial consequence: a customer who reads carefully has no reason to pay more than
$149, and a customer who buys the $399 plan for the seats will ask for a refund when they
discover they cannot invite anyone. Revenue per account is effectively capped at the entry
tier, and the two higher tiers carry a refund risk.

This is the single highest value thing to fix, and it is a business fix rather than a
technical one. In rough order of effort against revenue:

- Enforce `max_offices`. Small change, immediately makes the ladder real, creates a natural
  upgrade prompt at the moment of highest intent.
- Build invitations and seats. Larger, but it is what the two upper tiers are actually
  selling, and it also unlocks the buyer who is a practice manager rather than a doctor.
- Until seats exist, consider repricing the tiers on something you can actually deliver,
  such as office count, campaign volume or review automation, rather than on user count.

## 7. Where the defensibility is

**The moat is the accumulated record, not the features.** Any competent team can build
review replies or a mail merge. What is hard to copy is a practice's own twelve month
referral history, because it can only be accumulated by using the product for twelve
months. Switching cost therefore grows every month a customer stays, and it grows fastest
in the first year. This argues for pricing and onboarding that optimise aggressively for
getting to month three, because retention economics improve sharply after that.

**The assistant is the least defensible part.** Drafting review replies and outreach
letters is a commodity capability that will be bundled into practice management software.
It is worth having and it is not worth leading with, which is why the product positioning
should keep it as a supporting feature. It is also honest: it drafts, a human sends.

**The real competitive question is distribution, not product.** The product is more capable
than the market position currently supports. For a solo founder the binding constraint is
reaching specialist practices, where the usual routes are study clubs, dental society
meetings, specialist conferences, and referral from practice management consultants. This
is the area where the brief has the least to say and where outside thinking would help most.

## 8. Honest weaknesses to factor into any plan

- **Seats and limits, as above.** The biggest one.
- **No usage telemetry.** There is no instrumentation showing which features customers
  actually use, so feature decisions and the pricing repackage would both be guesswork
  today.
- **Single founder, no team.** Support promises in the Multi location tier ("someone to
  call") are a personal time commitment, and should be priced or scoped accordingly.
- **Test coverage stops at the pure helpers.** The money paths, meaning patient count
  aggregation, source attribution and the Stripe webhook, are not covered by tests. A
  silent arithmetic error in attribution would undermine the one thing the product claims
  to be authoritative about.
- **A known security issue in the login throttle** was fixed in the repository but had not
  been deployed as of this writing.

## 9. Questions a business advisor should ask

1. How many practices are paying today, and what is the split across the three tiers?
2. What is the current route to a first conversation with a specialist practice, and what
   does it cost?
3. What happens to a customer between signup and their first month of complete data, given
   that the product's value only appears once history accumulates?
4. Is the buyer the doctor or the marketing coordinator, and does that change with practice
   size? This determines whether seats are urgent.
5. Would customers pay for the attribution record alone, without the outreach tooling? That
   answer decides whether this is a measurement product with features attached or a
   marketing suite with reporting attached, and the two are positioned very differently.
