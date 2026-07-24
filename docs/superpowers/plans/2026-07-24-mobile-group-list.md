# Compact Mobile Group List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every three- or four-skin group easy to compare on a phone by rendering the mobile group stage as compact horizontal thumbnail rows while preserving all tournament behavior and non-group layouts.

**Architecture:** Add group-specific class hooks to `GroupStage`, then scope every compact rule to those hooks inside the existing `max-width: 38rem` media query. Keep `SkinCard` markup, selection state, accessibility attributes, automatic advancement, storage, and tournament state untouched. Verify the CSS visually at real mobile widths because jsdom cannot validate rendered geometry.

**Tech Stack:** React 18, TypeScript 5, CSS Grid, Vitest, Testing Library, Vite, in-app browser, Nginx static releases

---

### Task 1: Protect the group-only scope with a failing UI test

**Files:**
- Modify: `tests/app.test.tsx:106-118`
- Modify: `src/components/GroupStage.tsx:19-36`

- [ ] **Step 1: Add structural assertions to the existing fresh-tournament test**

After the assertions for the group heading and group counter, add:

```tsx
const groupStage = screen.getByRole('region', { name: '小组赛' });
expect(groupStage).toHaveClass('stage--group');
expect(groupStage.querySelector('.skin-grid')).toHaveClass('skin-grid--group');
```

These hooks prove that the responsive rules can be limited to group-stage cards rather than changing revival and knockout cards.

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```powershell
npm test -- --run tests/app.test.tsx
```

Expected: the fresh-tournament test fails because `stage--group` and `skin-grid--group` do not exist yet. No other app test should fail.

- [ ] **Step 3: Add the group-specific class hooks**

Change `GroupStage` to render:

```tsx
<section className="stage stage--group" aria-labelledby="group-heading">
```

and:

```tsx
<div className="skin-grid skin-grid--group">
```

Do not change the `SkinCard` props, selection callback, headings, or automatic advancement text.

- [ ] **Step 4: Rerun the focused test and confirm GREEN**

Run:

```powershell
npm test -- --run tests/app.test.tsx
```

Expected: all tests in `tests/app.test.tsx` pass, including the existing “automatically confirms a group after the second distinct pick” regression.

### Task 2: Implement the compact horizontal mobile rows

**Files:**
- Modify: `src/styles.css:984-992`

- [ ] **Step 1: Add group-only mobile layout rules**

Inside the existing `@media (max-width: 38rem)` block, retain the top-bar rules and add:

```css
  .stage--group {
    gap: 0.75rem;
  }

  .stage--group .stage__heading {
    gap: 0.2rem;
    padding: 0.25rem 0;
  }

  .stage--group .stage__heading h1 {
    font-size: clamp(1.75rem, 8vw, 2.2rem);
    line-height: 1;
  }

  .stage--group .stage__heading p {
    font-size: 0.78rem;
    line-height: 1.25;
  }

  .skin-grid--group {
    grid-template-columns: minmax(0, 1fr);
    gap: 0.5rem;
  }

  .skin-grid--group .skin-card {
    grid-template-columns: 6.25rem minmax(0, 1fr);
    grid-template-rows: auto auto 1fr;
    min-height: 5.75rem;
    column-gap: 0.6rem;
    row-gap: 0.2rem;
    padding: 0.45rem 0.5rem;
  }

  .skin-grid--group .skin-card__visual {
    grid-row: 1 / -1;
    grid-column: 1;
    min-height: 4rem;
    height: 4rem;
    align-self: center;
  }

  .skin-grid--group .skin-card img {
    height: 4rem;
  }

  .skin-grid--group .skin-card__placeholder {
    min-height: 4rem;
  }

  .skin-grid--group .skin-card > strong,
  .skin-grid--group .skin-card__tier,
  .skin-grid--group .skin-card__effects {
    grid-column: 2;
    min-width: 0;
  }

  .skin-grid--group .skin-card > strong {
    display: -webkit-box;
    overflow: hidden;
    font-size: 0.82rem;
    line-height: 1.15;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  .skin-grid--group .skin-card__tier {
    font-size: 0.68rem;
    line-height: 1.1;
  }

  .skin-grid--group .skin-card__effects {
    align-content: start;
    gap: 0.18rem;
  }

  .skin-grid--group .skin-card__effects span {
    padding: 0.1rem 0.3rem;
    font-size: 0.6rem;
    line-height: 1.1;
  }
```

The card remains one large native button. The existing cyan selected border, `aria-pressed`, placeholder, image fitting, hover/focus rules, and 44-pixel base touch target remain active.

- [ ] **Step 2: Inspect the diff for accidental global changes**

Run:

```powershell
git diff -- src/components/GroupStage.tsx src/styles.css tests/app.test.tsx
git diff --check
```

Confirm every new selector begins with `.stage--group` or `.skin-grid--group`, except the two class-name additions and their test assertions.

- [ ] **Step 3: Run the app regression tests**

Run:

```powershell
npm test -- --run tests/app.test.tsx
```

Expected: the structural test and the automatic two-pick advancement test both pass.

### Task 3: Verify the real mobile experience

**Files:**
- Verify: `src/components/GroupStage.tsx`
- Verify: `src/styles.css`
- Verify: `tests/app.test.tsx`

- [ ] **Step 1: Start a local production-shaped preview**

Run:

