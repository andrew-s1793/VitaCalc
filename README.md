# Supplement Stack Flagger — Starter

This is the data layer + rules engine: the one part worth sourcing carefully
before handing anything to an AI coding agent. Everything else (schema wiring,
UI, deploy) is mechanical and safe to delegate to Claude Code.

## What's here

- `data/supplements.json` — 20 common supplements with upper limits, RDAs, and
  general timing notes, referenced against NIH Office of Dietary Supplements
  fact sheets (see `sourceHint` field per entry — verify against the actual
  fact sheet before treating any single value as final).
- `data/interactions.json` — 15 pairwise interaction/timing rules.
- `lib/flagger.js` — pure functions (`getFlags`, `getReferenceLimits`) that
  match a user's stack against the data files. No AI, no guessing — fully
  deterministic and testable.

## Before you touch Claude Code: expand and verify the data

You already have 20 supplements and 15 rules — enough to build against, but
thin for a real product. Before wiring up the app:

1. Add your own full stack (all 11 items) into `supplements.json` if any are
   missing.
2. Spend 1-2 hours cross-checking each `upperLimit` and `note` field against
   the actual NIH ODS fact sheet for that nutrient (search "[nutrient] NIH
   ODS fact sheet"). This is the one step I'd genuinely resist automating —
   it's the credibility of the whole product.
3. Add a few more interaction rules relevant to your own stack as you go.

## Next steps with Claude Code

Once the data feels solid, open this folder in Claude Code and work in this
order — one prompt per step, reviewing the output before moving to the next:

**Step 1 — scaffold the app**
> "Set up a Next.js + TypeScript project in this folder. Keep the existing
> data/ and lib/ folders as-is. Add Tailwind for styling."

**Step 2 — wire up the UI**
> "Build a page that lets a user add supplements from data/supplements.json
> to an AM or PM list, and displays flags from lib/flagger.js below. Use the
> visual style from [paste description or screenshot of the prototype we
> built earlier]."

**Step 3 — deploy**
> "Set up deployment to Vercel."

This app is intentionally stateless by design: visit, check your stack,
close the tab — no accounts, no saved history, no database. That's a
deliberate choice, not a gap to fill in later.

Review each step's diff before moving to the next — especially anything that
touches `data/` or the matching logic in `lib/flagger.js`. If Claude Code
ever proposes changing a numeric value in `supplements.json` or
`interactions.json`, treat that as a flag to verify manually, not to accept
on trust.

## Legal groundwork (do this before real users touch it)

- Add a clear disclaimer: informational only, not medical advice.
- A cheap one-off consult with a lawyer on ToS/liability framing is worth it
  before sharing beyond yourself.
