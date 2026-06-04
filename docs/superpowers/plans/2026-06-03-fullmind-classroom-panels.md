# Fullmind Classroom Panels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three Fullmind-branded sidebar panels (Chat, Notes, Class) + a small font-size reorder to the existing BBB plugin bundle, using the proven template pattern.

**Architecture:** One plugin bundle. The three panels share `setGenericContentItems` (last-writer-wins), so they are registered ONCE from a hub (`register-panels.tsx`); each panel file exports a `make<X>Area(uuid)` factory. The Session Progress bar and foundation are unchanged. The font-size reorder only touches the DOM, so it stays an independent sibling.

**Tech Stack:** TypeScript, React 18, `bigbluebutton-html-plugin-sdk` 0.0.73, webpack (`npm run build-bundle`), eslint (`npm run lint`).

**Verification model:** No unit tests (no harness; SDK hooks only resolve in a live room). Each task verifies with `npm run build-bundle` (must succeed) + `npm run lint` (clean), then commits. Behavioral checks happen later via the live-room checklist in the spec.

**Spec:** `docs/superpowers/specs/2026-06-03-fullmind-classroom-plugins-design.md`

---

### Task 1: Shared theme tokens

**Files:**
- Create: `src/fullmind-classroom/features/theme.ts`

- [ ] **Step 1: Create the theme module**

