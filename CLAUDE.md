# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

VitaSense is a supplement-stack safety checker. The data layer + rules engine is the part worth sourcing carefully; the app around it (Next.js 16 App Router, TypeScript, Tailwind v4) was scaffolded with `create-next-app` and is mechanical/safe to iterate on.

- `data/supplements.json` — 20 supplements with `upperLimit` (text), `rda`, `timing`, a `sourceHint` pointing to the relevant NIH Office of Dietary Supplements fact sheet, plus structured `unit` (string | null) and `upperLimitValue` (number | null) fields used for numeric dose checking (see below).
- `data/interactions.json` — 15 pairwise interaction/timing rules, each keyed by a `pair` of supplement ids and a `severity` (`good` | `info` | `note` | `warn`).
- `lib/flagger.js` — pure, deterministic functions that match a user's stack against the two data files. No AI/LLM involved in this logic — it must stay fully explainable and traceable back to a specific data row.
- `app/page.tsx` — client component ("use client") holding all stack state. Renders a picker (all `supplements`, sorted by name, each with a dose-amount input where `unit` is defined, plus +AM/+PM buttons), the AM/PM columns (showing entered dose), a **dose safety flags** panel (over-daily-limit warnings — the core safety feature), a **redundancy flags** panel (duplicate ingredients across combination products, see below), a timing/interaction flags panel, and a reference-limits table showing entered dose vs. upper limit/RDA/timing.

**This app is intentionally stateless — no accounts, no database, no saved history.** State lives only in React and resets on reload, by explicit user decision (visit, check your stack, leave — not a product chasing retention). Don't propose Supabase/auth/persistence unless the user asks; earlier revisions of this file described that as a planned Step 3, which has been dropped.

### Dose safety checking

The original AM/PM picker only tracked *presence* of a supplement, not *how much* — which misses the actual safety case this app exists for (e.g. taking 50 mg/day of zinc against a 40 mg/day upper limit). Stack items are now `{id, period: "AM"|"PM", amount?: number}`:

