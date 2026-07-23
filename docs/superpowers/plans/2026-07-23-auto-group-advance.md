# Group Stage Auto-Advance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove every group-stage confirmation button and submit the group immediately when the second distinct skin is selected.

**Architecture:** Keep tournament transitions in the existing domain functions. Make `GroupStage` presentation-only and let `App` pass the first selection through `toggleGroupPick`, while passing the completed two-ID selection directly to `confirmGroupPick` so undo restores the state before the second click.

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library, Vite.

---

### Task 1: Specify the automatic group interaction

**Files:**
- Modify: `tests/app.test.tsx`
- Modify: `tests/storage.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/GroupStage.tsx`
- Modify: `src/lib/storage.ts`

- [ ] **Step 1: Write failing UI tests**

Replace the existing button-driven group test with assertions that the first click stays on the current group, no `确认晋级` button exists, and the second click advances:

```tsx
it('automatically confirms a group after the second distinct pick', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /正义.*24/ }));

  const firstState = loadTournament()!;
  const [first, second] = firstState.groups[0];
  fireEvent.click(screen.getByRole('button', { name: `选择 ${first.name}` }));

  expect(screen.getByText('第 1 / 6 组')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '确认晋级' })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: `选择 ${second.name}` }));

  expect(screen.getByText('第 2 / 6 组')).toBeInTheDocument();
  expect(loadTournament()?.groupIndex).toBe(1);
});
```

Update the final-group tests to expect the second skin click itself to enter revival or knockout. Add an undo assertion that returning from the second group restores group 1 with the first skin still selected.

Add a storage regression test that constructs the first selected state, confirms with two explicit IDs, saves it, and expects `loadTournament()` to return the same state.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
npm test -- --run tests/app.test.tsx
```

Expected: failures because `确认晋级` is still rendered and the second selection does not advance.

- [ ] **Step 3: Remove the confirmation control**

Change `GroupStageProps` to:

```tsx
interface GroupStageProps {
  readonly state: TournamentState;
  readonly onToggle: (skinId: string) => void;
}
```

Remove `onConfirm` and the confirmation `<button>`. Keep `selectionFull` only as a guard for an older saved state that may already contain two picks: selected cards remain toggleable, while a third card cannot be added. Update the helper copy:

```tsx
<p>选择 {state.config.picksPerGroup} 款，选满后自动晋级</p>
```

- [ ] **Step 4: Submit the second selection in `App`**

Add a scoped handler before rendering:

```tsx
function selectGroupSkin(skinId: string) {
  if (state.phase !== 'groups') return;

  if (state.groupPicks.includes(skinId)) {
    commit(toggleGroupPick(state, skinId));
    return;
  }

  const selectedIds = [...state.groupPicks, skinId];
  if (selectedIds.length > state.config.picksPerGroup) {
    return;
  }
  if (selectedIds.length === state.config.picksPerGroup) {
    commit(confirmGroupPick(state, selectedIds));
    return;
  }

  commit(toggleGroupPick(state, skinId));
}
```

Pass `onToggle={selectGroupSkin}` to `GroupStage` and remove `onConfirm`.

- [ ] **Step 5: Accept a partial automatic-submit snapshot**

In `advanceToward`, derive the completed group's selected IDs from the target qualifiers whenever the persisted snapshot contains fewer than `picksPerGroup`. Require every persisted partial pick to belong to that derived set before replaying `confirmGroupPick`.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run:

```powershell
npm test -- --run tests/app.test.tsx tests/tournament.test.ts tests/storage.test.ts
```

Expected: all selected test files pass.

### Task 2: Verify and release

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run complete verification**

```powershell
npm test -- --run
npm run typecheck
npm run build
git diff --check
```

Expected: 0 failing tests, successful TypeScript compilation and Vite build, and no whitespace errors.

- [ ] **Step 2: Perform browser QA**

Open the local production build and verify:

- first skin stays on group 1;
- second skin opens group 2;
- no `确认晋级` control is present;
- undo returns to group 1 with the first skin selected.

- [ ] **Step 3: Commit and release**

```powershell
git add docs/superpowers/specs/2026-07-23-auto-group-advance-design.md docs/superpowers/plans/2026-07-23-auto-group-advance.md tests/app.test.tsx tests/storage.test.ts src/App.tsx src/components/GroupStage.tsx src/lib/storage.ts
git commit -m "feat: auto-advance completed groups"
git push -u origin codex/auto-group-advance
```

Deploy the verified `dist/` contents to `/var/www/valorant-cup/releases/<commit>`, atomically switch `/var/www/valorant-cup/current`, verify Nginx and the public browser result, then fast-forward local `master` and push it.
