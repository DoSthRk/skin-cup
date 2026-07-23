# VALORANT-CUP Home Brand Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `VALORANT-CUP` the homepage brand, add an original emblem, rename the Chinese subtitle to `决战皮肤之巅`, and add representative local skin PNGs to all three weapon cards.

**Architecture:** Keep `WeaponSelect` as the presentational homepage component and provide card artwork metadata from a small data module. Store every new image under `public/` so the static Vite build and both deployment targets serve identical assets without runtime API calls.

**Tech Stack:** React 18, TypeScript, CSS, Vitest, Testing Library, Vite, generated PNG assets.

---

### Task 1: Lock the homepage contract with tests

**Files:**
- Modify: `tests/app.test.tsx`

- [ ] **Step 1: Write the failing homepage assertions**

Replace the existing homepage title assertions and add image assertions:

```tsx
expect(
  screen.getByRole('heading', { name: 'VALORANT-CUP' }),
).toBeInTheDocument();
expect(screen.getByText('决战皮肤之巅')).toBeInTheDocument();
expect(
  screen.getByRole('img', { name: 'VALORANT-CUP 赛事标志' }),
).toBeInTheDocument();
for (const skinName of ['光明哨兵 狂徒', '离子武器 幻影', '奇点 正义']) {
  expect(
    screen.getByRole('img', { name: `${skinName} 代表皮肤` }),
  ).toBeInTheDocument();
}
```

- [ ] **Step 2: Verify the test fails**

Run:

```powershell
npm test -- --run tests/app.test.tsx
```

Expected: the homepage test fails because the new heading, subtitle, emblem and representative skin images do not exist.

- [ ] **Step 3: Commit the failing contract together with its implementation**

The test stays uncommitted until Tasks 2–4 make it pass, avoiding a red main branch.

### Task 2: Create and validate project image assets

**Files:**
- Create: `public/brand/valorant-cup-emblem.png`
- Create: `public/weapon-cards/vandal-sentinel.png`
- Create: `public/weapon-cards/phantom-ion.png`
- Create: `public/weapon-cards/sheriff-singularity.png`

- [ ] **Step 1: Generate the original emblem**

Use the built-in image generation tool with this production prompt:

```text
Use case: logo-brand
Asset type: website brand emblem
Primary request: an original compact esports tournament emblem combining an abstract trophy cup, two opposing angular brackets, and a subtle crown point
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background for removal
Style/medium: clean vector-friendly geometric logo, sharp silhouette, no gradients
Composition/framing: centered square icon with generous padding
Color palette: Valorant-Cup site colors #ff4655, #7ee9ee, near-black accents; do not use green in the emblem
Constraints: no text, no letters, no official Valorant logo, no Riot logo, no weapon silhouette, no watermark, no shadow, no texture
```

Copy the generated source to `tmp/imagegen/valorant-cup-emblem-chroma.png`, then run:

```powershell
python C:\Users\dosth\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py --input tmp\imagegen\valorant-cup-emblem-chroma.png --out public\brand\valorant-cup-emblem.png --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill
```

Validate the final PNG has transparent corners and a clean opaque emblem.

- [ ] **Step 2: Download the three approved catalog renders**

Use the catalog `fullRender` PNG URLs:

```text
光明哨兵 狂徒:
https://media.valorant-api.com/weaponskinchromas/6f337971-40b7-c94d-0f24-36869af654c6/fullrender.png

离子武器 幻影:
https://media.valorant-api.com/weaponskinchromas/b9c9eb56-4cbd-04b7-06a8-329dc6f1e73a/fullrender.png

奇点 正义:
https://media.valorant-api.com/weaponskinchromas/00831706-4e60-d5f9-b600-e38be89828d0/fullrender.png
```

Save them to the exact `public/weapon-cards/*.png` paths above and verify each file is a valid PNG with nonzero dimensions.

### Task 3: Add homepage artwork metadata

**Files:**
- Create: `src/data/home-brand.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Define typed representative artwork**

Create:

```ts
import type { WeaponId } from '../domain/types';

export interface WeaponCardArtwork {
  readonly src: string;
  readonly skinName: string;
}

