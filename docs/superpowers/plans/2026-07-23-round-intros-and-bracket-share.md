# Knockout Round Intros and Bracket Share Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Music Cup-style knockout round interstitials and a separately downloadable complete knockout progression image while preserving the existing champion poster.

**Architecture:** A pure bracket helper will provide one source of truth for round names and completed match data. A keyed knockout wrapper will own transient interstitial state without changing persisted tournament data, while a separate result-page panel will own the new bracket image lifecycle so the current champion poster stays isolated.

**Tech Stack:** React 18, TypeScript, Canvas 2D, Vitest, Testing Library, Vite, Sites hosting

---

## File map

- Create `src/domain/bracket.ts`: derive round descriptors and completed bracket rows.
- Create `src/components/RoundIntro.tsx`: render and time the full-screen round notice.
- Create `src/components/KnockoutStage.tsx`: compose the duel and current-round notice.
- Create `src/components/BracketSharePanel.tsx`: generate, preview, and download the complete bracket image.
- Modify `src/components/DuelStage.tsx`: display the formal round title.
- Modify `src/components/ChampionScreen.tsx`: mount the independent bracket share panel.
- Modify `src/lib/share.ts`: use shared round labels and draw the complete bracket JPEG.
- Modify `src/App.tsx`: render the keyed knockout wrapper.
- Modify `src/styles.css`: style the interstitial and second image panel.
- Create `tests/bracket.test.ts`: cover 16- and 32-entry round naming and result derivation.
- Create `tests/round-intro.test.tsx`: cover timing and mid-round resume behavior.
- Modify `tests/app.test.tsx`: cover a transition into a new knockout round.
- Modify `tests/share.test.tsx`: cover bracket canvas sizing, drawing, and panel download.

### Task 1: One source of truth for knockout rounds

**Files:**
- Create: `tests/bracket.test.ts`
- Create: `src/domain/bracket.ts`
- Modify: `src/lib/share.ts`

- [ ] **Step 1: Write failing round descriptor tests**

```ts
expect(getRoundDescriptor(32, 0)).toEqual({
  title: '1/16 决赛',
  entrantCount: 32,
  matchCount: 16,
});
expect(getRoundDescriptor(16, 0).title).toBe('1/8 决赛');
expect(getRoundDescriptor(32, 3).title).toBe('半决赛');
expect(getRoundDescriptor(32, 4).title).toBe('决赛');
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npm test -- --run tests/bracket.test.ts`

Expected: FAIL because `src/domain/bracket.ts` does not exist.

- [ ] **Step 3: Implement the descriptor and complete-bracket derivation**

```ts
export function getRoundDescriptor(
  bracketSize: number,
  roundIndex: number,
): RoundDescriptor {
  const entrantCount = bracketSize / 2 ** roundIndex;
  if (
    !Number.isInteger(bracketSize) ||
    bracketSize < 2 ||
    (bracketSize & (bracketSize - 1)) !== 0 ||
    !Number.isInteger(roundIndex) ||
    roundIndex < 0 ||
    !Number.isInteger(entrantCount) ||
    entrantCount < 2
  ) {
    throw new Error('无效的淘汰赛轮次');
  }

  return {
    title:
      entrantCount === 2
        ? '决赛'
        : entrantCount === 4
          ? '半决赛'
          : `1/${entrantCount / 2} 决赛`,
    entrantCount,
    matchCount: entrantCount / 2,
  };
}
```

`deriveBracketRounds(state)` must reject incomplete tournaments, require every match to have a winner, and return every match with its two skins and winner.

- [ ] **Step 4: Reuse the helper in `deriveTournamentResult`**

Replace the private label calculation with:

```ts
return {
  label: getRoundDescriptor(state.config.bracketSize, roundIndex).title,
  opponent,
};
```

- [ ] **Step 5: Run focused tests and confirm GREEN**

Run: `npm test -- --run tests/bracket.test.ts tests/share.test.tsx`

Expected: PASS.

### Task 2: Add the timed round interstitial

**Files:**
- Create: `tests/round-intro.test.tsx`
- Create: `src/components/RoundIntro.tsx`
- Create: `src/components/KnockoutStage.tsx`
- Modify: `src/components/DuelStage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Modify: `tests/app.test.tsx`

- [ ] **Step 1: Write failing timing and transition tests**

```tsx
vi.useFakeTimers();
render(
  <RoundIntro
    descriptor={getRoundDescriptor(32, 1)}
    onComplete={onComplete}
  />,
);
expect(screen.getByRole('status')).toHaveTextContent('1/8 决赛');
vi.advanceTimersByTime(ROUND_INTRO_DURATION_MS);
expect(onComplete).toHaveBeenCalledOnce();
```

Add an app test that starts on the final match of one round, dismisses the current intro, chooses its winner, and then finds the next round title in the new status overlay.

- [ ] **Step 2: Run the focused tests and confirm RED**

Run: `npm test -- --run tests/round-intro.test.tsx tests/app.test.tsx`

Expected: FAIL because the interstitial components and formal duel title do not exist.

- [ ] **Step 3: Implement the timer**

```tsx
export const ROUND_INTRO_DURATION_MS = 1_600;

