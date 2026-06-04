# Fullmind Classroom — plugin features

Each feature is a self-contained file layered as a sibling in
`../component-working.tsx`. The plugin draws its own fixed-position overlay
(the Lesson Hub rail) rather than using BBB's native sidekick panels.

## Registration (important)
SDK `set*` methods are **last-writer-wins per plugin**. Two floating windows
now coexist (the Session Progress bar + the Lesson Hub rail), so they must be
registered together in ONE call. `register-floating-windows.tsx` is the single
`setFloatingWindows` caller — never call it from any other file.

| Feature | File | Surface |
|---|---|---|
| Lesson Hub rail | `lesson-hub-rail.tsx` | `setFloatingWindows` (via hub) — fixed-position overlay: rail + sliding panel |
| Session Progress bar | `../session-progress-bar.tsx` | `setFloatingWindows` (via hub) — fixed-position overlay |
| Floating-windows hub | `register-floating-windows.tsx` | `setFloatingWindows` (ONE call: progress bar + rail) |
| Chat panel body | `chat-panel.tsx` | `ChatPanelView` — reused inside the rail |
| Notes panel body | `notes-panel.tsx` | `NotesPanelView` — reused inside the rail |
| Class panel body | `class-panel.tsx` | `ClassPanelView` — reused inside the rail |
| Font-size reorder | `font-size-reorder.tsx` | DOM only |
| Shared tokens | `theme.ts` | — |

## Architecture: one floating window, drawn as a fixed overlay

`lesson-hub-rail.tsx` exports `makeLessonHubWindow(pluginUuid)`, which returns
an invisible `FloatingWindow` (transparent, no shadow, `movable:false`). Its
content renders `LessonHubView` — a `position:fixed` overlay that includes:

- **The rail** (64 px wide, light-gray, docked left below the nav bar): three
  SVG icon buttons — Chat, Notes, Class.
- **The sliding panel** (264 px wide): appears to the right of the rail when a
  button is active; header + the reused `*PanelView` body.
- **An injected `<style>`**: hides BBB's native sidebar and shrinks the stage
  via `margin-left` when a panel is open (`body.fm-hub-open`).

The component owns all open/close + active-tab state internally. Clicking an
active button closes the panel; clicking another switches tabs.

## Live-wire constants (confirm in the test room)

Four constants are labeled `// CONFIRM IN LIVE ROOM` and must be tuned once
in a live BBB room before shipping:

| Constant | File | What it selects / controls |
|---|---|---|
| `NOTES_PAD_URL` | `notes-panel.tsx` | Etherpad pad URL embedded in the Notes panel. Empty string by default — the panel shows fallback text until set. |
| `NATIVE_SIDEBAR_SELECTOR` | `lesson-hub-rail.tsx` | CSS selector for BBB's native sidebar column to hide (preferred: `data-test` attribute). |
| `STAGE_SELECTOR` | `lesson-hub-rail.tsx` | CSS selector for the presentation/stage container that gets pushed narrower when a panel opens. |
| `RAIL_TOP` | `lesson-hub-rail.tsx` | Pixel offset from the top of the viewport so the rail sits below BBB's nav bar. |

## Chat unread badge

The Chat rail button shows a live coral badge counting messages received since
Chat was last opened (`useLoadedChatMessages` feed). The count resets to 0
when the Chat panel opens. Notes and Class have no badge (no meaningful unread
signal available from the SDK).

## Build & deploy

```bash
npm run build-bundle   # → dist/FullmindClassroom.js + dist/manifest.json
```

Manifest is at `0.0.4`. Upload both `dist/` files to the S3 folder per
`DEV-HANDOFF.md`.

## Local preview

```bash
npm run preview        # → http://localhost:4702
```

Renders the real `LessonHubView` against the mock SDK. The rail is
interactive: click a button to open its panel.

## Live-verification checklist (test room)

- Rail sits below the top nav, left edge, three correct SVG buttons visible.
- Clicking Chat opens the Chat panel and pushes the whiteboard narrower; the
  native sidebar is hidden (no duplicate chat/users column).
- Clicking Notes opens the Notes panel (set `NOTES_PAD_URL` first; otherwise
  fallback text shows). Clicking the active button closes the panel and the
  whiteboard restores its width.
- Clicking Class opens the class roster; talking dot and MUTED labels reflect
  live audio state.
- Chat badge increments while Chat is closed and new messages arrive; clears to
  0 on open.
- Settings → Application: the "%" value sits between the - and + buttons
  (font-size reorder, unchanged).
