# Session Progress band — design

> Status: design for review. Date: 2026-06-03. Branch: `feature/classroom-plugins`.
> Pins down the already-shipped Session Progress bar (`src/fullmind-classroom/session-progress-bar.tsx`).
> Scope source: `Prototype_01_2026-06-02_bbb-toolbar.html` `.banner` (exact CSS),
> `fullmind-bbb-base.css` §"FULL-WIDTH plum chrome bars" + §F, and the open
> "form-factor delta" already logged in `README.md` and `FEATURE-session-progress-bar.md`.

## Goal

Turn the shipped Session Progress bar from a **centered floating pill** into the
prototype's **full-width banner sitting in a real reserved strip above the navbar** —
with the CSS reskin and the plugin cooperating, so it reads as part of the room
chrome, not an overlay floating over content.

Justin's words: *"I don't want it to float; ideally I'd like the progress bar to
work with the CSS,"* and *"I want it to match the prototype."*

## Guiding principle — division of labor (the CSS ↔ plugin boundary)

This is **not** "move the bar from the plugin into the CSS." Two hard facts forbid that:

1. **The band is net-new structure.** No BBB DOM node exists to restyle into a
   progress band, and CSS cannot create structure — only restyle/reposition what's
   already there. So the band element must come from the plugin.
2. **The fill + countdown are computed from elapsed time.** CSS cannot do arithmetic
   on `now - createdTime`. So the live values must come from the plugin.

Therefore the work splits cleanly:

- **Plugin owns the bar** — it renders the band and drives the live fill + countdown
  (unchanged data layer: `useCustomSubscription` on `createdTime` / `durationInSeconds`).
- **CSS owns the space** — a new reskin rule reserves `--fm-band-h` at the top by
  pushing the room layout down, exactly as §F already pushes content down by the
  navbar height. The band then drops into a clean reserved strip and overlaps nothing.

The two are bound by **one shared contract**: the CSS variable `--fm-band-h`. CSS
declares it and reserves exactly that much space; the plugin reads the same variable
for the band's height. One number, one source of truth — the reserved strip and the
rendered band cannot drift apart.

## Exact prototype spec (the thing we're matching)

From the prototype's `.room` grid (`grid-template-rows: 32px 60px 1fr 76px`), the
banner is the **first row — 32px tall**. So `--fm-band-h: 32px`.

Banner (`.banner`), left → right, vertically centered, `gap:14px`, `padding:0 18px`,
`border-bottom:1px solid rgba(255,255,255,.08)` (the divider under it):

| Part | Prototype CSS | Notes |
|---|---|---|
| **Band background** | `--fm-plum-swatch` = `#3E3A6E` | the strip color |
| **Label** | "Session Progress" | base `rgba(255,255,255,.55)`; second word bold white (`#fff`, 700); 14px leading icon, `gap:7px` |
| **Track** (`.masterbar`) | `flex:1; height:9px; radius:999; bg rgba(255,255,255,.10)` | fills the middle, takes remaining width |
| **Fill** (`.fill`) | `width:<live>%`; `linear-gradient(90deg, #F37167, #FF9A8E)`; glow `0 0 12px rgba(243,113,103,.5)`; `transition: width .5s cubic-bezier(.2,.8,.2,1)`; **sheen** shimmer sweep (2.6s) | the animated coral fill |
| **Percent** (`.b-pct`) | `font-weight:800; font-size:13px; #fff; min-width:38px; text-align:right` | e.g. `33%` |
| **Time** (`.b-time`) | clock icon (14px, `opacity:.7`) + `MM:SS left`; `color rgba(255,255,255,.55); gap:6px` | e.g. `40:00 left` |

Color tokens (already defined in both the prototype and `fullmind-bbb-base.css`):
`--fm-plum #403770` · `--fm-plum-swatch #3E3A6E` · `--fm-coral #F37167` · gradient
end `#FF9A8E`.

## Deltas from the shipped bar (this is the actual work)

The data/logic is done; this is a **restyle + a layout-reservation rule**. Concretely:

