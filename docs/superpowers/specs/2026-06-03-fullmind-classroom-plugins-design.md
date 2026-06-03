# Fullmind Classroom plugins — design

> Status: design for review. Date: 2026-06-03. Branch: `feature/classroom-plugins`.
> Builds on the existing plugin foundation (`component.tsx`) + the shipped Session
> Progress bar. Scope source: `Prototype_01_2026-06-02_bbb-toolbar.html` build
> inventory + `KNOWLEDGE.md` §7 (Plugin SDK) + SDK 0.0.73 type definitions.

## Goal

Build the net-new in-room plugin UI for the Fullmind BBB reskin, using the proven
template pattern, so the room gains the prototype's branded sidebar panels and an
exit-ticket — without reinventing BBB's behavior. CSS reskin is out of scope here.

## Guiding principle

**Default to BBB's current behavior.** Wherever a panel could behave in more than
one way, it does what BBB already does (same collaborative notes, same public-chat
semantics, same roster/permissions). The plugin provides Fullmind-branded surfaces
over BBB's own live data — not new models.

## Architecture

- **One plugin bundle**, each feature a self-contained sibling component — the
  pattern `component-working.tsx` already establishes ("add a feature = drop in one
  more sibling"). Rejected: one-plugin-per-feature (multiple manifests / S3 uploads
  / gates to manage; the single-bundle deploy path is already proven in DEV-HANDOFF).
- **New folder:** `src/fullmind-classroom/features/` holds all new feature files +
  a shared `theme.ts`. The foundation, working root, entry, and the existing
  progress bar are untouched (the progress bar stays self-contained by its own
  documented choice).
- **Build-ready, live-verified later.** Real SDK code that compiles + bundles +
  registers. Any wire that only resolves inside a live room is isolated in ONE
  clearly-labeled `// CONFIRM IN LIVE ROOM` constant per feature (same pattern the
  progress bar used for its GraphQL field names).

## Components

### 1. Chat panel — `features/chat-panel.tsx`
- Registers a `GenericContentSidekickArea` (name "Chat", own `buttonIcon`) →
  Fullmind button in the sidebar that opens the chat panel.
- Renders live public chat from `pluginApi.useLoadedChatMessages()`
  (`{createdAt, message, messageId, senderUserId, messageMetadata}`).
- Sender names: messages carry only `senderUserId`, so names are resolved by
  joining against `pluginApi.useLoadedUserList()` (`{userId, name, role}`).
- Composer sends via `pluginApi.serverCommands.chat.sendPublicChatMessage(
  { textMessageInMarkdownFormat })`.
- Behavior = BBB public chat (no private chat; BBB lock settings still apply).

### 2. Class panel — `features/class-panel.tsx`
- Registers a `GenericContentSidekickArea` (name "Class").
- Roster from `useLoadedUserList()`; live talking/muted state from
  `useTalkingIndicator()` (`{talking, startTime, muted, userId}`).
- Shows each participant: name, role (educator/student), talking + muted state.
  Behavior = BBB user list.

### 3. Notes panel — `features/notes-panel.tsx`
- Registers a `GenericContentSidekickArea` (name "Notes").
- Embeds BBB's native Shared Notes (educator's Etherpad) via an `<iframe>` whose
  src is the live-wire constant `NOTES_PAD_URL` (`// CONFIRM IN LIVE ROOM`).
- Fallback when the URL is unset or the frame fails: a friendly message + a button
  that opens BBB's native Shared Notes (`uiCommands.sidekickOptionsContainer.open()`).
- Editing + permissions stay exactly as BBB does them (default-to-BBB-behavior).

### 4. Exit-ticket modal — `features/exit-ticket-modal.tsx`
- Registers an Options-dropdown item ("Exit ticket") that opens a `FloatingWindow`
  styled as a modal (copies the progress-bar registrar/view/own-ReactDOM-root pattern).
- A couple of quick end-of-lesson questions (e.g. understanding rating + one free-text).
- On submit: branded SUCCESS toast (`uiCommands.notification.send`) + POST to the
  live-wire constant `EXIT_TICKET_SUBMIT_URL` (`// CONFIRM IN LIVE ROOM`; the LMS
  endpoint). Reads `useCurrentUser` + `useMeeting` for context (who / which session).

### 5. Font-size reorder — `features/font-size-reorder.tsx`
- Small DOM tweak: move the "90%" value between the +/− buttons in Settings →
  Application. Cosmetic, lowest priority.

### 6. Shared theme — `features/theme.ts`
- One module exporting the Fullmind brand tokens (plum, coral, ink, font) so the
  new features don't each re-declare them. Existing progress bar left as-is.

## Wiring & build
- `component-working.tsx`: register the new sidebar panels + exit-ticket + font-size
  reorder as siblings (foundation + progress bar stay).
- `manifest.json`: bump `version` `0.0.2 → 0.0.3` (busts BBB's cached bundle).
- `features/README.md`: per-feature notes, the live-wire constants, and verify steps.
- Done = `npm run build-bundle` succeeds + `npm run lint` clean.

## Out of scope (YAGNI)
- XP / levels (removed by request).
- Custom raise-hand / reaction icons (BBB glyph-font / CSS limit, not a plugin).
- Reinvented chat/notes/roster models — BBB behavior is the default.
- The CSS reskin (`fullmind-bbb-base.css`) — separate seam, not this work.

## Success criteria
1. Bundle builds (`npm run build-bundle`) and lints clean.
2. Each feature registers without thrashing (mount-only effects, like the foundation).
3. Three Fullmind buttons appear in the sidebar; each opens its panel.
4. Exit-ticket opens from the Options menu and submits (to the live-wire URL).
5. All live-only wires are single, labeled constants ready for test-room confirmation.

## Live-verification checklist (in the test room, later)
- Chat: messages list + send works.
- Class: roster + talking/muted reflect reality.
- Notes: set `NOTES_PAD_URL`; confirm the educator's notes embed (else fallback).
- Exit-ticket: set `EXIT_TICKET_SUBMIT_URL`; confirm the POST lands in the LMS.
