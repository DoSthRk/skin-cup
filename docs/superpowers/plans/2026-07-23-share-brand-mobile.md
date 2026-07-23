# Share Brand Footer and Mobile Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a scannable site-brand footer to both generated images and provide a reliable mobile/WeChat save-and-share fallback.

**Architecture:** Keep canvas rendering and capability detection in `src/lib/share.ts`, while a reusable React overlay owns the long-press image workflow. Existing result panels keep their prepared blobs and choose between native sharing, preview fallback, and standard download without adding a backend.

**Tech Stack:** React 18, TypeScript, Canvas 2D, Web Share API, Vitest, Testing Library.

---

### Task 1: Brand footer rendering

**Files:**
- Create: `public/share/valorant-cup-qr.png`
- Modify: `src/lib/share.ts`
- Test: `tests/share.test.tsx`

- [ ] Add failing tests asserting both image builders load `/share/valorant-cup-qr.png`, draw `VALORANT CUP`, `给你的本命皮肤办一场世界杯`, and `valorant-cup.dosthrk.com`, and reserve additional footer height.
- [ ] Run `npm test -- --run tests/share.test.tsx` and confirm the new assertions fail because the footer is absent.
- [ ] Generate the exact URL QR PNG and add a reusable `drawBrandFooter()` canvas helper with a readable fallback when the QR image fails.
- [ ] Call the helper from both image builders and increase each canvas footer area.
- [ ] Run `npm test -- --run tests/share.test.tsx` and confirm the footer tests pass.

### Task 2: Mobile and WeChat share fallback

**Files:**
- Create: `src/components/ShareImagePreview.tsx`
- Modify: `src/lib/share.ts`
- Modify: `src/components/ChampionScreen.tsx`
- Modify: `src/components/BracketSharePanel.tsx`
- Modify: `src/styles.css`
- Test: `tests/share.test.tsx`

- [ ] Add failing tests for WeChat detection, the `preview` share result, the absence of forced downloads in WeChat, and both panels opening an accessible original-image overlay.
- [ ] Run the focused tests and confirm they fail for the missing behavior.
- [ ] Add `isWeChatBrowser()`, return `preview` when native file sharing is unavailable in WeChat, and keep the native share call synchronous with the click gesture.
- [ ] Add the reusable preview overlay with close, long-press guidance, filename, and WeChat menu guidance.
- [ ] Wire download/share actions in both panels and add mobile-safe overlay styles.
- [ ] Run focused tests until green.

### Task 3: Verification and release

**Files:**
- Verify all changed source, tests, docs, and assets.

- [ ] Run `npm test -- --run` and require zero failures.
- [ ] Run `npm run build` and require successful typecheck and Vite build.
- [ ] Preview the production build and visually inspect both generated images plus the overlay at desktop and 390-pixel mobile widths.
- [ ] Commit and push `codex/share-brand-mobile`.
- [ ] Deploy the exact built `dist` into a new `/var/www/valorant-cup/releases/<sha>` directory and atomically update `current`.
- [ ] Verify the public domain, QR asset, final JS asset, Nginx config, and unchanged TURNS PID/HTTP response.
- [ ] Fast-forward local `master`, rerun tests/build, push `master`, and preserve unrelated worktrees and stash entries.
