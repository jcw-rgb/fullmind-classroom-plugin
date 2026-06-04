# Fullmind Classroom plugins — design

> Status: design for review. Date: 2026-06-03. Branch: `feature/classroom-plugins`.
> Builds on the existing plugin foundation (`component.tsx`) + the shipped Session
> Progress bar. Scope source: `Prototype_01_2026-06-02_bbb-toolbar.html` build
> inventory + `KNOWLEDGE.md` §7 (Plugin SDK) + SDK 0.0.73 type definitions.

## Goal

Build the net-new in-room plugin UI for the Fullmind BBB reskin, using the proven
template pattern, so the room gains the prototype's branded sidebar panels —
without reinventing BBB's behavior. CSS reskin is out of scope here. (The
exit-ticket modal is deferred — needs more product clarity first.)

## Guiding principle

**Default to BBB's current behavior.** Wherever a panel could behave in more than
one way, it does what BBB already does (same collaborative notes, same public-chat
semantics, same roster/permissions). The plugin provides Fullmind-branded surfaces
over BBB's own live data — not new models.

## Architecture

- **One plugin bundle**, with a **single registration hub for the panels**. Critical
  SDK constraint (verified in `BbbPluginSdk.js`): the whole bundle is ONE plugin (one
  UUID), and each `set*` method is **last-writer-wins** — calling it replaces the prior
  value. So sibling features that share a setter clobber each other. The three panels
  all use `setGenericContentItems`, so they're registered **exactly once** from one hub
  (`register-panels.tsx`): `setGenericContentItems([chatArea, notesArea, classArea])`.
- **Each panel file exports a `make<X>Area(pluginUuid)` factory** (its
  `GenericContentSidekickArea` + `View`), not self-registration; the hub composes them.
- **The Session Progress bar stays untouched.** It's the only `setFloatingWindows`
  user, so no collision — it keeps self-registering. (Features that don't share a
  setter stay independent siblings: the font-size reorder only touches the DOM.)
- **New folder:** `src/fullmind-classroom/features/` holds the panel files, the
  font-size reorder, a shared `theme.ts`, and the panel hub.
- **Build-ready, live-verified later.** Real SDK code that compiles + bundles +
  registers. Any wire that only resolves inside a live room is isolated in ONE
  clearly-labeled `// CONFIRM IN LIVE ROOM` constant per feature (same pattern the
  progress bar used for its GraphQL field names).
- **Verification = build + lint + live-room checklist, not unit tests.** The repo has
  no test harness, and the SDK data hooks are window-event-bridged (only resolve
  inside a running room), so they aren't unit-testable from outside. Adding a full
  mock-the-SDK test framework contradicts "minimum code" + "follow existing patterns"
  (the progress bar shipped the same way). This is a deliberate, surfaced deviation
  from default TDD, consistent with the "build-ready, live-verified later" choice.

## Components

> Each panel file exports a `make<X>Area(pluginUuid)` factory returning a
> `GenericContentSidekickArea` + its `View` component. The hub
> (`register-panels.tsx`) composes them into the single `setGenericContentItems`
> call — no panel self-registers.

### 0. Panel hub — `features/register-panels.tsx`
- A component that, in a mount-only effect, calls `setGenericContentItems` ONCE with
  the three panel areas: `setGenericContentItems([makeChatArea(uuid),
  makeNotesArea(uuid), makeClassArea(uuid)])`. Renders null.

### 1. Chat panel — `features/chat-panel.tsx`
- Exports `makeChatArea(pluginUuid)` → `GenericContentSidekickArea` (name "Chat",
  own `buttonIcon`) → Fullmind button in the sidebar that opens the chat panel.
- Renders live public chat from `pluginApi.useLoadedChatMessages()`
  (`{createdAt, message, messageId, senderUserId, messageMetadata}`).
- Sender names: messages carry only `senderUserId`, so names are resolved by
  joining against `pluginApi.useLoadedUserList()` (`{userId, name, role}`).
- Composer sends via `pluginApi.serverCommands.chat.sendPublicChatMessage(
  { textMessageInMarkdownFormat })`.
- Behavior = BBB public chat (no private chat; BBB lock settings still apply).

### 2. Class panel — `features/class-panel.tsx`
- Exports `makeClassArea(pluginUuid)` → `GenericContentSidekickArea` (name "Class").
- Roster from `useLoadedUserList()`; live talking/muted state from
  `useTalkingIndicator()` (`{talking, startTime, muted, userId}`).
- Shows each participant: name, role (educator/student), talking + muted state.
  Behavior = BBB user list.

### 3. Notes panel — `features/notes-panel.tsx`
- Exports `makeNotesArea(pluginUuid)` → `GenericContentSidekickArea` (name "Notes").
- Embeds BBB's native Shared Notes (educator's Etherpad) via an `<iframe>` whose
  src is the live-wire constant `NOTES_PAD_URL` (`// CONFIRM IN LIVE ROOM`).
- Fallback when the URL is unset or the frame fails: a friendly message + a button
  that opens BBB's native Shared Notes (`uiCommands.sidekickOptionsContainer.open()`).
- Editing + permissions stay exactly as BBB does them (default-to-BBB-behavior).

### 4. Font-size reorder — `features/font-size-reorder.tsx`
- Small DOM tweak: move the "90%" value between the +/− buttons in Settings →
  Application. Cosmetic, lowest priority. Independent sibling (DOM only, no shared
  setter), so it self-mounts in `component-working.tsx`.

### 5. Shared theme — `features/theme.ts`
- One module exporting the Fullmind brand tokens (plum, coral, ink, font) so the
  new features don't each re-declare them. Existing progress bar left as-is.

## Wiring & build
- `component-working.tsx`: render the foundation + progress bar (both unchanged) +
  the panel hub `<RegisterPanels>` + the independent `<FontSizeReorder>` sibling.
- `manifest.json`: bump `version` `0.0.2 → 0.0.3` (busts BBB's cached bundle).
- `features/README.md`: per-feature notes, the live-wire constant, and verify steps.
- Done = `npm run build-bundle` succeeds + `npm run lint` clean.

## Out of scope (YAGNI / deferred)
- **Exit-ticket modal** — deferred; needs more product clarity (questions, where the
  data goes) before building.
- XP / levels (removed by request).
- Custom raise-hand / reaction icons (BBB glyph-font / CSS limit, not a plugin).
- Reinvented chat/notes/roster models — BBB behavior is the default.
- The CSS reskin (`fullmind-bbb-base.css`) — separate seam, not this work.

## Success criteria
1. Bundle builds (`npm run build-bundle`) and lints clean.
2. Each feature registers without thrashing (mount-only effects, like the foundation).
3. Three Fullmind buttons appear in the sidebar; each opens its panel.
4. The single live-only wire (`NOTES_PAD_URL`) is a labeled constant ready for
   test-room confirmation.

## Live-verification checklist (in the test room, later)
- Chat: messages list + send works.
- Class: roster + talking/muted reflect reality.
- Notes: set `NOTES_PAD_URL`; confirm the educator's notes embed (else fallback).