1. **Pill → band.** Inner view changes from centered rounded pill
   (`top:10; left:50%; translateX(-50%); borderRadius:999; box-shadow`) to a
   full-width band (`top:0; left:0; right:0; height: var(--fm-band-h, 32px)`), with a
   1px bottom divider. The pill-specific positioning/radius/shadow are **deleted, not
   layered** (net-line discipline, rule #3).
2. **Add the `%` readout** — the shipped bar has none; the prototype shows `33%`.
3. **Time format → `MM:SS left`** — shipped bar rounds to "N min left"; prototype
   shows mm:ss. Reuse the existing `remainingMs`; format mm:ss instead of `ceil(min)`.
4. **Fill gradient end `#FF9A8E`** (shipped uses `#F8A7A0`) + **sheen** shimmer sweep
   (shipped has a pulse dot instead).
5. **Label** "Session Progress" (shipped shows uppercase "SESSION").
6. **Band bg `--fm-plum-swatch #3E3A6E`** (shipped uses `rgba(64,55,112,.92)`).
7. **Colors + height from CSS vars** with hardcoded fallback (single source of truth):
   read `--fm-band-h`, `--fm-plum-swatch`/`--fm-plum`, `--fm-coral` from
   `getComputedStyle(document.documentElement)`; fall back to the prototype hex if a
   var is absent (so the bar still renders if it ever runs without the reskin).

### Surfaced tradeoffs (rule #4 — not decided silently)

- **Amber final-stretch cue + pulsing live dot** exist in the shipped bar but **not**
  in the prototype. "Match the prototype" → **drop both** for fidelity. They are
  genuine usability cues, so this is called out, not buried; default is to drop them.
  (If desired later, a subtle amber `<5 min` tint is an additive enhancement that
  doesn't conflict with the prototype's look.)
- **Tabular numerals** kept for the `%` and time so the digits don't jitter as they
  tick — a readability nicety the prototype's static mockup doesn't exercise but that
  a live ticking readout needs.

## The two coordinated changes

### 1. `src/fullmind-classroom/session-progress-bar.tsx` — restyle the view
- Same `FloatingWindow` registrar, same `useCustomSubscription` + 1s tick. **Data
  untouched.**
- `SessionProgressView` returns the full-width band per the spec table above.
- Reads `--fm-band-h` and the color tokens via `getComputedStyle`, with fallbacks.
- Floating window stays pinned `top:0 left:0`; the inner band is `position:fixed;
  top:0; left:0; right:0` so it spans edge-to-edge.

### 2. `fullmind-bbb-base.css` — reserve the strip
- Add `--fm-band-h: 32px` to `:root` (next to `--fm-navbar-h` / `--fm-actionsbar-h`).
- Push the room down by `--fm-band-h` so nothing renders under the band. Mechanism
  (same family as §F, to confirm live): shift `#Navbar` down by `--fm-band-h` and
  extend the §F wrapper offsets (`#layout > div:not([data-test])`:
  `top: calc(var(--fm-band-h) + var(--fm-navbar-h))`,
  `height: calc(100% - var(--fm-band-h) - var(--fm-navbar-h) - var(--fm-actionsbar-h))`),
  plus push the presentation/stage region down by the same amount. The exact set of
  hooks is finalized against the live room (BBB writes inline px; `!important` wins
  and keeps winning per the §F notes).
- New block lives beside §F — same geometry family, one place to tune.

### 3. `manifest.json` — bump version `0.0.2 → 0.0.3`
Busts BBB's cached bundle (`?version=0.0.3`) so clients pick up the rebuilt JS.

## Out of scope
- The data subscription and the `createdTime` / `durationInSeconds` field names — a
  **live-room confirmation**, not a code change here (see below).
- The navbar header itself — already complete in CSS §F; untouched.
- Any other plugin feature (sidebar rail, exit-ticket modal).

## Success criteria
1. `npm run build-bundle` succeeds and `npm run lint` is clean.
2. The band renders **full-width at the very top**; BBB's navbar and content sit
   **below it with no overlap and no gap**.
3. It still fills left→right over time and counts down (logic unchanged), now with a
   `%` readout and `MM:SS left`.
4. Band height + colors derive from CSS vars (single source of truth) with safe
   fallbacks; `--fm-band-h` matches between the CSS reservation and the rendered band.

## Live-verified later (consistent with how the bar already shipped)
- The CSS strip-reservation must be confirmed in the real test room (inline-px
  layout, recomputes on resize).
- The GraphQL field names confirmed (the bar fills; if empty, adjust the two names in
  `SESSION_TIMING_SUBSCRIPTION` — math is generic).
