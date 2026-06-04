# Fullmind Lesson Hub Rail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the BBB-native sidekick panels with a plugin-drawn fixed-overlay rail that reproduces the prototype's exact `.iconrail` (custom SVGs, push behavior, coral unread badge), reusing the existing panel Views.

**Architecture:** A single invisible `FloatingWindow` renders a `position:fixed` overlay = the rail (64px, light) + a 264px sliding panel. The component owns open/close + active-tab state and injects a `<style>` that hides BBB's native sidebar and shrinks the stage when a panel is open. Because two floating windows now coexist (progress bar + rail), the progress bar is refactored to expose its window descriptor and one registrar owns `setFloatingWindows`.

**Tech Stack:** TypeScript, React 18, `bigbluebutton-html-plugin-sdk` 0.0.73, webpack, eslint.

**Verification model:** No unit tests (no harness; SDK hooks only resolve in a live room). Each task verifies with `npm run build-bundle` (succeed) + `npm run lint` (clean), then commits. Visual/behavioral checks happen in the preview (Task 4) and the live room.

**Spec:** `docs/superpowers/specs/2026-06-03-fullmind-lesson-hub-rail-design.md`
**Visual reference:** `../../../Prototype_01_2026-06-02_bbb-toolbar.html` (rail CSS: `.iconrail` L103, `.rail-btn` L104-110, panel `.sp-head` L116-118).

---

### Task 1: Remove the sidekick approach

**Files:**
- Delete: `src/fullmind-classroom/features/register-panels.tsx`
- Modify: `src/fullmind-classroom/features/chat-panel.tsx` (remove `makeChatArea` + now-unused imports)
- Modify: `src/fullmind-classroom/features/class-panel.tsx` (remove `makeClassArea`)
- Modify: `src/fullmind-classroom/features/notes-panel.tsx` (remove `makeNotesArea`)
- Modify: `src/fullmind-classroom/component-working.tsx` (remove `RegisterPanels` import + sibling)

- [ ] **Step 1: Delete the sidekick hub**

```bash
git rm src/fullmind-classroom/features/register-panels.tsx
```

- [ ] **Step 2: Remove the factories, keep the Views**

In each panel file, delete the `make<X>Area` exported function and the now-unused imports (`GenericContentSidekickArea`, `ReactDOM`, and in chat/class `BbbPluginSdk`/`PluginApi` ONLY if they become unused — the Views still use them). KEEP the exported `*PanelView` components untouched. Verify nothing else imports the removed factories: `grep -rn "make.*Area" src/` must return nothing after.

- [ ] **Step 3: Unwire from the working root**

In `component-working.tsx`, remove the `import RegisterPanels from './features/register-panels';` line and the `<RegisterPanels pluginUuid={pluginUuid} />` sibling and its comment line. (Leave foundation, `<SessionProgressBar>`, `<FontSizeReorder />` for now.)

- [ ] **Step 4: Verify build + lint**

Run: `npm run build-bundle && npm run lint`
Expected: build succeeds; lint clean. `grep -rn "register-panels\|makeChatArea\|makeClassArea\|makeNotesArea" src/` returns nothing.

- [ ] **Step 5: Commit**

```bash
git add -u src/fullmind-classroom
git commit -m "refactor(plugin): remove sidekick panel registration (replaced by drawn rail)"
```

---

### Task 2: Add shared tokens for the rail

**Files:**
- Modify: `src/fullmind-classroom/features/theme.ts`

- [ ] **Step 1: Add the two prototype tokens the rail needs**

