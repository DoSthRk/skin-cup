# Creator Footer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a responsive author footer with Clint's avatar, GitHub profile, and WeChat QR card to every app screen.

**Architecture:** A focused `CreatorFooter` React component owns its open state and pointer/focus/keyboard interactions. `App` mounts it in both its home and tournament layouts, while CSS positions the profile card above the footer and keeps it within the mobile viewport.

**Tech Stack:** React, TypeScript, CSS, Vitest, Testing Library, Vite

---

### Task 1: Specify the author component behavior

**Files:**
- Create: `src/components/CreatorFooter.tsx`
- Create: `tests/creator-footer.test.tsx`

- [ ] **Step 1: Write the failing component tests**

Test that the component renders `MADE BY`, `Clint`, the avatar, a GitHub link with `href="https://github.com/DoSthRk"`, and the WeChat QR image. Assert the trigger starts with `aria-expanded="false"`, becomes true after a click, and returns to false after Escape.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npm test -- --run tests/creator-footer.test.tsx
```

Expected: failure because `CreatorFooter` does not exist.

- [ ] **Step 3: Implement the minimal accessible component**

Create a React component with local `open` state. The wrapper opens on mouse enter and focus capture, closes on mouse leave and focus leaving the wrapper, toggles from the author button, and closes on Escape. The expanded card contains:

```tsx
<a href="https://github.com/DoSthRk" target="_blank" rel="noreferrer">
  GitHub · @DoSthRk
</a>
```

Use `/creator/clint-avatar.png` and `/creator/clint-wechat.jpg` for the local images.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
npm test -- --run tests/creator-footer.test.tsx
```

Expected: all creator footer tests pass.

### Task 2: Mount the footer across the app

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Modify: `tests/app.test.tsx`
- Add: `public/creator/clint-avatar.png`
- Add: `public/creator/clint-wechat.jpg`

- [ ] **Step 1: Write failing integration assertions**

In the home test, assert `screen.getByText('MADE BY')` and the Clint trigger are present. In the fresh tournament test, assert the same trigger remains present after selecting a weapon.

- [ ] **Step 2: Run the focused app tests and verify RED**

Run:

```bash
npm test -- --run tests/app.test.tsx -t "author|starts a fresh"
```

Expected: failure because `App` does not mount the footer.

- [ ] **Step 3: Mount and style the footer**

Wrap the home branch in a flex column shell and append `CreatorFooter`. Append the same component after `tournament-main` in the tournament shell. Add responsive styles for:

- a centered, compact footer trigger;
- an upward-opening absolute profile card;
- an image-and-name header;
- a prominent GitHub link;
- a white QR image panel;
- viewport-safe sizing below 38rem.

Copy the supplied avatar and QR image into `public/creator/` without changing their contents.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```bash
npm test -- --run tests/creator-footer.test.tsx tests/app.test.tsx
```

Expected: all focused tests pass.

### Task 3: Verify and release

**Files:**
- Verify: `src/components/CreatorFooter.tsx`
- Verify: `src/App.tsx`
- Verify: `src/styles.css`
- Verify: `public/creator/*`

- [ ] **Step 1: Run complete verification**

Run:

```bash
npm test -- --run
npm run build
git diff --check
```

Expected: all tests, TypeScript, and Vite build pass with no whitespace errors.

- [ ] **Step 2: Perform real browser visual checks**

Verify the home page and an active tournament at desktop width. Hover or focus the author trigger and confirm the card opens upward. Repeat at a narrow mobile viewport, click the trigger, and confirm the card remains within the viewport and the QR code is legible.

- [ ] **Step 3: Commit, push, deploy, and merge**

Commit and push the feature branch. Deploy the exact verified `dist` to a new isolated `/var/www/valorant-cup/releases/<commit>` directory, atomically switch `current`, verify HTTP 200 and TURNS isolation, fast-forward `master`, rerun tests/build, and push `master`.
