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
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%', fontFamily: FM.font, color: FM.ink,
    }}
    >
      <div style={{
        flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10,
      }}
      >
        {messages.length === 0 && (
          <div style={{ color: FM.inkDim, fontSize: 13 }}>No messages yet.</div>
        )}
        {messages.map((m) => (
          <div key={m.messageId} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: FM.steel }}>
              {nameById[m.senderUserId] ?? 'Unknown'}
            </span>
            <span style={{
              fontSize: 13, background: FM.sunken, borderRadius: 10, padding: '7px 10px', alignSelf: 'flex-start',
            }}
            >
              {m.message}
            </span>
          </div>
        ))}
      </div>
      <div style={{
        display: 'flex', gap: 8, padding: 10, borderTop: `1px solid ${FM.line}`,
      }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
          placeholder="Message the class…"
          aria-label="Message"
          style={{
            flex: 1, fontFamily: FM.font, fontSize: 13, padding: '9px 11px', border: `1px solid ${FM.line}`, borderRadius: 10, outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={send}
          aria-label="Send"
          style={{
            background: FM.coral, color: '#fff', border: 0, borderRadius: 10, padding: '0 14px', fontFamily: FM.font, fontWeight: 700, cursor: 'pointer',
          }}
        >
          Send
        </button>
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
