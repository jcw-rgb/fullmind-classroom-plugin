import * as React from 'react';
import { useEffect, useState } from 'react';
import * as ReactDOM from 'react-dom/client';
import {
  BbbPluginSdk,
  PluginApi,
  FloatingWindow,
} from 'bigbluebutton-html-plugin-sdk';
import { FM } from './theme';

/**
 * Lesson Hub rail — the prototype's left .iconrail (Chat / Notes / Class), drawn by
 * the plugin as a fixed overlay inside an invisible FloatingWindow. The rail is the
 * SOLE nav: it hides BBB's native combined sidebar and drives BBB's own panels.
 *
 * BBB reality (confirmed from the live DOM): the left column [userListContainer] is a
 * SINGLE sidebar stacking three sections — Messages (chat list), Notes (shared-notes),
 * Users (roster). There are no three separately-toggled panels. So:
 *   • Chat  → pluginApi.uiCommands.chat.form.open()  (SDK; open-only)
 *   • Notes → click BBB's native [data-test="sharedNotesButton"]
 *   • Class → reveal the native sidebar but CSS-hide its Messages + Notes sections,
 *             leaving the roster only (BBB keeps the roster inside this sidebar).
 *
 * Highlight: a single local `active` tab. Because the rail is the only nav (native
 * sidebar hidden), local state is authoritative — exactly one highlight at a time.
 */

// ── BBB layout hooks ─────────────────────────────────────────────────────────
// Confirmed from the live DOM (2026-06-04):
const SIDEBAR_CONTAINER = '[data-test="userListContainer"]'; // the whole Messages/Notes/Users column
const SIDEBAR_CONTENT = '[data-test="userListContent"]';
const MESSAGES_TITLE = '[data-test="messageTitle"]'; // marks the Messages section
const NOTES_TITLE = '[data-test="notesTitle"]'; // marks the Notes section
const SHARED_NOTES_TOGGLE = '[data-test="sharedNotesButton"]'; // opens/closes Shared Notes
// Only appears once the chat panel is open, so confirm live:
const CHAT_CLOSE_SELECTOR = '[data-test="hidePublicChat"], [data-test="closePrivateChat"]'; // CONFIRM

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

// Hide BBB's native combined sidebar by default; the rail is the sole nav. When the
// Class tab is active, reveal the sidebar but hide its Messages + Notes sections via
// :has() so only the roster shows, shifted right of the rail.
const RAIL_LAYOUT_STYLE = `
  body:not(.fm-class-active) ${SIDEBAR_CONTAINER} { display: none !important; }
  body.fm-class-active ${SIDEBAR_CONTAINER} { margin-left: ${RAIL_WIDTH}px !important; }
  body.fm-class-active ${SIDEBAR_CONTENT} > div:has(${MESSAGES_TITLE}),
  body.fm-class-active ${SIDEBAR_CONTENT} > div:has(${NOTES_TITLE}) { display: none !important; }
`;

function clickNative(selector: string): void {
  const el = document.querySelector<HTMLElement>(selector);
  if (el) el.click();
}

export function LessonHubView({ pluginUuid }: { pluginUuid: string }): React.ReactElement {
  BbbPluginSdk.initialize(pluginUuid);
  const pluginApi: PluginApi = BbbPluginSdk.getPluginApi(pluginUuid);

  // Single local active tab — authoritative because the rail is the only nav.
  const [active, setActive] = useState<Tab | null>(null);
  const [lastChatOpenedAt, setLastChatOpenedAt] = useState<number>(() => Date.now());

  // Class tab drives a body class that reveals the roster-only native sidebar.
  useEffect(() => {
    document.body.classList.toggle('fm-class-active', active === 'class');
    return () => document.body.classList.remove('fm-class-active');
  }, [active]);

  // Unread badge: messages since Chat was last opened.
  const chatResponse = pluginApi.useLoadedChatMessages();
  const messages = chatResponse?.data ?? [];
  const unread = active === 'chat'
    ? 0
    : messages.filter((m) => parseTime(m.createdAt) > lastChatOpenedAt).length;

  // Open/close BBB's native panel for a tab. Class is CSS-only (handled by the effect).
  const openNative = (tab: Tab): void => {
    if (tab === 'chat') {
      pluginApi.uiCommands.chat.form.open();
      setLastChatOpenedAt(Date.now());
    } else if (tab === 'notes') {
      clickNative(SHARED_NOTES_TOGGLE);
    }
  };
  const closeNative = (tab: Tab): void => {
    if (tab === 'chat') clickNative(CHAT_CLOSE_SELECTOR);
    else if (tab === 'notes') clickNative(SHARED_NOTES_TOGGLE); // toggles off
  };

  const handleClick = (tab: Tab): void => {
    setActive((cur) => {
      if (cur === tab) { // clicking the active tab closes it
        closeNative(tab);
        return null;
      }
      if (cur) closeNative(cur); // switching tabs: close the previous panel
      openNative(tab);
      return tab;
    });
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
