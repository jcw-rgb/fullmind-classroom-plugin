import * as React from 'react';
import { useState } from 'react';
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
// querySelector returns the first DOM match — closePrivateChat takes priority over hidePublicChat.
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

  // Best-effort chat-open tracking (no SDK is-open read for chat). Known gap: if the
  // user closes the native chat panel via its in-panel ✕ (not the rail button),
  // chatOpen stays true until they click the Chat rail button again. Accepted until
  // the SDK exposes a chat-is-open data hook.
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
  const unread = chatOpen
    ? 0
    : messages.filter((m) => parseTime(m.createdAt) > lastChatOpenedAt).length;

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