```ts
// Fullmind brand tokens shared across the plugin panel features.
// Mirrors KNOWLEDGE.md §5 + the design system. The Session Progress bar keeps its
// own local copy (its documented self-contained choice); the new panels import these.
export const FM = {
  plum: '#403770',
  plumDeep: '#272244',
  coral: '#F37167',
  coralActive: '#EC2213',
  ink: '#212529',
  inkDim: '#6C757D',
  offwhite: '#FFFCFA',
  line: '#E6EAEE',
  surface: '#FFFFFF',
  sunken: '#F4F7F9',
  steel: '#6EA3BE',
  success: '#198754',
  warning: '#FFC107',
  font: '"Plus Jakarta Sans", system-ui, -apple-system, sans-serif',
};
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build-bundle`
Expected: build succeeds (theme.ts isn't imported yet, but must not break the build).

- [ ] **Step 3: Commit**

```bash
git add src/fullmind-classroom/features/theme.ts
git commit -m "feat(plugin): shared Fullmind brand tokens for panel features"
```

---

### Task 2: Chat panel

**Files:**
- Create: `src/fullmind-classroom/features/chat-panel.tsx`

Notes: messages from `useLoadedChatMessages()` carry only `senderUserId`, so names are resolved by joining against `useLoadedUserList()`. Send via `serverCommands.chat.sendPublicChatMessage`. Types are inferred from the SDK return values (do NOT redeclare the SDK's message/user interfaces — that causes assignability errors).

- [ ] **Step 1: Create the chat panel**

```tsx
import * as React from 'react';
import { useMemo, useState } from 'react';
import * as ReactDOM from 'react-dom/client';
import {
  BbbPluginSdk,
  PluginApi,
  GenericContentSidekickArea,
} from 'bigbluebutton-html-plugin-sdk';
import { FM } from './theme';

/**
 * Chat panel — one of the three Fullmind sidebar panels (prototype rail: Chat).
 * Surfaces BBB's native public chat inside a branded Generic Content sidekick panel.
 * Default-to-BBB-behavior: public chat only; BBB lock settings still apply.
 */

// BBB icon-set name (a string). 'chat' is the expected name; if the sidebar button
// shows a fallback glyph in the live room, swap this for a confirmed icon name.
const CHAT_ICON = 'chat';

function ChatPanelView({ pluginUuid }: { pluginUuid: string }): React.ReactElement {
  BbbPluginSdk.initialize(pluginUuid);
  const pluginApi: PluginApi = BbbPluginSdk.getPluginApi(pluginUuid);

  const messagesResponse = pluginApi.useLoadedChatMessages();
  const usersResponse = pluginApi.useLoadedUserList();
  const [draft, setDraft] = useState('');

  const messages = messagesResponse?.data ?? [];
  const users = usersResponse?.data ?? [];

  // Messages carry only senderUserId — resolve display names from the user list.
  const nameById = useMemo(() => {
    const map: Record<string, string> = {};
    users.forEach((u) => { map[u.userId] = u.name; });
    return map;
  }, [users]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    pluginApi.serverCommands.chat.sendPublicChatMessage({
      textMessageInMarkdownFormat: text,
    });
    setDraft('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: FM.font, color: FM.ink }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.length === 0 && (
          <div style={{ color: FM.inkDim, fontSize: 13 }}>No messages yet.</div>
        )}
        {messages.map((m) => (
          <div key={m.messageId} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: FM.steel }}>
              {nameById[m.senderUserId] ?? 'Unknown'}
            </span>
            <span style={{ fontSize: 13, background: FM.sunken, borderRadius: 10, padding: '7px 10px', alignSelf: 'flex-start' }}>
              {m.message}
            </span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, padding: 10, borderTop: `1px solid ${FM.line}` }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
          placeholder="Message the class…"
          aria-label="Message"
          style={{ flex: 1, fontFamily: FM.font, fontSize: 13, padding: '9px 11px', border: `1px solid ${FM.line}`, borderRadius: 10, outline: 'none' }}
        />
        <button
          onClick={send}
          aria-label="Send"
          style={{ background: FM.coral, color: '#fff', border: 0, borderRadius: 10, padding: '0 14px', fontFamily: FM.font, fontWeight: 700, cursor: 'pointer' }}
        >Send</button>
      </div>
    </div>
  );
}

export function makeChatArea(pluginUuid: string): GenericContentSidekickArea {
  return new GenericContentSidekickArea({
    name: 'Chat',
    section: 'Fullmind',
    buttonIcon: CHAT_ICON,
    open: false,
    contentFunction: (element: HTMLElement): ReactDOM.Root => {
      const root = ReactDOM.createRoot(element);
      root.render(<ChatPanelView pluginUuid={pluginUuid} />);
      return root;
    },
  });
}
```

- [ ] **Step 2: Verify build + lint**

Run: `npm run build-bundle && npm run lint`
Expected: build succeeds; lint clean (file isn't wired in yet — that's Task 6).

- [ ] **Step 3: Commit**

```bash
git add src/fullmind-classroom/features/chat-panel.tsx
git commit -m "feat(plugin): Chat sidebar panel (live public chat + send)"
```

---

### Task 3: Class panel

**Files:**
- Create: `src/fullmind-classroom/features/class-panel.tsx`

Notes: roster from `useLoadedUserList()` (`{userId, name, role}`); live voice state from `useTalkingIndicator()` (`{talking, startTime, muted, userId}`). Map voice by userId. Role `MODERATOR` → "Educator", else "Student".

- [ ] **Step 1: Create the class panel**

```tsx
import * as React from 'react';
import { useMemo } from 'react';
import * as ReactDOM from 'react-dom/client';
import {
  BbbPluginSdk,
  PluginApi,
  GenericContentSidekickArea,
} from 'bigbluebutton-html-plugin-sdk';
import { FM } from './theme';

/**
 * Class panel — one of the three Fullmind sidebar panels (prototype rail: Class).
 * Surfaces BBB's roster: who's here, their role, and live talking/muted state.
 * Default-to-BBB-behavior: same participants BBB shows.
 */

const CLASS_ICON = 'user';

function ClassPanelView({ pluginUuid }: { pluginUuid: string }): React.ReactElement {
  BbbPluginSdk.initialize(pluginUuid);
  const pluginApi: PluginApi = BbbPluginSdk.getPluginApi(pluginUuid);

  const usersResponse = pluginApi.useLoadedUserList();
  const talkingResponse = pluginApi.useTalkingIndicator();

  const users = usersResponse?.data ?? [];
  const voices = talkingResponse?.data ?? [];

  const voiceById = useMemo(() => {
    const map: Record<string, { talking: boolean; muted: boolean }> = {};
    voices.forEach((v) => { map[v.userId] = { talking: v.talking, muted: v.muted }; });
    return map;
  }, [voices]);

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '12px 14px', fontFamily: FM.font, color: FM.ink, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {users.length === 0 && <div style={{ color: FM.inkDim, fontSize: 13 }}>No one here yet.</div>}
      {users.map((u) => {
        const voice = voiceById[u.userId];
        const isEducator = u.role === 'MODERATOR';
        return (
          <div key={u.userId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px', borderRadius: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', flex: 'none', background: voice?.talking ? FM.success : FM.line }} />
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {u.name}
            </span>
            {voice?.muted && (
              <span style={{ fontSize: 10, fontWeight: 700, color: FM.inkDim }}>MUTED</span>
            )}
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.03em', textTransform: 'uppercase', color: isEducator ? FM.plum : FM.steel }}>
              {isEducator ? 'Educator' : 'Student'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function makeClassArea(pluginUuid: string): GenericContentSidekickArea {
  return new GenericContentSidekickArea({
    name: 'Class',
    section: 'Fullmind',
    buttonIcon: CLASS_ICON,
    open: false,
    contentFunction: (element: HTMLElement): ReactDOM.Root => {
      const root = ReactDOM.createRoot(element);
      root.render(<ClassPanelView pluginUuid={pluginUuid} />);
      return root;
    },
  });
}
```

- [ ] **Step 2: Verify build + lint**

Run: `npm run build-bundle && npm run lint`
Expected: build succeeds; lint clean.

- [ ] **Step 3: Commit**

```bash
git add src/fullmind-classroom/features/class-panel.tsx
git commit -m "feat(plugin): Class sidebar panel (roster + talking/muted state)"
```

---

### Task 4: Notes panel

**Files:**
- Create: `src/fullmind-classroom/features/notes-panel.tsx`

Notes: `NOTES_PAD_URL` is the single live-wire constant — empty until confirmed in the test room. When empty (or the iframe can't load), show a fallback message + a button that opens BBB's native sidekick container (`uiCommands.sidekickOptionsContainer.open()`), where the native Shared Notes lives.

- [ ] **Step 1: Create the notes panel**

```tsx
import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import {
  BbbPluginSdk,
  PluginApi,
  GenericContentSidekickArea,
} from 'bigbluebutton-html-plugin-sdk';
import { FM } from './theme';

/**
 * Notes panel — one of the three Fullmind sidebar panels (prototype rail: Notes).
 * Shows the educator's BBB Shared Notes (Etherpad). Default-to-BBB-behavior: editing
 * + permissions are exactly BBB's; we only surface the same notes in a branded panel.
 *
 * NOTES_PAD_URL is the one live-wire constant: BBB does not hand a plugin the pad URL
 * directly, so confirm it in the test room (open Shared Notes, copy the iframe src),
 * then paste it here. While empty, the panel shows a graceful fallback instead of a
 * blank frame.
 */

// CONFIRM IN LIVE ROOM — the Etherpad pad URL, e.g.
//   https://bbb1-v3.fullmindlearning.com/pad/auth_session?padName=<id>$notes
const NOTES_PAD_URL = '';

const NOTES_ICON = 'copy';

function NotesPanelView({ pluginUuid }: { pluginUuid: string }): React.ReactElement {
  BbbPluginSdk.initialize(pluginUuid);
  const pluginApi: PluginApi = BbbPluginSdk.getPluginApi(pluginUuid);

  if (NOTES_PAD_URL) {
    return (
      <iframe
        title="Lesson Notes"
        src={NOTES_PAD_URL}
        style={{ width: '100%', height: '100%', border: 0 }}
      />
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, textAlign: 'center', fontFamily: FM.font, color: FM.ink }}>
      <div style={{ fontSize: 14, fontWeight: 700 }}>Lesson Notes</div>
      <div style={{ fontSize: 13, color: FM.inkDim, lineHeight: 1.5 }}>
        The educator&apos;s shared notes open in the live room. Use BBB&apos;s Shared
        Notes below.
      </div>
      <button
        onClick={() => pluginApi.uiCommands.sidekickOptionsContainer.open()}
        style={{ background: FM.coral, color: '#fff', border: 0, borderRadius: 10, padding: '10px 16px', fontFamily: FM.font, fontWeight: 700, cursor: 'pointer' }}
      >Open Shared Notes</button>
    </div>
  );
}

export function makeNotesArea(pluginUuid: string): GenericContentSidekickArea {
  return new GenericContentSidekickArea({
    name: 'Notes',
    section: 'Fullmind',
    buttonIcon: NOTES_ICON,
    open: false,
    contentFunction: (element: HTMLElement): ReactDOM.Root => {
      const root = ReactDOM.createRoot(element);
      root.render(<NotesPanelView pluginUuid={pluginUuid} />);
      return root;
    },
  });
}
```

- [ ] **Step 2: Verify build + lint**

Run: `npm run build-bundle && npm run lint`
Expected: build succeeds; lint clean.

- [ ] **Step 3: Commit**

```bash
git add src/fullmind-classroom/features/notes-panel.tsx
git commit -m "feat(plugin): Notes sidebar panel (embed w/ fallback; NOTES_PAD_URL live-wire)"
```

---

### Task 5: Panel registration hub

**Files:**
- Create: `src/fullmind-classroom/features/register-panels.tsx`

Notes: this is the ONLY caller of `setGenericContentItems` in the bundle, so the three panels don't clobber each other. Mount-only effect (empty deps), like the foundation, so it registers once and never thrashes.

- [ ] **Step 1: Create the hub**

```tsx
import { useEffect } from 'react';
import { BbbPluginSdk, PluginApi, pluginLogger } from 'bigbluebutton-html-plugin-sdk';
import { makeChatArea } from './chat-panel';
import { makeNotesArea } from './notes-panel';
import { makeClassArea } from './class-panel';

/**
 * Panel hub — registers the three Fullmind sidebar panels in ONE
 * setGenericContentItems call. Required because set* setters are last-writer-wins
 * per plugin: if each panel called setGenericContentItems itself, only the last
 * would survive. Renders no DOM of its own.
 */
function RegisterPanels({ pluginUuid }: { pluginUuid: string }): null {
  BbbPluginSdk.initialize(pluginUuid);
  const pluginApi: PluginApi = BbbPluginSdk.getPluginApi(pluginUuid);

  useEffect(() => {
    pluginLogger.info('[Fullmind] Registering sidebar panels: Chat, Notes, Class.');
    pluginApi.setGenericContentItems([
      makeChatArea(pluginUuid),
      makeNotesArea(pluginUuid),
      makeClassArea(pluginUuid),
    ]);
    // Register once for the component's life (pluginApi is a stable singleton
    // keyed by uuid on window); re-running would thrash the registration.
  }, []);

  return null;
}

export default RegisterPanels;
```

- [ ] **Step 2: Verify build + lint**

Run: `npm run build-bundle && npm run lint`
Expected: build succeeds; lint clean.

- [ ] **Step 3: Commit**

```bash
git add src/fullmind-classroom/features/register-panels.tsx
git commit -m "feat(plugin): panel hub registers Chat/Notes/Class in one setGenericContentItems"
```

---

### Task 6: Font-size reorder (best-effort DOM tweak)

**Files:**
- Create: `src/fullmind-classroom/features/font-size-reorder.tsx`

Notes: cosmetic. Moves the "%" value node to sit between the `decreaseFontSize` / `increaseFontSize` buttons in Settings → Application. BBB regenerates this DOM with hashed classes, so this is best-effort and defensive: a `MutationObserver` re-applies the move whenever the settings DOM changes, all wrapped in try/catch. It targets the stable `data-test` button hooks, never hashed classes. Independent sibling — uses no shared SDK setter.

- [ ] **Step 1: Create the reorder feature**

```tsx
import { useEffect } from 'react';

/**
 * Font-size reorder — cosmetic. BBB renders the Settings "font size" stepper as
 * [- value +] across separate sibling cells; the prototype puts the value BETWEEN
 * the - and + buttons. CSS can't reorder it (hashed classes), so this nudges the DOM.
 *
 * Best-effort + defensive: anchored on the stable [data-test] button hooks (never
 * hashed classes), re-applied on DOM mutations, and fully wrapped in try/catch so a
 * BBB markup change can never throw into the room.
 */
function FontSizeReorder(): null {
  useEffect(() => {
    const apply = () => {
      try {
        const dec = document.querySelector('[data-test="decreaseFontSize"]');
        const inc = document.querySelector('[data-test="increaseFontSize"]');
        if (!dec || !inc) return;
        const row = dec.parentElement;
        if (!row || dec.parentElement !== inc.parentElement) return;

        // Find the value cell: a sibling that isn't the two buttons and shows "%".
        const valueCell = Array.from(row.children).find(
          (el) => el !== dec && el !== inc && /%/.test(el.textContent ?? ''),
        );
        if (!valueCell) return;

        // Desired order: decrease, value, increase. Only move if not already there.
        if (dec.nextElementSibling !== valueCell) {
          row.insertBefore(valueCell, inc);
        }
      } catch {
        // BBB markup changed shape — never throw into the room.
      }
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}

export default FontSizeReorder;
```

- [ ] **Step 2: Verify build + lint**

Run: `npm run build-bundle && npm run lint`
Expected: build succeeds; lint clean.

- [ ] **Step 3: Commit**

```bash
git add src/fullmind-classroom/features/font-size-reorder.tsx
git commit -m "feat(plugin): best-effort font-size value reorder in Settings"
```

---

### Task 7: Wire features into the working root + bump manifest

**Files:**
- Modify: `src/fullmind-classroom/component-working.tsx` (replace whole file)
- Modify: `manifest.json` (version bump)

- [ ] **Step 1: Replace `component-working.tsx`**

```tsx
import * as React from 'react';
import FullmindClassroom from './component';
import SessionProgressBar from './session-progress-bar';
import RegisterPanels from './features/register-panels';
import FontSizeReorder from './features/font-size-reorder';

/**
 * FullmindClassroomWorking — the WORKING build of the plugin.
 *
 * Renders the untouched foundation (./component) and layers each shipped feature as
 * a sibling. Each component calls BbbPluginSdk.initialize(uuid) (idempotent), and
 * each feature owns a DIFFERENT registration surface, so they never clobber:
 *   • foundation        → setOptionsDropdownItems (proof-of-life menu item)
 *   • progress bar      → setFloatingWindows (its own floating window)
 *   • RegisterPanels    → setGenericContentItems (the three sidebar panels, ONE call)
 *   • FontSizeReorder   → DOM only (no SDK setter)
 *
 * Shipped features:
 *   • Session Progress bar (prototype pin 4) — ./session-progress-bar
 *   • Sidebar panels: Chat / Notes / Class    — ./features/register-panels
 *   • Font-size reorder (Settings)            — ./features/font-size-reorder
 */
function FullmindClassroomWorking(
  { pluginUuid }: { pluginUuid: string },
): React.ReactElement {
  return (
    <>
      <FullmindClassroom pluginUuid={pluginUuid} />
      <SessionProgressBar pluginUuid={pluginUuid} />
      <RegisterPanels pluginUuid={pluginUuid} />
      <FontSizeReorder />
    </>
  );
}

export default FullmindClassroomWorking;
```

- [ ] **Step 2: Bump the manifest version**

In `manifest.json`, change `"version": "0.0.2"` to `"version": "0.0.3"` (busts BBB's cached bundle so the new features load).

- [ ] **Step 3: Verify build + lint**

Run: `npm run build-bundle && npm run lint`
Expected: build succeeds; lint clean. Confirm `dist/FullmindClassroom.js` and `dist/manifest.json` regenerated, and `dist/manifest.json` shows `"version": "0.0.3"`.

- [ ] **Step 4: Commit**

```bash
git add src/fullmind-classroom/component-working.tsx manifest.json
git commit -m "feat(plugin): wire sidebar panels + font-size reorder; bump manifest 0.0.3"
```

---

### Task 8: Feature docs + final verification

**Files:**
- Create: `src/fullmind-classroom/features/README.md`

- [ ] **Step 1: Write the features README**

````markdown
# Fullmind Classroom — plugin features

Each feature is a self-contained file layered as a sibling in
`../component-working.tsx`. Pattern: a `View` component runs the SDK hooks inside its
own ReactDOM root; a `make<X>Area(uuid)` factory wraps it as a sidebar panel.

## Registration (important)
SDK `set*` methods are **last-writer-wins per plugin**. The three panels all use
`setGenericContentItems`, so they are registered together in ONE call from
`register-panels.tsx`. Never call `setGenericContentItems` from a panel file.

| Feature | File | Surface |
|---|---|---|
| Chat panel | `chat-panel.tsx` | sidebar panel (Generic Content) |
| Notes panel | `notes-panel.tsx` | sidebar panel (Generic Content) |
| Class panel | `class-panel.tsx` | sidebar panel (Generic Content) |
| Panel hub | `register-panels.tsx` | `setGenericContentItems` (once) |
| Font-size reorder | `font-size-reorder.tsx` | DOM only |
| Shared tokens | `theme.ts` | — |

## Live-wire constants (confirm in the test room)
- `notes-panel.tsx` → `NOTES_PAD_URL` — the Etherpad pad URL. Empty by default;
  while empty the Notes panel shows a fallback + "Open Shared Notes" button.

## Build & deploy
```bash
npm run build-bundle   # → dist/FullmindClassroom.js + dist/manifest.json
```
Manifest is at `0.0.3`. Upload both `dist/` files to the S3 folder per `DEV-HANDOFF.md`.

## Live-verification checklist
- Chat: messages list renders; typing + Send posts a public message.
- Class: roster matches participants; talking dot + MUTED reflect reality.
- Notes: set `NOTES_PAD_URL`; confirm the educator's notes embed (else fallback shows).
- Sidebar shows three Fullmind buttons (Chat, Notes, Class) under the "Fullmind" section.
- Settings → Application: the "%" value sits between the - and + buttons.
````

- [ ] **Step 2: Final full verification**

Run: `npm run build-bundle && npm run lint`
Expected: build succeeds; lint clean; no errors.

- [ ] **Step 3: Commit**

```bash
git add src/fullmind-classroom/features/README.md
git commit -m "docs(plugin): features README + live-wire + verify checklist"
```

---

## Self-review notes (for the implementer)
- **Type inference:** in the panels, do NOT redeclare the SDK's `LoadedChatMessage` /
  `LoadedUserListData` / `UserVoice` interfaces. Use the inferred types from
  `…?.data ?? []`. Redeclaring causes "not assignable" errors.
- **Icon names** (`chat`, `user`, `copy`) are BBB icon-set strings; if a button shows
  a fallback glyph live, swap the `*_ICON` constant for a confirmed name.
- **Mount-only effects:** every registration `useEffect` has empty deps `[]` — matches
  the foundation, prevents re-registration thrash.
- **One live-wire constant total:** `NOTES_PAD_URL`. Everything else is fully wired.