Add these keys to the `FM` object (match the prototype's `--fm-gray-100` and `--ink-2`):

```ts
  gray100: '#F8F9FA',
  ink2: '#495057',
```

- [ ] **Step 2: Verify + commit**

Run: `npm run build-bundle && npm run lint` (must pass).

```bash
git add src/fullmind-classroom/features/theme.ts
git commit -m "feat(plugin): add gray100 + ink2 tokens for the rail"
```

---

### Task 3: The Lesson Hub rail component

**Files:**
- Create: `src/fullmind-classroom/features/lesson-hub-rail.tsx`

Notes: reuses `ChatPanelView` (needs `pluginUuid`), `ClassPanelView` (needs `pluginUuid`), `NotesPanelView` (no props). The three live-wire constants reach into BBB's hashed layout — tune in the test room. Match the rail/button/panel-header VISUAL values to the prototype (cited above); the code below already encodes them.

- [ ] **Step 1: Create the rail component**

```tsx
import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import * as ReactDOM from 'react-dom/client';
import {
  BbbPluginSdk,
  PluginApi,
  FloatingWindow,
} from 'bigbluebutton-html-plugin-sdk';
import { FM } from './theme';
import { ChatPanelView } from './chat-panel';
import { ClassPanelView } from './class-panel';
import { NotesPanelView } from './notes-panel';

/**
 * Lesson Hub rail — the prototype's left .iconrail (Chat / Notes / Class) drawn by
 * the plugin as a fixed-position overlay inside an invisible FloatingWindow (same
 * trick the Session Progress bar uses). Owns its own open/close + active-tab state.
 * Panel bodies reuse the existing Views. Injects CSS to hide BBB's native sidebar
 * and to push (shrink) the stage when a panel is open.
 */

// ── LIVE-WIRE: BBB layout (CONFIRM IN LIVE ROOM) ─────────────────────────────
// These reach into BBB's hashed layout — tune once in the test room.
//  • NATIVE_SIDEBAR_SELECTOR: BBB's own sidebar/panel column to hide (prefer data-test).
//  • STAGE_SELECTOR: the presentation/stage container to shrink (the "push").
//  • RAIL_TOP: px from the top so the rail sits below BBB's nav bar.
const NATIVE_SIDEBAR_SELECTOR = '[data-test="userListContent"]'; // CONFIRM
const STAGE_SELECTOR = '[data-test="presentationContainer"]'; // CONFIRM
const RAIL_TOP = 92; // CONFIRM (BBB nav height in px)

const RAIL_WIDTH = 64; // prototype .body grid col 1
const PANEL_WIDTH = 264; // prototype .body.panel-open grid col 2

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
  notes: (<svg {...svgProps}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h4" /></svg>),
  class: (<svg {...svgProps}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>),
};

// createdAt is a string in the SDK type; format unconfirmed (epoch-ms string or ISO).
// CONFIRM the format in the test room if the badge count looks wrong.
function parseTime(v: string): number {
  const n = Number(v);
  if (Number.isFinite(n) && n > 1e11) return n; // epoch ms as string
  return Date.parse(v);
}

function railStyle(): string {
  return `
    ${NATIVE_SIDEBAR_SELECTOR} { display: none !important; }
    ${STAGE_SELECTOR} { margin-left: ${RAIL_WIDTH}px !important; transition: margin-left .18s ease; }
    body.fm-hub-open ${STAGE_SELECTOR} { margin-left: ${RAIL_WIDTH + PANEL_WIDTH}px !important; }
  `;
}

function LessonHubView({ pluginUuid }: { pluginUuid: string }): React.ReactElement {
  BbbPluginSdk.initialize(pluginUuid);
  const pluginApi: PluginApi = BbbPluginSdk.getPluginApi(pluginUuid);

  const [active, setActive] = useState<Tab | null>(null);
  const [lastChatOpenedAt, setLastChatOpenedAt] = useState<number>(() => Date.now());

  const chatResponse = pluginApi.useLoadedChatMessages();
  const messages = chatResponse?.data ?? [];

  const unread = useMemo(() => {
    if (active === 'chat') return 0;
    return messages.filter((m) => parseTime(m.createdAt) > lastChatOpenedAt).length;
  }, [messages, lastChatOpenedAt, active]);

  // Toggle the body class that drives the stage push.
  useEffect(() => {
    document.body.classList.toggle('fm-hub-open', active !== null);
    return () => { document.body.classList.remove('fm-hub-open'); };
  }, [active]);

  const handleClick = (tab: Tab) => {
    setActive((cur) => {
      const next = cur === tab ? null : tab;
      if (tab === 'chat' && next === 'chat') setLastChatOpenedAt(Date.now());
      return next;
    });
  };

  let body: React.ReactNode = null;
  if (active === 'chat') body = <ChatPanelView pluginUuid={pluginUuid} />;
  else if (active === 'class') body = <ClassPanelView pluginUuid={pluginUuid} />;
  else if (active === 'notes') body = <NotesPanelView />;

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
      <style>{railStyle()}</style>

      {/* rail (prototype .iconrail) */}
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
          const isActive = active === tab;
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
                background: isActive ? FM.coral : 'transparent',
                color: isActive ? '#fff' : FM.ink2,
                boxShadow: isActive ? '0 6px 14px -6px rgba(243,113,103,.6)' : 'none',
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

      {/* sliding panel (header + reused View body) */}
      {active && (
        <div
          style={{
            width: PANEL_WIDTH,
            background: FM.surface,
            borderRight: `1px solid ${FM.line}`,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '13px 13px 11px',
              borderBottom: `1px solid ${FM.line}`,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 700, color: FM.plum }}>{LABELS[active]}</span>
            <button
              type="button"
              aria-label="Close panel"
              onClick={() => setActive(null)}
              style={{
                border: 0,
                background: 'transparent',
                cursor: 'pointer',
                color: FM.inkDim,
                fontSize: 18,
                lineHeight: 1,
                padding: 2,
              }}
            >
              ×
            </button>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>{body}</div>
        </div>
      )}
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

Note: drop `pluginLogger` from this file's import (only `BbbPluginSdk`, `PluginApi`,
`FloatingWindow` are used here) to keep lint clean.

- [ ] **Step 2: Verify build + lint**

Run: `npm run build-bundle && npm run lint`
Expected: build succeeds; lint clean. (Not wired yet — that's Task 4.)

- [ ] **Step 3: Commit**

```bash
git add src/fullmind-classroom/features/lesson-hub-rail.tsx
git commit -m "feat(plugin): Lesson Hub rail (drawn overlay, exact prototype rail, chat unread badge)"
```

---

### Task 4: Floating-windows hub + progress-bar refactor + wiring + manifest

**Files:**
- Modify: `src/fullmind-classroom/session-progress-bar.tsx` (export window factory; drop self-registration)
- Create: `src/fullmind-classroom/features/register-floating-windows.tsx`
- Modify: `src/fullmind-classroom/component-working.tsx`
- Modify: `manifest.json` (version bump)

This is one coordinated task so the build stays green (the progress-bar refactor and its new consumer land together).

- [ ] **Step 1: Refactor the progress bar to expose its window**

In `src/fullmind-classroom/session-progress-bar.tsx`: keep `SessionProgressView` exactly as-is. Replace the default-exported `SessionProgressBar` registrar component with a named factory that returns its `FloatingWindow` (same config it used internally). Remove the `export default SessionProgressBar` and the old registrar function:

```tsx
export function makeSessionProgressWindow(pluginUuid: string): FloatingWindow {
  return new FloatingWindow({
    id: 'fullmind-session-progress',
    top: 0,
    left: 0,
    movable: false,
    backgroundColor: 'transparent',
    boxShadow: 'none',
    contentFunction: (element: HTMLElement): ReactDOM.Root => {
      const root = ReactDOM.createRoot(element);
      root.render(<SessionProgressView pluginUuid={pluginUuid} />);
      return root;
    },
  });
}
```

Keep the existing imports (`FloatingWindow`, `ReactDOM`, `pluginLogger` if still used; drop `pluginLogger` if now unused to keep lint clean).

- [ ] **Step 2: Create the floating-windows hub**

Create `src/fullmind-classroom/features/register-floating-windows.tsx`:

```tsx
import { useEffect } from 'react';
import { BbbPluginSdk, PluginApi, pluginLogger } from 'bigbluebutton-html-plugin-sdk';
import { makeSessionProgressWindow } from '../session-progress-bar';
import { makeLessonHubWindow } from './lesson-hub-rail';

/**
 * Floating-windows hub — the SINGLE caller of setFloatingWindows. Both overlays
 * (progress bar + Lesson Hub rail) must register in one call, because set* is
 * last-writer-wins per plugin. Renders no DOM of its own.
 */
function RegisterFloatingWindows({ pluginUuid }: { pluginUuid: string }): null {
  BbbPluginSdk.initialize(pluginUuid);
  const pluginApi: PluginApi = BbbPluginSdk.getPluginApi(pluginUuid);

  useEffect(() => {
    pluginLogger.info('[Fullmind] Registering floating windows: progress bar + Lesson Hub rail.');
    pluginApi.setFloatingWindows([
      makeSessionProgressWindow(pluginUuid),
      makeLessonHubWindow(pluginUuid),
    ]);
  }, []);

  return null;
}

export default RegisterFloatingWindows;
```

- [ ] **Step 3: Wire into the working root**

Replace `src/fullmind-classroom/component-working.tsx` with:

```tsx
import * as React from 'react';
import FullmindClassroom from './component';
import RegisterFloatingWindows from './features/register-floating-windows';
import FontSizeReorder from './features/font-size-reorder';

/**
 * FullmindClassroomWorking — the WORKING build of the plugin.
 *
 * Renders the untouched foundation (./component) and layers each feature as a
 * sibling. Each owns a DISTINCT registration surface, so they never clobber:
 *   • foundation              → setOptionsDropdownItems
 *   • RegisterFloatingWindows → setFloatingWindows (progress bar + Lesson Hub rail, ONE call)
 *   • FontSizeReorder         → DOM only
 *
 * Shipped features:
 *   • Lesson Hub rail (Chat / Notes / Class) — ./features/lesson-hub-rail
 *   • Session Progress bar                    — ./session-progress-bar
 *   • Font-size reorder (Settings)            — ./features/font-size-reorder
 */
function FullmindClassroomWorking(
  { pluginUuid }: { pluginUuid: string },
): React.ReactElement {
  return (
    <>
      <FullmindClassroom pluginUuid={pluginUuid} />
      <RegisterFloatingWindows pluginUuid={pluginUuid} />
      <FontSizeReorder />
    </>
  );
}

export default FullmindClassroomWorking;
```

- [ ] **Step 4: Bump the manifest**

In `manifest.json`, change `"version": "0.0.3"` to `"version": "0.0.4"`.

- [ ] **Step 5: Verify build + lint**

Run: `npm run build-bundle && npm run lint`
Expected: build succeeds; lint clean. Confirm `dist/manifest.json` shows `0.0.4`. Confirm `grep -rn "setFloatingWindows" src/` shows exactly ONE functional caller (`register-floating-windows.tsx`).

- [ ] **Step 6: Commit**

```bash
git add src/fullmind-classroom/session-progress-bar.tsx src/fullmind-classroom/features/register-floating-windows.tsx src/fullmind-classroom/component-working.tsx manifest.json
git commit -m "feat(plugin): floating-windows hub (progress bar + rail); wire rail; manifest 0.0.4"
```

---

### Task 5: Update the preview to show the rail

**Files:**
- Modify: `src/preview/preview.tsx`
- Modify: `src/preview/mock-sdk.tsx` (only if a new SDK name is needed)

- [ ] **Step 1: Render the real rail in the preview**

Replace the three-frame layout in `src/preview/preview.tsx` so it renders the actual `LessonHubView` from `../fullmind-classroom/features/lesson-hub-rail` against the mock SDK, on a light-gray page sized to show the rail + an open panel. Export `LessonHubView` from `lesson-hub-rail.tsx` if not already exported (add the `export` keyword to the `function LessonHubView` declaration). The mock SDK already provides `useLoadedChatMessages` / `useLoadedUserList` / `useTalkingIndicator`; ensure `mock-sdk.tsx` also exports `FloatingWindow` (a no-op class) and `pluginLogger` if the rail's module-level imports require them at import time.

Render note: the rail uses `position: fixed; left:0; top:RAIL_TOP`. In the preview that's fine — it pins to the window's left edge. Add a short caption "Mock data · local only" as before.

- [ ] **Step 2: Verify the preview compiles + the shipped build is unaffected**

Run:
```bash
npx webpack --config webpack.preview.js --mode development
npm run build-bundle && npm run lint
```
Expected: preview compiles; shipped build + lint still clean.

- [ ] **Step 3: Commit**

```bash
git add src/preview/preview.tsx src/preview/mock-sdk.tsx src/fullmind-classroom/features/lesson-hub-rail.tsx
git commit -m "chore(preview): render the Lesson Hub rail with mock data"
```

---

### Task 6: Update the features README

**Files:**
- Modify: `src/fullmind-classroom/features/README.md`

- [ ] **Step 1: Rewrite the feature table + registration note**

Update `README.md` to describe the rail architecture: the rail is one floating window drawn as a fixed overlay; the panel bodies are the reused Views; `register-floating-windows.tsx` is the single `setFloatingWindows` caller (progress bar + rail); the three live-wire constants in `lesson-hub-rail.tsx` (`NATIVE_SIDEBAR_SELECTOR`, `STAGE_SELECTOR`, `RAIL_TOP`) plus `NOTES_PAD_URL`; and that the Chat unread badge is real. Replace the old "three sidebar panels via setGenericContentItems" text (no longer true). Keep the live-verification checklist, updated for the rail (rail renders, push works, native sidebar hidden, chat badge clears on open).

- [ ] **Step 2: Commit**

```bash
git add src/fullmind-classroom/features/README.md
git commit -m "docs(plugin): README for the drawn rail architecture + live-wires"
```

---

## Self-review notes (for the implementer)
- **Single setter callers:** after Task 4, `setFloatingWindows` has exactly one functional caller (the hub). `setGenericContentItems` has zero (removed in Task 1). Verify with grep.
- **Views unchanged:** Tasks reuse `ChatPanelView` / `ClassPanelView` / `NotesPanelView` as-is. `ChatPanelView` + `ClassPanelView` take `pluginUuid`; `NotesPanelView` takes none.
- **Live-wires:** four total — `NOTES_PAD_URL` (notes-panel) + `NATIVE_SIDEBAR_SELECTOR` / `STAGE_SELECTOR` / `RAIL_TOP` (lesson-hub-rail). All labeled `CONFIRM IN LIVE ROOM`.
- **Push mechanism:** the injected rule shrinks `STAGE_SELECTOR` via `margin-left`; if BBB's stage doesn't respond to margin, the test-room tuning may switch to `width`/`left` — that's expected fragility, flagged in the spec.
- **createdAt parsing:** the badge parses a string time defensively; confirm the real format in the room if counts look off.