- `unit`/`upperLimitValue` in `supplements.json` were parsed directly out of the existing `upperLimit` text (no new research/values invented) — set to `null` wherever that text has no single clear numeric threshold (`multivitamin`, `probiotic`, `biotin`, `b12`, `vitk`, `ashwagandha`, `apigenin`, `melatonin`, `creatine`). Items with `unit: null` get no dose input in the UI (there's nothing meaningful to compare); items with a `unit` but `upperLimitValue: null` (e.g. melatonin) still collect a dose for the record but never trigger an over-limit flag.
- `getDoseFlags(stack)` in `lib/flagger.js` **sums `amount` across AM+PM for the same id** before comparing to `upperLimitValue`, since upper limits are daily totals regardless of how a dose is split across the day (e.g. 20 mg AM + 30 mg PM zinc = 50 mg/day, over the 40 mg limit, even though neither single entry looks alarming on its own).
- `fishoil`'s `upperLimitValue: 3` is carried over from an approximate source value (`"~3 g EPA+DHA/day"`) — treated as a hard threshold for the check, but worth a second look per the data-integrity note below.
- `overLimitRisk` (string | null) on each supplement is a brief "why this matters" memo shown alongside an over-limit flag. Populated only where the existing `note` field already substantively described the risk of excess intake (`zinc`, `vite`, `vita`, `folate` — e.g. zinc's copper-depletion risk); left `null` everywhere else as infrastructure for content not yet written, rather than inventing new medical claims. The UI (`app/page.tsx`) shows a "not in our data yet" fallback when it's null — don't remove that fallback or silently backfill the field with unsourced text.

### Redundancy checking

`typicallyContains` (string[] | null) on a supplement lists ingredient ids that product commonly already contains — currently only set on `multivitamin` (`["b12", "biotin", "copper", "zinc"]`, sourced from its own pre-existing `note` field plus two interaction rules that used to encode the same fact). `getRedundancyFlags(stack)` in `lib/flagger.js` fires when both a container (e.g. multivitamin) and one of its `typicallyContains` ingredients are in the stack — order-independent, no dose required. This generalizes to any future "combination"-category product by adding `typicallyContains`, no logic changes needed. The two interaction rules this replaced (`biotin`+`multivitamin`, `b12`+`multivitamin`, both `"info"` severity) were **removed from `data/interactions.json`** to avoid showing the same fact twice across two panels — if you're diffing history and see them missing, that's why.

**npm package name is `vitasense`, not the directory name.** The repo folder is still `VitaCalc` (its original scaffolded name, left as-is rather than renamed on disk) — `package.json`/`package-lock.json` were updated by hand to the app's current name, `vitasense`, independent of the folder.

**This is Next.js 16 (Turbopack), which postdates most training data** — per `AGENTS.md` (generated by the scaffolder), API/convention/file-structure details may differ from what you expect from earlier Next.js versions. Check `node_modules/next/dist/docs/` rather than assuming.

## Commands

- `npm run dev` — start the dev server (Turbopack, http://localhost:3000).
- `npm run build` — production build; also runs the TypeScript check. Run this after any change touching `lib/` or `app/` to catch type errors.
- `npm run start` — run the production build.
- `npm run lint` — ESLint (flat config in `eslint.config.mjs`, extends `eslint-config-next`).
- No test runner is configured yet.

Note: Next.js writes generated route-type declarations into `.next/` and they can go stale if a route file is added then removed — if `npm run build` fails on a phantom `Cannot find module '.../route.js'` type error, `rm -rf .next` and rebuild before assuming a real regression.

## Architecture

- `getFlags(stack)` — takes a stack (`{id, period: "AM"|"PM", amount?}[]`) and returns every `interactions.json` rule where both members of `rule.pair` are present in the stack.
- `getReferenceLimits(stack)` — returns the full `supplements.json` rows for every id present in the stack.
- `getDoseFlags(stack)` — sums `amount` per id across periods and returns a flag (including the `overLimitRisk` memo, if set) for every id whose daily total exceeds its `upperLimitValue`.
- `getRedundancyFlags(stack)` — returns a flag for every (container, ingredient) pair present in the stack where the container's `typicallyContains` lists the ingredient.
- `getSupplement(id)` — single-row lookup by id.

Supplement ids used across both JSON files are lowercase short codes (`zinc`, `vitd`, `fishoil`, etc.) — always cross-reference `supplements.json` for the full id list rather than guessing one.

`getFlags`/`getReferenceLimits` are typed only via JSDoc in `flagger.js` (a plain `.js` file), which TypeScript widens to `object[]` on import — not concrete enough to access properties like `.pair` or `.upperLimit` in `.tsx` consumers. `app/page.tsx` casts the results to local `InteractionFlag`/`SupplementRow` types rather than editing `flagger.js`'s JSDoc; follow the same pattern in new consumers instead of loosening types or touching `flagger.js`.

## Data integrity is the priority

The numeric values in `supplements.json` and `interactions.json` (upper limits, RDAs, ratios) are sourced from NIH ODS fact sheets but are explicitly flagged in README.md as needing manual verification before being trusted in production. The same caution applies to `overLimitRisk` — it's a health claim, not a number, but it's still unverified content until the user checks it against a real source. If asked to add/edit entries in either JSON file:

- Do not invent or adjust an `upperLimit`, `rda`, `overLimitRisk`, or interaction `severity`/ratio value — flag it for the user to verify against the actual NIH ODS fact sheet instead of silently changing it.
- Any diff that touches a numeric value or health claim in these two files should be called out explicitly, not folded quietly into a larger change.

## Intended build-out sequence

Per README.md, the project is meant to be built out in this order (as separate, reviewed steps — not all at once unless asked):

1. ~~Scaffold a Next.js + TypeScript project in place, keeping `data/`/`lib/` as-is, with Tailwind added.~~ Done.
2. ~~Build a UI page to add supplements to an AM/PM list and render flags from `flagger.js`.~~ Done — see `app/page.tsx` above.
3. Deploy to Vercel. **Not started.** No auth, no database — deploying a stateless static/SSR app as-is.

There is no disclaimer/legal copy in the repo yet; README.md notes this (informational-only disclaimer, ToS/liability review) needs to happen before real users touch the app.