```powershell
npm run build
npx vite preview --host 127.0.0.1 --port 4173
```

Keep the preview process running while completing the browser checks.

- [ ] **Step 2: Verify a four-option group at 390 × 844**

Open the local preview in the in-app browser, set the viewport to `390 × 844`, start a weapon tournament that shows a four-option group, and confirm:

- all four horizontal rows are visible without scrolling the page;
- each row shows the gun thumbnail, skin name, tier, and effect tags;
- the selected row still uses the cyan highlight;
- the page has no horizontal overflow.

Record the card rectangles from the browser. Each row should be approximately `90–105px` tall and the four rows must fit below the compact heading.

- [ ] **Step 3: Verify interactions and edge widths**

At `390 × 844`, click the first skin and confirm it highlights without advancing. Click a second distinct skin and confirm the next group opens automatically.

Then verify:

- a three-option group fits completely;
- a `320px`-wide viewport has no horizontal overflow or clipped text outside the card;
- an image placeholder occupies the same compact thumbnail area if an image fails;
- at desktop width, group cards return to the existing large-card grid;
- revival and knockout screens retain their existing layouts at mobile width.

### Task 4: Run full verification, publish, and deploy the isolated release

**Files:**
- Verify all changed files.
- Deploy the exact successful `dist/` output.

- [ ] **Step 1: Run the complete local verification**

Run:

```powershell
npm test -- --run
npm run build
git diff --check
git status --short
```

Expected: all tests pass, typecheck and Vite production build succeed, the diff has no whitespace errors, and only the planned source/test/doc changes are present. Do not run `npm run sync:skins`; this UI-only change must not rewrite the catalog.

- [ ] **Step 2: Commit and push the feature branch**

Run:

```powershell
git add src/components/GroupStage.tsx src/styles.css tests/app.test.tsx docs/superpowers/plans/2026-07-24-mobile-group-list.md
git commit -m "feat: compact mobile group choices"
git push -u origin codex/mobile-group-list
```

Record the resulting commit SHA and deploy only the build produced from that exact source state.

- [ ] **Step 3: Record the server isolation baseline**

Using `C:\Users\dosth\.ssh\sshkey-0422.pem`, connect to `root@47.102.159.90` and record:

- the current `/var/www/valorant-cup/current` target;
- `nginx -t`;
- the Java/TURNS PID listening on port `8080`;
- the HTTP status from `http://127.0.0.1:8080/`.

Do not modify the TURNS directory, process, Nginx server block, or port.

- [ ] **Step 4: Upload and atomically activate the new static release**

From the feature worktree, run:

```powershell
$releaseCommit = (git rev-parse HEAD).Trim()
$releaseArchive = Join-Path (Get-Location) "valorant-cup-$releaseCommit.tgz"
tar -czf $releaseArchive -C dist .
scp -i "C:\Users\dosth\.ssh\sshkey-0422.pem" $releaseArchive "root@47.102.159.90:/tmp/valorant-cup-$releaseCommit.tgz"
ssh -i "C:\Users\dosth\.ssh\sshkey-0422.pem" root@47.102.159.90 "set -eu; test ! -e /var/www/valorant-cup/releases/$releaseCommit; mkdir -p /var/www/valorant-cup/releases/$releaseCommit; tar -xzf /tmp/valorant-cup-$releaseCommit.tgz -C /var/www/valorant-cup/releases/$releaseCommit; test -f /var/www/valorant-cup/releases/$releaseCommit/index.html"
```

Verify the release contains `index.html` and the hashed assets, then activate it:

```powershell
ssh -i "C:\Users\dosth\.ssh\sshkey-0422.pem" root@47.102.159.90 "set -eu; find /var/www/valorant-cup/releases/$releaseCommit/assets -maxdepth 1 -type f | head; ln -sfn /var/www/valorant-cup/releases/$releaseCommit /var/www/valorant-cup/current.next; mv -Tf /var/www/valorant-cup/current.next /var/www/valorant-cup/current; nginx -t; systemctl reload nginx"
ssh -i "C:\Users\dosth\.ssh\sshkey-0422.pem" root@47.102.159.90 "rm -f /tmp/valorant-cup-$releaseCommit.tgz"
Remove-Item -LiteralPath $releaseArchive
```

All recursive extraction and link operations use the explicit release path derived from the committed SHA. Do not touch any other `/var/www` path.

- [ ] **Step 5: Verify production and isolation**

Verify:

- `https://valorant-cup.dosthrk.com` returns HTTP 200;
- the deployed HTML references the new hashed asset;
- a fresh mobile browser session at `390 × 844` shows all four group choices without scrolling;
- first and second selection behavior remains correct;
- the recorded TURNS Java PID is unchanged;
- port `8080` and `http://127.0.0.1:8080/` remain healthy.

- [ ] **Step 6: Fast-forward local `master` and push**

From the main checkout, confirm the working tree is clean, fast-forward `master`, reverify, and push:

```powershell
git -C "D:\dev-project\skin-cup" status --short --branch
git -C "D:\dev-project\skin-cup" merge --ff-only codex/mobile-group-list
npm --prefix "D:\dev-project\skin-cup" test -- --run
npm --prefix "D:\dev-project\skin-cup" run build
git -C "D:\dev-project\skin-cup" push origin master
```

Preserve the existing unrelated worktrees and `stash@{0}`.