export const weaponCardArtwork: Readonly<Record<WeaponId, WeaponCardArtwork>> = {
  vandal: {
    src: '/weapon-cards/vandal-sentinel.png',
    skinName: '光明哨兵 狂徒',
  },
  phantom: {
    src: '/weapon-cards/phantom-ion.png',
    skinName: '离子武器 幻影',
  },
  sheriff: {
    src: '/weapon-cards/sheriff-singularity.png',
    skinName: '奇点 正义',
  },
};
```

- [ ] **Step 2: Include artwork in each weapon option**

Import `weaponCardArtwork` in `src/App.tsx` and add:

```ts
artwork: weaponCardArtwork[id],
```

to each item produced by `weaponOptions`.

### Task 4: Rebuild the homepage brand and weapon cards

**Files:**
- Modify: `src/components/WeaponSelect.tsx`
- Modify: `src/styles.css`
- Modify: `index.html`

- [ ] **Step 1: Render the new brand hierarchy**

Extend `WeaponOption` with:

```ts
readonly artwork: {
  readonly src: string;
  readonly skinName: string;
};
```

Replace the homepage header with:

```tsx
<header className="home-brand">
  <img
    className="home-brand__mark"
    src="/brand/valorant-cup-emblem.png"
    alt="VALORANT-CUP 赛事标志"
  />
  <h1>VALORANT-CUP</h1>
  <p className="home-brand__subtitle">决战皮肤之巅</p>
</header>
<p className="home-screen__intro">选择武器，开启你的皮肤锦标赛。</p>
```

- [ ] **Step 2: Render the representative skin inside each button**

Use this button content:

```tsx
<span className="weapon-launch__copy">
  <strong>{weapon.label}</strong>
  <span>{weapon.count} 款特效皮肤</span>
</span>
<img
  className="weapon-launch__skin"
  src={weapon.artwork.src}
  alt={`${weapon.artwork.skinName} 代表皮肤`}
/>
```

- [ ] **Step 3: Style the brand and responsive cards**

Update `src/styles.css` so:

- the emblem is `clamp(4.5rem, 12vw, 7rem)` wide;
- `VALORANT-CUP` is the largest line, uppercase, white, tightly spaced;
- the Chinese subtitle is cyan with wide tracking;
- cards use a dark red/black gradient with artwork on the right;
- desktop cards use three columns at `min-width: 52rem`;
- narrow screens use one column with at least `7rem` card height;
- artwork uses `object-fit: contain`, `pointer-events: none`, and never covers copy.

- [ ] **Step 4: Update document metadata**

Set:

```html
<title>VALORANT-CUP · 决战皮肤之巅</title>
```

in `index.html`.

- [ ] **Step 5: Verify the focused test passes**

Run:

```powershell
npm test -- --run tests/app.test.tsx
```

Expected: 11 tests pass.

- [ ] **Step 6: Commit the homepage feature**

```powershell
git add tests/app.test.tsx src/data/home-brand.ts src/App.tsx src/components/WeaponSelect.tsx src/styles.css index.html public/brand/valorant-cup-emblem.png public/weapon-cards
git commit -m "feat: refresh valorant cup homepage brand"
```

### Task 5: Validate visually and publish

**Files:**
- Generated build output only; no additional source changes expected.

- [ ] **Step 1: Run complete verification**

Run:

```powershell
npm test -- --run
npm run build
git diff --check
```

Expected: 98 tests pass, TypeScript succeeds, Vite produces the production bundle, and `git diff --check` is clean.

- [ ] **Step 2: Inspect desktop and mobile layouts**

Open the local Vite site in the in-app browser. Verify the logo, exact title hierarchy, all three skin images, whole-card click targets, and a mobile-width layout.

- [ ] **Step 3: Push and deploy**

Push `master`, deploy `dist/client` into a new isolated `/var/www/valorant-cup/releases/<commit>` directory, atomically switch `/var/www/valorant-cup/current`, and verify the existing TURNS Java PID and port `8080` remain unchanged.

Package and save the same commit as a new Sites version, deploy it privately, and verify both production URLs.
