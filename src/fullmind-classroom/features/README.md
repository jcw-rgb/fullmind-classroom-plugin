# Fullmind Classroom — plugin features

Each feature is a self-contained file layered as a sibling in
`../component-working.tsx`. The Lesson Hub is a branded reskin of BBB's own
native sidebar nav — it reuses BBB's chat, shared notes, and user list rather
than rebuilding them. One chat, one notes panel, one user list: no duplicates.

## Registration (important)
SDK `set*` methods are **last-writer-wins per plugin**. Two floating windows
coexist (the Session Progress bar + the Lesson Hub), so they must be registered
together in ONE call. `register-floating-windows.tsx` is the single
`setFloatingWindows` caller — never call it from any other file.

| Feature | File | Surface |
|---|---|---|
| Lesson Hub | `lesson-hub-rail.tsx` | `setFloatingWindows` (via hub) — injects a pure-CSS reskin of BBB's native nav; no visible window of its own |
| Session Progress bar | `../session-progress-bar.tsx` | `setFloatingWindows` (via hub) — fixed-position overlay |
| Floating-windows hub | `register-floating-windows.tsx` | `setFloatingWindows` (ONE call: progress bar + Lesson Hub) |
| Font-size reorder | `font-size-reorder.tsx` | DOM only |
| Shared tokens | `theme.ts` | — |

## Architecture: pure-CSS reskin, no DOM mutation, no reflow

`lesson-hub-rail.tsx` exports `makeLessonHubWindow(pluginUuid)`, which returns an
invisible `FloatingWindow` (transparent, no shadow, `movable:false`). Its content
renders `LessonHubView`, which **renders no UI and mutates no DOM** — it only:

1. Injects `RESKIN_STYLE`, a `<style>` that restyles BBB's *own* native nav:
   - relabels the tabs via `::after` ("Public Chat" → "Chat", "Shared Notes" →
     "Notes"), hiding BBB's own text/icon with `display:none` on the child wrapper;
   - draws the Fullmind outline icons via `::before` using a CSS `mask-image`
     (so the icon inherits `currentColor` — grey normally, white on the coral
     active tab);
   - colours the active tab coral via BBB's own `aria-expanded="true"` (no JS
     state tracking needed — BBB sets this on the open nav item);
   - off-white→Gray-100 rail background (`var(--fm-gray-100, …)`) so the nav
     reads as a distinct column from the white panel beside it;
   - hover greys for the Chat/Notes tabs and user rows.
2. Calls `ensureBaseCssLink()` once (in a `useEffect`): appends a single
   `<link id="fm-base-css">` to `<head>` pointing at `fullmind-bbb-base.css`,
   whose URL is **derived from the plugin's own `<script src>` origin** (tunnel
   in dev, S3 in prod) and carries the script's `?version=` for cache-busting.
   This loads the global base reskin (plum bars, logo, fonts) reliably across
   reloads — `userdata-bbb_custom_style_url` is ignored on bbb0-v3, and a
   hand-injected link is wiped on every page reload.

**Why pure CSS:** an earlier version rewrote the nav items' `innerHTML` and ran
a `MutationObserver`; that fought BBB's React reconciliation and crashed the
client ("Oops, something went wrong"). And an earlier *rail* reflowed BBB's
columns (`margin-left`), which made the whiteboard pop on every panel switch.
This version moves nothing and mutates no React-owned node — BBB owns the
layout, so chat↔notes is seamless exactly like a default room. Appending one
`<link>` to `<head>` is safe (it never touches BBB's React tree).

### Known fragility
The reskin selectors hang on BBB's `data-test` hooks and `aria-expanded` — these
are test/accessibility attributes, not a stable theming API. A BBB 3.x upgrade
can rename or drop them, and the reskin would silently revert with no error.
**Re-verify the selectors in a live room on every BBB upgrade.** (No hashed
styled-component class names are relied on, which is the more brittle option.)

## Build & deploy

```bash
npm run build-bundle   # → dist/FullmindClassroom.js + dist/manifest.json + dist/fullmind-bbb-base.css
```

Manifest is at `0.0.6`. Upload all **three** `dist/` files to the S3 folder per
`DEV-HANDOFF.md` — the base CSS must be co-located with the bundle so
`ensureBaseCssLink()` can load it from the same origin.

## Local preview

```bash
npm run preview        # → http://localhost:4702
```

⚠️ `LessonHubView` now renders only a `<style>` that targets BBB's native nav,
which does not exist in the mock preview DOM — so the preview shows nothing
useful for this feature. Verify the reskin live on BBB (tunnel, or Stylus over a
real room), not in the local preview.

## Live-verification checklist (test room)

- Nav tabs read "Chat" and "Notes" with the Fullmind outline icons; no double
  labels, no grey gradient boxes.
- The open tab is coral with white label + icon (driven by `aria-expanded`).
- The nav rail background is Gray-100, distinct from the white panel beside it.
- Switching Chat↔Notes is seamless — the whiteboard does NOT pop or rescale.
- Hovering a Chat/Notes tab or a user row shows the light-grey hover.
- The base reskin loaded on its own after a reload (plum bars + logo present,
  with no manual CSS injection) — confirms `ensureBaseCssLink()` fired.
- Settings → Application: the "%" value sits between the - and + buttons
  (font-size reorder, unchanged).
