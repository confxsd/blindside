# Mira

## What It Is

A trust-based introduction network. Not a dating app — a guided process for finding the right person.

A friend vouches for you, Mira learns who you are, and every week you get three carefully chosen introductions. Character first, photo second. The system gets better the more you use it.

## Core Positioning

**"Seni tanımadan sana birini bulamayız."**

Mira is not a catalogue of strangers. It's a system that actively understands you and guides you toward the right person. Other apps leave you alone with infinite options. Mira walks with you through a deliberate process — limited choices, genuine recommendations, and a system that sharpens over time.

## The Pivot

Blindside (couples game) → Mira (trust-based introductions). Same domain (blindside.to), new product. The insight: the most valuable thing isn't games between existing couples — it's how people meet in the first place.

## Three Loops

1. **Supply**: Friend writes vouch → user gets invited → user completes profile → enters match pool
2. **Matching**: System picks 3 people/week → user ranks/skips → system learns → next week, better 3
3. **Conversion**: Both say yes → chat unlocks → (optional) Blindside game → meet IRL

Every decision should strengthen one of these loops.

## Key Differentiators

- **Vouch-first**: Your profile is written by a friend, not yourself. This IS the product.
- **3 per week**: Scarcity forces quality. No infinite scroll, no dopamine loop.
- **Learning system**: Every like/pass/skip teaches Mira what you actually want (not what you say you want). Week 6 is the typical alignment point.
- **Character first, photo second**: Photos only unlock after mutual interest.
- **Guided, not autonomous**: Mira positions itself as a companion in the process, not a tool you use alone.

## Target

Istanbul first. One neighborhood at a time (Kadıköy, Beşiktaş, Cihangir, etc.). Dense network > wide network.

Age: 26-34. People who've tried dating apps and are tired of the cycle.

## Two User Types

1. **Seeker**: "Birini arıyorum" — joins, gets matched
2. **Introducer**: "Bir arkadaşımı tanıştırmak istiyorum" — writes a vouch, invites a friend

The introducer flow is the growth engine. Friends invite friends.

## Landing Page Strategy

- No waitlist language — feels like an active product with traction
- Social proof: stats bar (2,400+ users, 72% chat conversion, etc.)
- Testimonials from three user archetypes (seeker, introducer, returning user)
- Hero image: two friends at a café, one showing the other something on her phone (the vouch moment)
- CTAs: "Seni tanıyalım" (primary) / "Bir arkadaşım için geldim" (→ invite.html)
- Blue accent used sparingly on step numbers, path arrows, underline highlights

## invite.html

Two-step form for the introducer:
1. Your info + friend's name + how you know them
2. The vouch (describe who they are) + friend's contact

Trust badges below: info is private, friend decides, we notify on match.

## Matching Algorithm (Planned)

**Phase 1 (manual)**: Founders pick matches by hand. Learn what "good" looks like.

**Phase 2 (rule-based)**:
- Value overlap (jaccard similarity)
- Lifestyle compatibility
- Vouch quality score
- Learned preference match (after week 2)

**Phase 3 (collaborative filtering)**: At 500+ users with signal data.

## Data Model (Core)

- **User**: status (invited → onboarding → active → paused → churned)
- **Vouch**: written by a friend, the primary "profile"
- **Profile**: user's own data (values, lifestyle, photos — revealed later)
- **Weekly Set**: 3 candidates per user per week, with actions (liked/passed/expired)
- **Match**: mutual yes, photo reveal gate
- **Signal**: implicit learning data (likes, passes, time spent, reopens)

## Architecture (Planned)

One DB (D1/SQLite now, Postgres later), one API, one weekly batch matching cron, one blob store (R2 for photos). No microservices.

## Key Metrics

| Metric | Target |
|--------|--------|
| Vouch completion rate | >60% |
| Weekly engagement (come back for 3) | >70% |
| Like rate | 30-50% |
| Mutual match rate | >15% |
| Chat initiation rate | >60% |
| Week 4 retention | >40% |

**North star**: Week 4 retention. If users come back after 4 weeks, the learning loop works.

## Risks

1. **Cold start**: Not enough users for good matches → launch in one neighborhood, manual match first 200 users
2. **Bad vouches**: Friends write lazy intros → vouch templates, allow multiple vouches
3. **Gender imbalance**: The "introduce a friend" loop naturally balances — people invite their own gender
4. **Overengineering**: Build simple version, manual match first, add intelligence later

## Tech Stack

- Frontend: Vanilla JS/HTML/CSS on Cloudflare Pages
- Backend: Cloudflare Workers + D1
- External API: api.rome.markets
- No build step, no framework

## Brand

- Font: Inter
- Colors: Monochrome (#0A0A0A / #FFFFFF) with blue accent (#2563EB) used sparingly
- Tone: Warm, direct, honest. "Biz" language. We're with you, not selling to you.
- Turkish-first. Istanbul-first.
