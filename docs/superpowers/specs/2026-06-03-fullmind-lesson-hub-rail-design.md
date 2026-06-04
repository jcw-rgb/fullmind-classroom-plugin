# Fullmind Lesson Hub rail — design

> Status: design for review. Date: 2026-06-03. Branch: `feature/classroom-plugins`.
> **Supersedes the sidekick-panel approach** in `2026-06-03-fullmind-classroom-plugins-design.md`.
> That spec registered three BBB `GenericContentSidekickArea` buttons; this replaces
> them with a plugin-drawn rail so the prototype's exact `.iconrail` (custom SVG icons +
> styling + push behavior) is reproduced faithfully. The three panel **Views**, the
> theme, and the font-size reorder are reused unchanged.

## Why the change
The SDK sidekick button takes `buttonIcon: <font-glyph-name>`, not an SVG, and BBB
draws the rail itself — so the prototype's exact custom icons and rail styling can't
come through the native path. A plugin CAN paint a fixed-position overlay with arbitrary
SVG (the Session Progress bar already does this via a `FloatingWindow` + `position:
fixed`). So we draw the rail ourselves.

## Decisions (locked with Justin)
1. **Custom plugin-drawn rail** — exact prototype match, not BBB's native sidekick.
2. **Push, not overlay** — opening a panel shrinks BBB's stage so the whiteboard reflows
   exactly like the prototype (accepted trade-off: reaches into BBB's hashed layout, so
   it's the most upgrade-fragile part).
3. **Plugin injects its own CSS** — self-contained; the rail + push works the moment the
   bundle loads, no dependency on the reskin file.
4. **Chat unread badge is a real feature** — counts messages since the Chat tab was last
   opened, updates live, clears to 0 on open. Coral pill + white number, identical to the
   prototype `.badge`. **No** badge on Notes or Class (Notes = Etherpad iframe, the SDK
   gives no feed of edits to count; Class has no natural unread meaning).

## Architecture
- **Two floating windows now coexist** (progress bar + rail). Since `setFloatingWindows`
  is last-writer-wins per plugin, ONE registrar must own it. So the progress bar is
  refactored to **export its window descriptor** (`makeSessionProgressWindow`) instead of
  self-registering, and a small `register-floating-windows.tsx` calls
  `setFloatingWindows([progressBarWindow, lessonHubWindow])` once. (Same hub discipline
  as the deleted panel hub — it just moves to the floating-windows setter.)
- **The rail itself, `lesson-hub-rail.tsx`**, exports `makeLessonHubWindow` — an invisible
  `FloatingWindow` (`movable:false`, transparent, no shadow — exactly as the progress bar
  hides its window chrome) whose content is the fixed-overlay rail. Its content is a `position: fixed` overlay rendering:
  - the prototype `.iconrail` (three SVG buttons: Chat / Notes / Class), docked left, and
  - a sliding panel that shows the active tab's body.
  The component owns its **own open/close + active-tab state** (click a button → open that
  panel; click the active button again → close). It renders no DOM through BBB's slots
  other than the one floating window.
- **Panel bodies are the existing Views** — `ChatPanelView`, `ClassPanelView`,
  `NotesPanelView` (already exported). Live SDK data wiring is unchanged.
- **Injected `<style>`** (rendered in the component's React tree, like the progress bar's
  keyframes block) does two BBB-layout jobs, toggled by a class on `document.body`:
  - always: **hide BBB's native sidebar** (so our rail isn't duplicated), and
  - when a panel is open (`body.fm-hub-open`): **shrink BBB's stage / presentation
    container** so the whiteboard reflows narrower (the "push").
- **Self-contained:** the plugin adds/removes `fm-hub-open` on body as panels toggle; the
  injected rule does the resizing. No external CSS file needed.

## Live-wire constants (one labeled block — `// CONFIRM IN LIVE ROOM`)
These reach into BBB's hashed layout and are tuned once in the test room:
- The selector(s) for **BBB's native sidebar** to hide (prefer `data-test` hooks).
- The selector for **the stage / presentation container** to shrink, and the width to
  subtract (rail width + panel width).
- The **rail top offset** (height of BBB's top nav) so the rail sits below it.

## Components
| File | Change |
|---|---|
| `features/lesson-hub-rail.tsx` | **NEW** — floating window, fixed-overlay rail + sliding panel, open/close + active-tab state, injected CSS, prototype SVGs, Chat unread badge |
| `features/chat-panel.tsx` | Keep `ChatPanelView`; **remove** the now-unused `makeChatArea` factory |
| `features/class-panel.tsx` | Keep `ClassPanelView`; **remove** `makeClassArea` |
| `features/notes-panel.tsx` | Keep `NotesPanelView`; **remove** `makeNotesArea` |
| `features/register-panels.tsx` | **DELETE** — sidekick hub no longer used |
| `features/session-progress-bar.tsx` | Refactor: export `makeSessionProgressWindow`; stop self-registering. View/timing unchanged |
| `features/register-floating-windows.tsx` | **NEW** — single `setFloatingWindows([progressBar, rail])` caller |
| `features/theme.ts` | Unchanged (reused) |
| `features/font-size-reorder.tsx` | Unchanged (independent) |
| `component-working.tsx` | Render `<RegisterFloatingWindows>` + foundation + font-size (no `<RegisterPanels>`, no `<SessionProgressBar>`) |
| `manifest.json` | Bump `0.0.3 → 0.0.4` (busts cached bundle) |
| `src/preview/*` | Update the preview to render the real rail + push behavior with mock data |

## Chat unread badge — behavior
- The rail tracks `lastOpenedAt` for Chat (init = mount time). Unread =
  `messages.filter(m => time(m.createdAt) > lastOpenedAt).length` from
  `useLoadedChatMessages()`. (`createdAt` is a string in the SDK type — parse it.)
- Badge shows the count when Chat is **not** the active panel and count > 0; hidden at 0.
- Opening Chat sets `lastOpenedAt = now` → count resets to 0; updates live as new
  messages arrive.
- Style: coral (`FM.coral`) pill, white bold number, ~16px, top-right of the Chat button
  — matches the prototype `.rail-btn .badge`.

## Out of scope / deferred
- **Exit-ticket modal** — still deferred (needs product clarity).
- **Notes / Class unread badges** — not feasible / not meaningful (see Decision 4).
- The standalone CSS reskin file (`fullmind-bbb-base.css`) — separate seam; the rail is
  self-contained and does not depend on it.

## Success criteria
1. Bundle builds (`npm run build-bundle`) + lints clean.
2. The rail renders as a fixed left overlay with the three exact prototype SVG buttons.
3. Clicking a button opens its panel and shrinks the stage (push); clicking again closes
   and restores the stage.
4. BBB's native sidebar is hidden (no duplicate Chat/Notes/Users).
5. Chat button shows a live coral unread badge that clears on open.
6. The BBB-layout selectors + nav offset are a single labeled live-wire block.

## Live-verification checklist (test room)
- Rail sits below the top nav, left edge, three buttons with correct SVGs.
- Open each panel: chat list + send works; roster + talking/muted; notes (set
  `NOTES_PAD_URL`).
- Opening a panel pushes the whiteboard narrower; closing restores it (tune the
  stage selector + width).
- Native sidebar hidden, no duplication (tune the hide selector).
- Chat badge increments on new messages while Chat is closed; clears on open.
