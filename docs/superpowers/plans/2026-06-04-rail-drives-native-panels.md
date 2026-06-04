# Rail → native-BBB launcher — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Flip the Lesson Hub rail from rebuilding chat/notes/class to *launching* BBB's native panels (reskinned by the existing CSS), removing the two-chat duplication.

**Architecture:** `lesson-hub-rail.tsx` becomes a thin 64px launcher. Chat opens via `pluginApi.uiCommands.chat.form.open()`; Class/Notes DOM-click BBB's native toggles. Active highlights read native UI-data (`USER_LIST_IS_OPEN`, `CURRENT_ELEMENT`); Chat highlight is best-effort click-tracking. The rail injects one `<style>` that shifts BBB's sidebar +64px and hides BBB's native chat/user-list toggles. The three rebuilt panel files are deleted.

**Tech Stack:** TypeScript + React, `bigbluebutton-html-plugin-sdk` 0.0.73, webpack. No unit-test framework in this repo — verification is `tsc --noEmit` + `eslint` + `npm run build-bundle` + `npm run preview` smoke + live-room confirmation (matches the repo's existing verification pattern; we do **not** add a test framework).

**Note on `// CONFIRM IN LIVE ROOM`:** selectors that can only be verified in a live BBB room ship with best-guess `data-test` defaults and this marker. Task 6 tunes them in the test room.

---

### Task 1: Rewrite `lesson-hub-rail.tsx` as a native-panel launcher

**Files:**
- Modify: `src/fullmind-classroom/features/lesson-hub-rail.tsx` (full rewrite of the view; `makeLessonHubWindow` factory unchanged)

- [ ] **Step 1: Replace the file contents**

Replace the entire file with:

```tsx
import * as React from 'react';
import { useEffect, useState } from 'react';
import * as ReactDOM from 'react-dom/client';
import {
  BbbPluginSdk,
  PluginApi,
  FloatingWindow,
  UserListUiDataNames,
  LayoutPresentatioAreaUiDataNames,
  UiLayouts,
} from 'bigbluebutton-html-plugin-sdk';
import { FM } from './theme';

/**
 * Lesson Hub rail — the prototype's left .iconrail (Chat / Notes / Class), drawn by
 * the plugin as a fixed-position overlay inside an invisible FloatingWindow. The rail
 * does NOT rebuild the panels: each button LAUNCHES BBB's own native panel, which the
 * Fullmind CSS reskins. One chat, not two.
 *   • Chat  → pluginApi.uiCommands.chat.form.open()  (SDK; open-only)
 *   • Class → click BBB's native [data-test="toggleUserList"]
 *   • Notes → click BBB's native Shared-Notes toggle (CONFIRM selector live)
 * Active highlight: Class/Notes read native UI-data; Chat is best-effort click-tracking
 * (reliable because the native chat/user-list toggles are hidden — see RAIL_LAYOUT_STYLE).
 */

// ── LIVE-WIRE: BBB layout (CONFIRM IN LIVE ROOM) ─────────────────────────────
// Native Shared-Notes toggle to click for the Notes tab. Best guess below.
const SHARED_NOTES_TOGGLE = '[data-test="sharedNotesButton"]'; // CONFIRM
// Native chat panel close control, for Chat toggle parity (chat.form.open is open-only).
const CHAT_CLOSE_SELECTOR = '[data-test="closePrivateChat"], [data-test="hidePublicChat"]'; // CONFIRM
// BBB's sidebar/panel container to shift right by the rail width so it sits beside us.
const NATIVE_SIDEBAR_CONTAINER = '[data-test="userListContent"]'; // CONFIRM (the panel column)
// Native toggles to hide so the rail is the single nav (still .click()-able while hidden).
const NATIVE_USERLIST_TOGGLE = '[data-test="toggleUserList"]'; // CONFIRM
const NATIVE_CHAT_TOGGLE = '[data-test="chatButton"]'; // CONFIRM

const RAIL_TOP = 92; // CONFIRM (BBB nav height in px)
const RAIL_WIDTH = 64; // prototype .iconrail width

type Tab = 'chat' | 'notes' | 'class';
const TABS: Tab[] = ['chat', 'notes', 'class'];
const LABELS: Record<Tab, string> = { chat: 'Chat', notes: 'Notes', class: 'Class' };

const svgProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  style: { width: 22, height: 22 },
};
const ICONS: Record<Tab, React.ReactElement> = {
  chat: (<svg {...svgProps}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>),
  notes: (
    <svg {...svgProps}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M9 13h6M9 17h4" />
    </svg>
  ),
  class: (
    <svg {...svgProps}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
};

// createdAt is a string in the SDK type; format unconfirmed (epoch-ms string or ISO).
function parseTime(v: string): number {
  const n = Number(v);
  if (Number.isFinite(n) && n > 1e11) return n; // epoch ms (~13 digits)
  if (Number.isFinite(n) && n > 1e8) return n * 1000; // epoch seconds (~10 digits)
  return Date.parse(v); // ISO 8601
}

// Shift BBB's native sidebar beside the rail; hide BBB's native chat/user-list toggles
// so the rail is the single nav. display:none still allows programmatic .click().
const RAIL_LAYOUT_STYLE = `
  ${NATIVE_SIDEBAR_CONTAINER} { margin-left: ${RAIL_WIDTH}px !important; }
  ${NATIVE_USERLIST_TOGGLE}, ${NATIVE_CHAT_TOGGLE} { display: none !important; }
`;

function clickNative(selector: string): void {
  const el = document.querySelector<HTMLElement>(selector);
  if (el) el.click();
}

export function LessonHubView({ pluginUuid }: { pluginUuid: string }): React.ReactElement {
  BbbPluginSdk.initialize(pluginUuid);
  const pluginApi: PluginApi = BbbPluginSdk.getPluginApi(pluginUuid);

  // Best-effort chat-open tracking (no SDK is-open read for chat).
  const [chatOpen, setChatOpen] = useState(false);
  const [lastChatOpenedAt, setLastChatOpenedAt] = useState<number>(() => Date.now());

  // Native panel state (clean reads).
  const userList = pluginApi.useUiData(UserListUiDataNames.USER_LIST_IS_OPEN, { value: false });
  const presentationEls = pluginApi.useUiData(LayoutPresentatioAreaUiDataNames.CURRENT_ELEMENT, []);
  const userListOpen = userList?.value ?? false;
  const notesOpen = (presentationEls ?? []).some(
    (e) => e.currentElement === UiLayouts.PINNED_SHARED_NOTES && e.isOpen,
  );

  // Unread badge: messages since Chat was last opened.
  const chatResponse = pluginApi.useLoadedChatMessages();
  const messages = chatResponse?.data ?? [];
  const unread = chatOpen ? 0 : messages.filter((m) => parseTime(m.createdAt) > lastChatOpenedAt).length;

  const isActive = (tab: Tab): boolean => {
    if (tab === 'chat') return chatOpen;
    if (tab === 'class') return userListOpen;
    return notesOpen;
  };

  const handleClick = (tab: Tab): void => {
    if (tab === 'chat') {
      if (chatOpen) {
        clickNative(CHAT_CLOSE_SELECTOR);
        setChatOpen(false);
      } else {
        pluginApi.uiCommands.chat.form.open();
        setChatOpen(true);
        setLastChatOpenedAt(Date.now());
      }
      return;
    }
    if (tab === 'class') clickNative(NATIVE_USERLIST_TOGGLE);
    else clickNative(SHARED_NOTES_TOGGLE);
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        top: RAIL_TOP,
        bottom: 0,
        display: 'flex',
        zIndex: 20,
        fontFamily: FM.font,
      }}
    >
      <style>{RAIL_LAYOUT_STYLE}</style>

      <div
        style={{
          width: RAIL_WIDTH,
          background: FM.gray100,
          borderRight: `1px solid ${FM.line}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
          padding: '12px 0',
        }}
      >
        {TABS.map((tab) => {
          const active = isActive(tab);
          return (
            <button
              key={tab}
              type="button"
              title={LABELS[tab]}
              onClick={() => handleClick(tab)}
              style={{
                position: 'relative',
                width: 56,
                border: 0,
                borderRadius: 12,
                cursor: 'pointer',
                padding: '8px 0 7px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                fontFamily: 'inherit',
                background: active ? FM.coral : 'transparent',
                color: active ? '#fff' : FM.ink2,
                boxShadow: active ? '0 6px 14px -6px rgba(243,113,103,.6)' : 'none',
              }}
            >
              {ICONS[tab]}
              <span style={{ fontSize: 9, fontWeight: 700 }}>{LABELS[tab]}</span>
              {tab === 'chat' && unread > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 6,
                    minWidth: 16,
                    height: 16,
                    borderRadius: 999,
                    background: FM.coral,
                    color: '#fff',
                    fontSize: 9,
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 4px',
                    border: `2px solid ${FM.gray100}`,
                  }}
                >
                  {unread}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function makeLessonHubWindow(pluginUuid: string): FloatingWindow {
  return new FloatingWindow({
    id: 'fullmind-lesson-hub',
    top: 0,
    left: 0,
    movable: false,
    backgroundColor: 'transparent',
    boxShadow: 'none',
    contentFunction: (element: HTMLElement): ReactDOM.Root => {
      const root = ReactDOM.createRoot(element);
      root.render(<LessonHubView pluginUuid={pluginUuid} />);
      return root;
    },
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `git branch --show-current` (confirm it matches the working branch), then `npx tsc --noEmit`
Expected: zero errors. (The three deleted-in-Task-2 panel files still exist and still compile here — fine.)

- [ ] **Step 3: Commit**

```bash
git add src/fullmind-classroom/features/lesson-hub-rail.tsx
git commit -m "refactor(rail): launch BBB native panels instead of rebuilding them"
```

---

### Task 2: Delete the rebuilt panel files and prune now-unused theme tokens

**Files:**
- Delete: `src/fullmind-classroom/features/chat-panel.tsx`
- Delete: `src/fullmind-classroom/features/class-panel.tsx`
- Delete: `src/fullmind-classroom/features/notes-panel.tsx`
- Modify: `src/fullmind-classroom/features/theme.ts` (remove tokens no longer referenced)

- [ ] **Step 1: Delete the three panel files**

```bash
git rm src/fullmind-classroom/features/chat-panel.tsx \
       src/fullmind-classroom/features/class-panel.tsx \
       src/fullmind-classroom/features/notes-panel.tsx
```

- [ ] **Step 2: Find theme tokens that are now unreferenced**

Run (for each `FM.<token>` key defined in `theme.ts`, count uses across `src/`):

```bash
for k in $(grep -oE '^\s*[a-zA-Z0-9]+:' src/fullmind-classroom/features/theme.ts | tr -d ' :'); do
  echo "$k -> $(grep -rho "FM\.$k\b" src --include=*.tsx --include=*.ts | wc -l | tr -d ' ')";
done
```
Expected: a list like `coral -> 5`, `sunken -> 0`. Any token with `-> 0` is now dead.

- [ ] **Step 3: Remove the dead tokens from `theme.ts`**

Delete only the lines whose count was `0` in Step 2. (Net-line discipline — manager rule #3.) Leave all still-referenced tokens untouched.

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: zero errors. (`lint` script targets `src/index.tsx` + `src/fullmind-classroom`; the deleted files are gone, the rail + theme compile and lint clean.)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(rail): delete rebuilt chat/notes/class panels + prune dead theme tokens"
```

---

### Task 3: Update the preview mock SDK so the launcher renders against it

**Files:**
- Modify: `src/preview/mock-sdk.tsx`

The rail now calls `pluginApi.uiCommands.chat.form.open()` and `pluginApi.useUiData(...)`. The mock must expose both, or the preview throws.

- [ ] **Step 1: Add `useUiData` and `chat.form.open` to the mock API**

In `makeMockApi()`, add a `useUiData` method and extend `uiCommands`. Replace the `uiCommands` block and add `useUiData` alongside the existing `useLoadedChatMessages` etc.:

```tsx
    // Returns the provided default — preview has no live native panel state.
    useUiData: (_name: string, defaultValue: unknown) => defaultValue,

    uiCommands: {
      chat: {
        form: {
          open: () => console.log('[mock-sdk] uiCommands.chat.form.open'),
          fill: (args: unknown) => console.log('[mock-sdk] uiCommands.chat.form.fill', args),
        },
      },
      sidekickOptionsContainer: {
        open:  (args: unknown) => console.log('[mock-sdk] uiCommands.sidekickOptionsContainer.open', args),
        close: (args: unknown) => console.log('[mock-sdk] uiCommands.sidekickOptionsContainer.close', args),
      },
    },
```

- [ ] **Step 2: Add no-op enum exports the rail imports**

The rail imports `UserListUiDataNames`, `LayoutPresentatioAreaUiDataNames`, `UiLayouts` from the SDK alias. Add to the bottom of `mock-sdk.tsx`:

```tsx
export enum UserListUiDataNames { USER_LIST_IS_OPEN = 'USER_LIST_IS_OPEN' }
export enum LayoutPresentatioAreaUiDataNames { CURRENT_ELEMENT = 'CURRENT_ELEMENT' }
export enum UiLayouts {
  PINNED_SHARED_NOTES = 'PINNED_SHARED_NOTES',
  EXTERNAL_VIDEO = 'EXTERNAL_VIDEO',
  SCREEN_SHARE = 'SCREEN_SHARE',
  WHITEBOARD = 'WHITEBOARD',
  GENERIC_CONTENT = 'GENERIC_CONTENT',
}
```

- [ ] **Step 3: Update the mock's header comment**

The file header says it "Exports every name that chat-panel.tsx, class-panel.tsx, and notes-panel.tsx import." Those files are deleted. Replace that line with: "Exports every name the LessonHub rail + session progress bar import."

- [ ] **Step 4: Smoke-test the preview**

Run: `npm run preview` (serves on http://localhost:4702), then open it.
Expected: the 64px rail renders with three buttons; clicking logs `[mock-sdk] uiCommands.chat.form.open` (Chat) and does nothing visible for Class/Notes (no native DOM in preview — `clickNative` finds nothing, no crash). No console errors. Stop the server (Ctrl-C) when confirmed.

- [ ] **Step 5: Commit**

```bash
git add src/preview/mock-sdk.tsx
git commit -m "chore(preview): mock useUiData + chat.form.open for the launcher rail"
```

---

### Task 4: Update the features README to match the new architecture

**Files:**
- Modify: `src/fullmind-classroom/features/README.md`

- [ ] **Step 1: Rewrite the stale sections**

Update these specifics so the doc matches the code:
- The intro line "draws its own fixed-position overlay (the Lesson Hub rail) rather than using BBB's native sidekick panels" → the rail is now a **launcher** for BBB's native panels.
- The feature table: remove the `chat-panel.tsx`, `notes-panel.tsx`, `class-panel.tsx` rows (deleted). Keep the `lesson-hub-rail.tsx` row; change its surface description to "launches BBB native Chat/Notes/Class panels."
- "Architecture" section: the rail no longer has a sliding 264px panel; it injects a `<style>` that shifts BBB's sidebar +64px and hides BBB's native chat/user-list toggles.
- "Live-wire constants" table: replace `NOTES_PAD_URL`/`NATIVE_SIDEBAR_SELECTOR`/`STAGE_SELECTOR` rows with the new constants: `SHARED_NOTES_TOGGLE`, `CHAT_CLOSE_SELECTOR`, `NATIVE_SIDEBAR_CONTAINER`, `NATIVE_USERLIST_TOGGLE`, `NATIVE_CHAT_TOGGLE`, `RAIL_TOP`.
- "Live-verification checklist": update to: Chat button opens BBB's native chat (Fullmind-styled, single chat — no duplicate); Class opens native user list; Notes opens native shared notes; native chat/user-list toggles are hidden; rail sits beside the native panel (no overlap/gap); Chat badge increments while closed, clears on open.

- [ ] **Step 2: Commit**

```bash
git add src/fullmind-classroom/features/README.md
git commit -m "docs(rail): README reflects launcher architecture (native panels, not rebuilt)"
```

---

### Task 5: Build the production bundle and verify the full gate

**Files:**
- Modify: `manifest.json` (version bump)

- [ ] **Step 1: Bump the manifest version**

In `manifest.json`, change `"version": "0.0.4"` → `"version": "0.0.5"`. (DEV-HANDOFF: bump on every bundle change so BBB busts the cached JS.)

- [ ] **Step 2: Full verification gate**

Run: `npx tsc --noEmit && npm run lint && npm run build-bundle`
Expected: tsc zero errors; lint zero errors (pre-existing warnings tolerable); webpack writes `dist/FullmindClassroom.js` + `dist/manifest.json` with no build errors.

- [ ] **Step 3: Commit**

```bash
git add manifest.json dist/
git commit -m "build(rail): bundle v0.0.5 — native-panel launcher"
```

---

### Task 6: Tune live-wire selectors in the test room (BLOCKED on a fresh session token)

**Prerequisite:** Justin re-joins the test room from the LMS and pastes the fresh
`https://bbb0-v3.fullmindlearning.com/html5client/?sessionToken=…` URL. The plugin must
already load in that room (S3 + vidapi gating per `DEV-HANDOFF.md`), and
`fullmind-bbb-base.css` must be applied.

**Files:**
- Modify: `src/fullmind-classroom/features/lesson-hub-rail.tsx` (the `// CONFIRM` constants only)

- [ ] **Step 1: Inspect the native DOM**

In the live room (Puppeteer or DevTools), capture the real attributes for: the Shared-Notes toggle, the chat-panel close control, the sidebar/panel container, the user-list toggle, the chat toggle, and BBB's nav bar height (for `RAIL_TOP`). Prefer `data-test` hooks.

- [ ] **Step 2: Update each `// CONFIRM` constant to the verified selector**

Edit `SHARED_NOTES_TOGGLE`, `CHAT_CLOSE_SELECTOR`, `NATIVE_SIDEBAR_CONTAINER`, `NATIVE_USERLIST_TOGGLE`, `NATIVE_CHAT_TOGGLE`, `RAIL_TOP` to the confirmed values. Remove the `// CONFIRM` marker from any line that is now verified.

- [ ] **Step 3: Verify behavior against the spec's success criteria**

Confirm in the room: exactly one chat (no duplicate); each rail button opens the matching native panel; native toggles hidden; rail sits beside the native panel with no overlap/gap; Class/Notes highlights track native state; Chat highlight tracks rail clicks; Chat badge increments/clears.

- [ ] **Step 4: Rebuild + bump + commit**

```bash
# bump manifest.json version 0.0.5 -> 0.0.6
npx tsc --noEmit && npm run lint && npm run build-bundle
git add -A
git commit -m "fix(rail): tune live-wire selectors confirmed in test room"
```

---

## Self-review notes
- **Spec coverage:** deletions (Task 2), launcher rewrite + highlights + close parity + injected layout style (Task 1), preview mock (Task 3), docs (Task 4), build/bundle (Task 5), live-confirm constants (Task 6). All spec sections covered.
- **No unit tests by design:** repo has no test framework; verification is tsc + lint + build + preview + live room, matching existing practice. Not a placeholder.
- **Type consistency:** `useUiData` default shapes match SDK payloads (`{ value:false }` for USER_LIST_IS_OPEN; `[]` for CURRENT_ELEMENT array). Enum import names match SDK spelling (`LayoutPresentatioAreaUiDataNames`).
