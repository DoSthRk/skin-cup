# Curated Melee Weapon Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the user-curated 118-skin melee tournament, skip revival for melee, and deploy the production build only to the isolated self-hosted server.

**Architecture:** Reuse the existing catalog and tournament engine. Import the committed UUID selection snapshot into the catalog policy, allow a zero-wildcard tournament to transition directly from groups into a seeded 64-entry bracket, and reuse the current UI/share components. Remove the Sites-only packaging layer so Vite `dist/` is deployed directly into a new server release.

**Tech Stack:** React 18, TypeScript 5, Vite, Vitest, Testing Library, Node.js, Valorant-API, Nginx

---

### Task 1: Add the curated melee catalog policy

**Files:**
- Modify: `scripts/skin-policy.mjs`
- Modify: `src/domain/types.ts`
- Modify: `tests/catalog.test.ts`
- Modify: `tests/fixtures/catalog-source.ts`

- [ ] Add failing catalog tests that require:
  - `WeaponId`/configuration support for `melee`.
  - 118 expected entrants.
  - 22 four-skin groups and 10 three-skin groups.
  - two picks per group, zero wildcards, and a 64-entry bracket.
  - an approved melee UUID to pass without API effect tags.
  - an unapproved melee UUID to be rejected even when it has API effect tags.

- [ ] Run:

```powershell
npm test -- --run tests/catalog.test.ts
```

Expected: failures because `melee` and its allowlist policy are absent.

- [ ] Import `selected_ids` from `docs/superpowers/specs/2026-07-23-melee-selection.json` with a JSON import attribute, expose it as a read-only `Set`, register `近战武器: 'melee'`, and add this configuration:

```js
melee: {
  label: '近战武器',
  expectedCount: 118,
  groupSizes: Array.from(
    { length: 32 },
    (_, index) => (index < 30 && index % 3 === 2 ? 3 : 4),
  ),
  picksPerGroup: 2,
  wildcardSlots: 0,
  bracketSize: 64,
}
```

- [ ] Keep gun filtering unchanged. For melee, require the approved UUID, tier rank at least 2, and non-GO name; do not require an API effect tag.

- [ ] Add `melee`/`近战武器` to the TypeScript unions and rerun the focused test until green.

### Task 2: Support direct group-to-knockout transition

**Files:**
- Modify: `src/domain/tournament.ts`
- Modify: `tests/tournament.test.ts`

- [ ] Add failing tests for a 118-entry melee tournament:
  - group sizes contain exactly 22 fours and 10 threes;
  - all 118 entrants occur once;
  - the final group confirmation goes directly to `knockout`;
  - the first bracket round has 32 matches and 64 unique entrants;
  - progress is strictly monotonic and reaches 1 without a revival action.

- [ ] Run:

```powershell
npm test -- --run tests/tournament.test.ts
```

Expected: failures because zero wildcards are invalid and the final group always enters revival.

- [ ] Change configuration validation so `wildcardSlots` may be zero while all other counts remain positive integers.

- [ ] Extract the existing seeded bracket creation into a helper used by both paths. On the final group:
  - if `wildcardSlots > 0`, keep the current `revival` transition;
  - if `wildcardSlots === 0`, require exactly `bracketSize` qualifiers and enter `knockout`.

- [ ] Make `progress()` include the revival action only when `wildcardSlots > 0`, then rerun the focused test until green.

### Task 3: Generate the 118-skin static catalog

**Files:**
- Modify: `src/data/generated-skin-catalog.ts`
- Modify: `tests/sync-skin-catalog.test.ts`

- [ ] Add a failing assertion that the committed selection snapshot contains 118 unique UUIDs and the generated catalog exposes 118 melee records.

- [ ] Run:

```powershell
npm test -- --run tests/sync-skin-catalog.test.ts tests/catalog.test.ts
```

Expected: failure before catalog regeneration.

- [ ] Run the live, atomic sync:

```powershell
npm run sync:skins
```

Expected:

```text
狂徒: 42
幻影: 36
正义: 24
近战武器: 118
```

- [ ] Rerun the focused sync/catalog tests until green.

### Task 4: Add the homepage melee entry

**Files:**
- Create: `public/weapon-cards/melee-prime-karambit.png`
- Modify: `src/data/home-brand.ts`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Modify: `tests/app.test.tsx`

- [ ] Add failing UI tests for a fourth enabled button named `近战武器` with `118`, the `紫金爪刀` representative image, 32 groups, and direct transition from the final melee group into `1/32 决赛`.

- [ ] Run:

```powershell
npm test -- --run tests/app.test.tsx
```

Expected: failures because the fourth entry and melee catalog are absent.

- [ ] Download the verified representative render:

```text
https://media.valorant-api.com/weaponskinchromas/245202ea-46e4-72c3-0864-f08a8207c0c3/fullrender.png
```

- [ ] Add `melee` to `weaponCardArtwork` and `weaponOrder`. Change the homepage grid to two columns from 52rem and four columns from 72rem; keep mobile single-column behavior.

- [ ] Rerun the focused app test until green.

### Task 5: Remove the unused Sites publication layer

**Files:**
- Delete: `.openai/hosting.json`
- Delete: `scripts/prepare-sites-build.mjs`
- Modify: `package.json`
- Modify: `README.md`

- [ ] Change `build` to:

```json
"build": "npm run typecheck && vite build"
```

- [ ] Document four weapon counts and server-only `dist/` publication. Remove references that imply Sites is still maintained.

- [ ] Run:

```powershell
npm run build
```

Expected: successful typecheck and Vite build with `dist/index.html`.

### Task 6: Verify, push, and deploy the isolated release

**Files:**
- Verify all changed files.

- [ ] Run:

```powershell
npm test -- --run
npm run typecheck
npm run build
```

Expected: all tests pass, typecheck exits 0, build exits 0.

- [ ] Commit and push `codex/melee-module`.

- [ ] Record the pre-deploy TURNS PID and HTTP status. Copy the exact successful `dist/` contents to:

```text
/var/www/valorant-cup/releases/<commit>
```

- [ ] Verify the new release contains `index.html` and hashed assets, atomically switch `/var/www/valorant-cup/current`, and run `nginx -t` without modifying the Nginx configuration.

- [ ] Verify:
  - `https://valorant-cup.dosthrk.com` returns HTTP 200;
  - the live HTML references the new hashed asset;
  - the homepage shows `近战武器` and `118 款特效皮肤`;
  - the TURNS PID is unchanged and `http://127.0.0.1:8080/` still returns HTTP 200.

- [ ] Merge the deployed branch locally while preserving pre-existing Kimi changes in a recoverable stash.
