# Compact Mobile Revival List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the mobile revival candidates as scrollable compact horizontal rows with an always-available confirmation action.

**Architecture:** Add revival-specific class hooks without changing selection behavior. Reuse the existing group-stage mobile card rules by widening their scoped selectors to group and revival grids, then add revival-only bottom spacing and a fixed mobile confirmation button.

**Tech Stack:** React 18, TypeScript 5, CSS Grid, Vitest, Testing Library, Vite

---

### Task 1: Add revival layout hooks with TDD

**Files:**
- Modify: `tests/app.test.tsx:158-169`
- Modify: `src/components/RevivalStage.tsx:26-47`

- [ ] Add these assertions after entering revival:

```tsx
const revivalStage = screen.getByRole('region', { name: '复活赛' });
expect(revivalStage).toHaveClass('stage--revival');
expect(revivalStage.querySelector('.skin-grid')).toHaveClass('skin-grid--revival');
```

- [ ] Run `npm test -- --run tests/app.test.tsx` and confirm the test fails because the classes are absent.

- [ ] Change the revival section and grid to:

```tsx
<section className="stage stage--revival" aria-labelledby="revival-heading">
```

```tsx
<div className="skin-grid skin-grid--revival">
```

- [ ] Rerun `npm test -- --run tests/app.test.tsx` and require all app tests to pass.

### Task 2: Reuse the compact mobile layout

**Files:**
- Modify: `src/styles.css:993-1072`

- [ ] For every existing `.stage--group` mobile heading selector, add the corresponding `.stage--revival` selector.

- [ ] For every existing `.skin-grid--group` compact-card selector, add the corresponding `.skin-grid--revival` selector. Keep the established `6.25rem` thumbnail column, `4rem` image height, `5.75rem` minimum row height, text clamping, and compact effect chips.

- [ ] Add these revival-only mobile rules:

```css
  .stage--revival {
    padding-bottom: 5.5rem;
  }

  .stage--revival .primary-action {
    position: fixed;
    z-index: 3;
    right: max(1rem, env(safe-area-inset-right));
    bottom: max(0.75rem, env(safe-area-inset-bottom));
    left: max(1rem, env(safe-area-inset-left));
    width: auto;
    min-width: 0;
  }
```

- [ ] Run `git diff --check` and `npm test -- --run tests/app.test.tsx`.

### Task 3: Verify and publish

**Files:**
- Verify all changed source, test, spec, and plan files.

- [ ] Run:

```powershell
npm test -- --run
npm run build
git diff --check
```

Expected: 117 tests pass and Vite builds `dist/`.

- [ ] In a `390 × 844` browser viewport, enter revival and verify compact multi-row scrolling, approximately `95px` rows, no horizontal overflow, visible fixed confirmation button, selection highlighting, and no overlap with the final row.

- [ ] At desktop width, confirm revival still uses the original large-card grid.

- [ ] Commit as `feat: compact mobile revival choices`, push `codex/mobile-revival-list`, derive the release name with `git rev-parse --short HEAD`, deploy the exact build to that explicit directory under `/var/www/valorant-cup/releases/`, atomically switch `current`, and verify the site plus unchanged TURNS PID/port 8080.

- [ ] Fast-forward local `master`, rerun tests/build, push `master`, and preserve unrelated worktrees and `stash@{0}`.
