import * as React from 'react';
import { useEffect, useState } from 'react';
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
// CONFIRM the format in the test room if the badge count looks wrong.
function parseTime(v: string): number {
  const n = Number(v);
  if (Number.isFinite(n) && n > 1e11) return n; // epoch ms (~13 digits)
  if (Number.isFinite(n) && n > 1e8) return n * 1000; // epoch seconds (~10 digits)
  return Date.parse(v); // ISO 8601
}

// NOTE: margin-left works when the stage container is in normal flow. If BBB's stage
// container is absolutely-positioned, margin-left shifts it right without shrinking its
// width (the right edge overflows). In that case — if the stage shifts but doesn't
// reflow narrower in the test room — switch the rule to width / left / right instead of
// margin-left.
const RAIL_STYLE = `
  ${NATIVE_SIDEBAR_SELECTOR} { display: none !important; }
  ${STAGE_SELECTOR} { margin-left: ${RAIL_WIDTH}px !important; transition: margin-left .18s ease; }
  body.fm-hub-open ${STAGE_SELECTOR} { margin-left: ${RAIL_WIDTH + PANEL_WIDTH}px !important; }
`;

function LessonHubView({ pluginUuid }: { pluginUuid: string }): React.ReactElement {
  BbbPluginSdk.initialize(pluginUuid);
  const pluginApi: PluginApi = BbbPluginSdk.getPluginApi(pluginUuid);

  const [active, setActive] = useState<Tab | null>(null);
  const [lastChatOpenedAt, setLastChatOpenedAt] = useState<number>(() => Date.now());

  const chatResponse = pluginApi.useLoadedChatMessages();
  const messages = chatResponse?.data ?? [];

  // messages is a fresh array reference every render (SDK wrapper), so useMemo would
  // recompute every render anyway. Filter is cheap — plain const is clearer.
  const unread = active === 'chat' ? 0 : messages.filter((m) => parseTime(m.createdAt) > lastChatOpenedAt).length;

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
      <style>{RAIL_STYLE}</style>

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
