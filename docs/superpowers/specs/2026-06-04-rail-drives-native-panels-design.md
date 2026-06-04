# Lesson Hub rail → native-BBB launcher (reskin, don't rebuild)

**Date:** 2026-06-04
**Status:** design — awaiting review

## Problem

In the live room there are **two chats**: BBB's native public chat (already reskinned
by `fullmind-bbb-base.css`) and the plugin's own rebuilt chat panel inside the Lesson
Hub rail. The rail (`lesson-hub-rail.tsx`) hides BBB's native sidebar (`display:none`)
and rebuilds Chat / Notes / Class as custom React panels that read BBB data through the
SDK but render their own UI. That is duplication: a Fullmind chat built on top of BBB's
chat, hiding the native chat the CSS just styled.

We want the plugin to **reskin, not rebuild**: keep BBB's native chat / shared notes /
user list — its real hookups, sending, lesson sync, lock settings — and apply the
Fullmind look through the existing CSS overlay. The rail stays as the branded nav, but
it now *launches* BBB's native panels instead of replacing them.

## Goal / success criteria

- Exactly one chat in the room: BBB's native public chat, Fullmind-styled by CSS.
- The 64px Fullmind icon rail (coral active state, unread badge) is preserved as the
  single canonical nav for Chat / Notes / Class.
- Clicking a rail button opens the corresponding **native** BBB panel.
- No custom-rendered chat/notes/class panel bodies remain in the plugin.
- BBB's own chat + user-list toggle buttons are hidden so the rail is the one nav.
- Net lines removed > added (three panel files deleted; rail simplified).

## SDK capability map (verified against SDK 0.0.73 type defs)

| Panel | Open it | Read open-state |
|---|---|---|
| Chat | `pluginApi.uiCommands.chat.form.open()` | none (only input text/focus ui-data) |
| Class (user list) | DOM-click `[data-test="toggleUserList"]` | `useUiData(UserListUiDataNames.USER_LIST_IS_OPEN)` |
| Notes (shared notes) | DOM-click native Shared-Notes button | `useUiData(LayoutPresentatioAreaUiDataNames.CURRENT_ELEMENT) === PINNED_SHARED_NOTES` |

Chat opens cleanly via the SDK. Class and Notes have no open command, so the rail
clicks BBB's own native toggle button (the accepted fragility). In BBB 3.0 shared notes
pins into the **presentation area**, not the sidebar — its open-state is read from
`CURRENT_ELEMENT`, not a sidebar flag.

## Design

### Deletions
- `features/chat-panel.tsx`, `features/class-panel.tsx`, `features/notes-panel.tsx` —
  the rebuilt panel bodies.
- In `lesson-hub-rail.tsx`: the `NATIVE_SIDEBAR_SELECTOR { display:none }` rule, the
  custom `margin-left` stage-push, the `STAGE_SELECTOR`/`body.fm-hub-open` machinery,
  and the sliding-panel container that hosted the deleted bodies. BBB resizes its own
  stage when its native panel opens — we no longer fake the push.

### `lesson-hub-rail.tsx` becomes a launcher
A 64px fixed rail (unchanged look: coral active pill, per-tab SVG icon, label, Chat
unread badge) with three buttons whose `onClick` acts on native BBB:

- **Chat** → `pluginApi.uiCommands.chat.form.open()`
- **Class** → `document.querySelector('[data-test="toggleUserList"]')?.click()`
- **Notes** → `document.querySelector('<SHARED_NOTES_TOGGLE>')?.click()` — selector is a
  `// CONFIRM IN LIVE ROOM` constant.

### Active-state highlight
- **Class** ← `USER_LIST_IS_OPEN` (clean read).
- **Notes** ← `CURRENT_ELEMENT === PINNED_SHARED_NOTES` (clean read).
- **Chat** ← best-effort: rail tracks its own open/close clicks. Reliable because BBB's
  native chat toggle is hidden (below), so the rail is the only entry point.

### Close / toggle semantics
- **Class / Notes**: their native toggle buttons toggle, so a second rail click closes
  the panel — matches the rail's existing toggle behavior.
- **Chat**: `chat.form.open()` only opens (no SDK close). To preserve toggle parity, a
  second Chat click DOM-clicks the native chat panel's close control
  (`// CONFIRM IN LIVE ROOM` selector). If no stable close hook exists live, fall back
  to open-only from the rail and document the asymmetry.

### Unread badge
Kept as-is: reads `useLoadedChatMessages`, counts messages since Chat was last opened,
clears on open. Genuinely additive, reads native data — not part of the duplication.

### Layout coordination (CSS, in `fullmind-bbb-base.css`)
- The rail sits at `left:0`; BBB's native sidebar panel also opens at `left:0`. Shift
  BBB's sidebar/panel container right by the rail width (64px) so the layout reads
  **rail │ native panel │ stage**. Container selector is a `// CONFIRM IN LIVE ROOM`
  hook (prefer a `data-test` attribute).
- Hide BBB's native chat + user-list toggle buttons (`[data-test="toggleUserList"]` and
  the chat toggle — confirm chat's hook live) so the rail is the single nav. The buttons
  are hidden visually only; the rail still programmatically clicks `toggleUserList`, so
  it must stay in the DOM (`display:none` on a wrapper that keeps the button present, or
  hide via a parent — confirm the click still fires on a `display:none` element; if not,
  hide with `visibility/position` off-screen instead).

## Out of scope / follow-on
- **CSS coverage gap.** The CSS provably reskins native *chat* (composer, bubbles,
  avatars, Send, chatTitle). It may not yet style the native *user list* or *shared
  notes* panels. Reskinning those to the Fullmind look is follow-on CSS work — named
  here, not done in this change.
- **CSS delivery.** How `fullmind-bbb-base.css` is applied to the room
  (`bbb_custom_style_url` server config) is unchanged by this work.

## Risks
- DOM-clicking native toggles (Class, Notes) and the chat close control depends on BBB's
  DOM, which can change on an html5-client upgrade. Mitigation: target `data-test` hooks
  where they exist; mark every such selector `// CONFIRM IN LIVE ROOM`; re-verify after
  BBB upgrades.
- `chat.form.open()` is open-only — close parity depends on a stable native close hook
  (see Close semantics).
- The rail and BBB's native sidebar share the left edge; the 64px shift must be verified
  live so they sit side by side without overlap or gap.

## Live-confirm constants (tune once in the test room)
| Constant | What it selects |
|---|---|
| `SHARED_NOTES_TOGGLE` | native Shared-Notes toggle button to click for the Notes tab |
| `CHAT_CLOSE_SELECTOR` | native chat panel close control (for Chat toggle parity) |
| `NATIVE_SIDEBAR_CONTAINER` (CSS) | BBB's sidebar/panel container to shift +64px |
| `NATIVE_CHAT_TOGGLE` (CSS) | native chat toggle button to hide |
| `RAIL_TOP` | px offset so the rail sits below BBB's nav bar (already exists) |
