# Podium Share Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the champion poster's path summary with image cards for champion, runner-up, third place, and fourth place.

**Architecture:** Extend the existing derived tournament result with deterministic semifinal-loser rankings, leaving tournament state and persistence untouched. Reuse the existing canvas image loader and fitting helper to draw a compact two-by-two ranking grid inside the current 1080 × 1350 poster.

**Tech Stack:** React, TypeScript, Canvas 2D, Vitest, Testing Library, Vite

---

### Task 1: Derive third and fourth place

**Files:**
- Modify: `src/lib/share.ts`
- Test: `tests/share.test.tsx`

- [ ] **Step 1: Write the failing ranking test**

Extend the existing `deriveTournamentResult` test so it finds the two semifinal matches, identifies the loser from the semifinal won by the champion and the loser from the semifinal won by the runner-up, then asserts:

```ts
expect(result.thirdPlace).toBe(expectedThirdPlace);
expect(result.fourthPlace).toBe(expectedFourthPlace);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npm test -- --run tests/share.test.tsx -t "derives the champion"
```

Expected: failure because `thirdPlace` and `fourthPlace` do not exist.

- [ ] **Step 3: Add the minimal ranking derivation**

Add these fields to `TournamentResult`:

```ts
readonly thirdPlace: Skin;
readonly fourthPlace: Skin;
```

Find each completed semifinal match by its winner. The other skin in the champion-won semifinal is `thirdPlace`; the other skin in the runner-up-won semifinal is `fourthPlace`. Throw the existing incomplete-four error when either cannot be derived.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
npm test -- --run tests/share.test.tsx -t "derives the champion"
```

Expected: one passing test.

### Task 2: Draw the four image ranking cards

**Files:**
- Modify: `src/lib/share.ts`
- Test: `tests/share.test.tsx`

- [ ] **Step 1: Write the failing poster test**

Add assertions to the champion JPEG test that:

```ts
expect(context.fillText).not.toHaveBeenCalledWith(
  '夺冠之路',
  expect.any(Number),
  expect.any(Number),
);
for (const label of ['冠军', '亚军', '季军', '殿军']) {
  expect(context.fillText).toHaveBeenCalledWith(
    label,
    expect.any(Number),
    expect.any(Number),
  );
}
expect(loadedImages.map(({ src }) => src)).toEqual(
  expect.arrayContaining(
    [
      result.champion,
      result.runnerUp,
      result.thirdPlace,
      result.fourthPlace,
    ]
      .map((skin) => skin.fullRender ?? skin.image)
      .filter((url): url is string => Boolean(url)),
  ),
);
```

- [ ] **Step 2: Run the focused poster test and verify RED**

Run:

```bash
npm test -- --run tests/share.test.tsx -t "creates a JPEG"
```

Expected: failure because the poster still draws “夺冠之路” and loads only the champion image.

- [ ] **Step 3: Implement the two-by-two card grid**

In `buildShareImage`, load all four ranked images with `Promise.all`. Keep the champion hero image, move the tier line upward, and replace the path summary with a `drawRankingCard` helper. Each card draws a dark panel, a compact fitted image or local placeholder, rank label, and truncated skin name.

- [ ] **Step 4: Run the focused share tests and verify GREEN**

Run:

```bash
npm test -- --run tests/share.test.tsx
```

Expected: all share tests pass.

### Task 3: Verify, review, and release

**Files:**
- Verify: `src/lib/share.ts`
- Verify: `tests/share.test.tsx`
- Verify: generated browser preview

- [ ] **Step 1: Run complete automated verification**

Run:

```bash
npm test -- --run
npm run build
git diff --check
```

Expected: all tests pass, TypeScript and Vite build succeed, and no whitespace errors are reported.

- [ ] **Step 2: Visually inspect a real generated champion poster**

Run the production preview, complete or restore a tournament, and inspect the automatically generated poster. Confirm all four cards fit, images are visible, names do not overlap, and the original path text is absent.

- [ ] **Step 3: Commit, push, deploy, and verify isolation**

Commit the feature branch, push it, deploy the exact verified `dist` into a new `/var/www/valorant-cup/releases/<commit>` directory, atomically switch `/var/www/valorant-cup/current`, confirm public HTTP 200, and verify the existing TURNS PID and port 8080 remain unchanged.

- [ ] **Step 4: Fast-forward master and reverify**

Fast-forward local `master`, rerun the complete test/build commands, push `master`, and confirm the production symlink still points at the expected release.