export function RoundIntro({ descriptor, onComplete }: RoundIntroProps) {
  useEffect(() => {
    const timeoutId = window.setTimeout(onComplete, ROUND_INTRO_DURATION_MS);
    return () => window.clearTimeout(timeoutId);
  }, [onComplete]);

  return (
    <div className="round-intro" role="status" aria-live="assertive">
      <span>SKIN CUP</span>
      <strong>{descriptor.title}</strong>
      <p>
        {descriptor.entrantCount} 款皮肤 · {descriptor.matchCount} 场对决 · 选出本轮胜者
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Compose the keyed knockout stage**

`KnockoutStage` initializes its notice only when `matchNumber === 1`. In `App.tsx`, key it with:

```tsx
<KnockoutStage
  key={`${state.seed}:${state.roundIndex}`}
  bracketSize={state.config.bracketSize}
  roundIndex={state.roundIndex}
  match={currentMatch}
  matchNumber={state.matchIndex + 1}
  matchCount={currentRound.length}
  onChoose={(skinId) => commit(chooseWinner(state, skinId))}
/>
```

This remounts the wrapper for a genuinely new round but suppresses the notice when a saved tournament resumes mid-round.

- [ ] **Step 5: Add full-screen responsive styles**

Use a fixed overlay above the sticky header, Valorant red/cyan accents, a short entrance/exit animation, and a `prefers-reduced-motion` override that disables the transforms.

- [ ] **Step 6: Run focused tests and confirm GREEN**

Run: `npm test -- --run tests/round-intro.test.tsx tests/app.test.tsx`

Expected: PASS.

### Task 3: Generate the complete knockout progression JPEG

**Files:**
- Modify: `tests/share.test.tsx`
- Modify: `src/lib/share.ts`

- [ ] **Step 1: Write the failing Canvas tests**

```ts
const sheriffBlob = await buildBracketImage(completedSheriffState());
expect(sheriffBlob.type).toBe('image/jpeg');
expect(context.fillText).toHaveBeenCalledWith(
  '1/8 决赛',
  expect.any(Number),
  expect.any(Number),
);
expect(context.fillText).toHaveBeenCalledWith(
  expect.stringContaining('胜者'),
  expect.any(Number),
  expect.any(Number),
);
```

Also build a completed Vandal tournament and assert its exported canvas is taller than the Sheriff canvas because it contains 31 instead of 15 knockout matches.

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npm test -- --run tests/share.test.tsx`

Expected: FAIL because `buildBracketImage` is not exported.

- [ ] **Step 3: Implement the dynamic portrait canvas**

Use:

```ts
export const BRACKET_IMAGE_WIDTH = 1440;
const BRACKET_HEADER_HEIGHT = 300;
const BRACKET_ROUND_HEADER_HEIGHT = 88;
const BRACKET_MATCH_HEIGHT = 72;
const BRACKET_FOOTER_HEIGHT = 120;
```

Calculate height from every round and match, draw a branded header, then draw each match as one readable row containing its number, both competitors, and `胜者 · <name>`. Do not load remote images.

- [ ] **Step 4: Run the focused test and confirm GREEN**

Run: `npm test -- --run tests/share.test.tsx`

Expected: PASS.

### Task 4: Add an independent bracket image panel

**Files:**
- Create: `src/components/BracketSharePanel.tsx`
- Modify: `src/components/ChampionScreen.tsx`
- Modify: `src/styles.css`
- Modify: `tests/share.test.tsx`

- [ ] **Step 1: Write the failing result-page test**

```tsx
expect(
  screen.getByRole('heading', { name: '下载完整淘汰赛晋级图' }),
).toBeInTheDocument();
fireEvent.click(screen.getByRole('button', { name: '生成晋级图' }));
await waitFor(() =>
  expect(screen.getByRole('img', { name: '正义完整晋级图预览' })).toBeInTheDocument(),
);
fireEvent.click(screen.getByRole('button', { name: '下载晋级图' }));
expect(anchorClick).toHaveBeenCalled();
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npm test -- --run tests/share.test.tsx`

Expected: FAIL because the panel is absent.

- [ ] **Step 3: Implement isolated generation state**

The panel must own a separate `Blob`, preview URL, generation status, and filename:

```ts
const filename = `Skin-Cup-${state.config.label}-完整晋级图.jpg`;
```

Generating replaces and revokes an old preview URL. Unmounting revokes the current URL. Downloading generates on demand if needed, then calls the existing `downloadShareImage`.

- [ ] **Step 4: Mount and style the panel**

Mount it after the existing champion share panel:

```tsx
<BracketSharePanel key={resultKey} state={state} />
```

Use a contained, scroll-safe preview with a larger maximum height than the champion poster. Keep the existing champion panel controls and labels unchanged.

- [ ] **Step 5: Run focused tests and confirm GREEN**

Run: `npm test -- --run tests/share.test.tsx`

Expected: PASS.

### Task 5: Verify, publish, and integrate

**Files:**
- Verify all modified files.
- Update the Sites deployment from the exact pushed source commit.

- [ ] **Step 1: Run all automated verification**

Run:

```powershell
npm test -- --run
npm run typecheck
npm run build
git diff --check
```

Expected: all tests pass, typecheck/build exit 0, and no whitespace errors.

- [ ] **Step 2: Commit the implementation**

Stage only the feature files and commit with:

```powershell
git commit -m "feat: add knockout round intros and bracket share"
```

- [ ] **Step 3: Push the feature branch**

Push `codex/round-intros-bracket-share` to the existing private GitHub repository.

- [ ] **Step 4: Merge locally and push `master`**

Switch to `master`, fast-forward merge the verified feature branch, rerun the full verification on the merged commit, and push `master`.

- [ ] **Step 5: Publish the exact merged commit with Sites**

Push the exact merged source state to the existing Sites source repository, package the successful build, save one new version, deploy it privately, and poll until the deployment reports success.

- [ ] **Step 6: Verify the live site**

Open the deployed URL and confirm that it loads the new build. Report the production URL and the two user-visible changes.
