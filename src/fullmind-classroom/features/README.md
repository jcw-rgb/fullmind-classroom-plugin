# Fullmind Classroom — plugin features

Each feature is a self-contained file layered as a sibling in
`../component-working.tsx`. The Lesson Hub rail is a branded **launcher** for
BBB's own native panels — it reuses BBB's chat, shared notes, and user list
rather than rebuilding them. One chat, one notes panel, one user list: no
duplicates.

## Registration (important)
SDK `set*` methods are **last-writer-wins per plugin**. Two floating windows
now coexist (the Session Progress bar + the Lesson Hub rail), so they must be
registered together in ONE call. `register-floating-windows.tsx` is the single
`setFloatingWindows` caller — never call it from any other file.

| Feature | File | Surface |
|---|---|---|
| Lesson Hub rail | `lesson-hub-rail.tsx` | `setFloatingWindows` (via hub) — fixed-position 64 px rail that launches BBB's native Chat, Notes, and Class (user list) panels |
| Session Progress bar | `../session-progress-bar.tsx` | `setFloatingWindows` (via hub) — fixed-position overlay |
| Floating-windows hub | `register-floating-windows.tsx` | `setFloatingWindows` (ONE call: progress bar + rail) |
| Font-size reorder | `font-size-reorder.tsx` | DOM only |
| Shared tokens | `theme.ts` | — |

## Architecture: one floating window, drawn as a fixed overlay

`lesson-hub-rail.tsx` exports `makeLessonHubWindow(pluginUuid)`, which returns
an invisible `FloatingWindow` (transparent, no shadow, `movable:false`). Its
content renders `LessonHubView` — a `position:fixed` overlay that includes:

- **The rail** (64 px wide, light-gray, docked left below the nav bar): three
  SVG icon buttons — Chat, Notes, Class. No rebuilt panel body; each button
  launches BBB's own native panel.
- **An injected `<style>`** (`RAIL_LAYOUT_STYLE`): (a) shifts BBB's native
  sidebar container right by 64 px (`margin-left`) so the native panel sits
  beside the rail with no overlap and no gap; (b) hides BBB's native chat and
  user-list toggle buttons via `display:none` so the rail is the single nav.
  `display:none` still allows programmatic `.click()`, which is how Class and
  Notes are opened.

Button actions:
- **Chat** — open: `pluginApi.uiCommands.chat.form.open()` (SDK); close:
  DOM-click `CHAT_CLOSE_SELECTOR`.
- **Class** — DOM-click `NATIVE_USERLIST_TOGGLE`.
- **Notes** — DOM-click `SHARED_NOTES_TOGGLE`.

Active highlight: Class reads `useUiData(USER_LIST_IS_OPEN)`; Notes reads
`useUiData(CURRENT_ELEMENT)` and checks for `PINNED_SHARED_NOTES`; Chat is
best-effort local `chatOpen` state tracking (reliable because the native toggle
is hidden — users can only open/close Chat via the rail button).

## Live-wire constants (confirm in the test room)

Six constants in `lesson-hub-rail.tsx` are labeled `// CONFIRM` and must be
verified once in a live BBB room before shipping:

| Constant | What it selects / controls |
|---|---|
| `SHARED_NOTES_TOGGLE` | Selector for BBB's native Shared-Notes toggle button; DOM-clicked to open/close the Notes panel. |
| `CHAT_CLOSE_SELECTOR` | Selector(s) for BBB's native chat close control(s); DOM-clicked when Chat is toggled off (SDK `chat.form.open` is open-only). |
| `NATIVE_SIDEBAR_CONTAINER` | Selector for BBB's native panel column; receives `margin-left: 64px` so it sits beside the rail, not behind it. |
| `NATIVE_USERLIST_TOGGLE` | Selector for BBB's native user-list toggle button; DOM-clicked to open/close the Class (user list) panel, and hidden via CSS so the rail is the sole nav. |
| `NATIVE_CHAT_TOGGLE` | Selector for BBB's native chat toggle button; hidden via CSS so the rail is the sole nav (still `.click()`-able while hidden). |
| `RAIL_TOP` | Pixel offset from the top of the viewport so the rail sits below BBB's nav bar. |

## Chat unread badge

The Chat rail button shows a live coral badge counting messages received since
Chat was last opened (`useLoadedChatMessages` feed). The count resets to 0
when the Chat panel opens. Notes and Class have no badge (no meaningful unread
signal available from the SDK).

## Build & deploy

```bash
npm run build-bundle   # → dist/FullmindClassroom.js + dist/manifest.json
```

Manifest is at `0.0.5`. Upload both `dist/` files to the S3 folder per
`DEV-HANDOFF.md`.

## Local preview

```bash
npm run preview        # → http://localhost:4702
```

Renders the real `LessonHubView` against the mock SDK. The rail buttons are
interactive (active highlight toggles on click); the native-panel DOM triggers
are no-ops outside a live BBB room.

## Live-verification checklist (test room)

- Rail sits below the top nav at the left edge with three SVG buttons (Chat,
  Notes, Class) visible.
- BBB's own chat and user-list toggle buttons are hidden — only the rail
  buttons drive panel open/close.
- Clicking Chat opens BBB's native (Fullmind-reskinned) chat panel. Confirm
  there is only ONE chat column — no duplicate.
- Clicking the active Chat button closes the chat panel.
- Chat highlight is active while the panel is open; badge increments while Chat
  is closed and new messages arrive; badge clears to 0 on open.
- Clicking Class opens BBB's native user list. Class button highlights while
  the user list is open and deactivates when closed (tracks native UI state).
- Clicking Notes opens BBB's native Shared Notes panel. Notes button highlights
  while Shared Notes is pinned/open and deactivates when closed (tracks native
  UI state).
- In all cases the native panel sits beside the rail with no overlap and no
  gap (the native sidebar container is shifted right by 64 px).
- Settings → Application: the "%" value sits between the - and + buttons
  (font-size reorder, unchanged).
