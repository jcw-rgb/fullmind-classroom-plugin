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
    <div style={{
      height: '100%', overflowY: 'auto', padding: '12px 14px', fontFamily: FM.font, color: FM.ink, display: 'flex', flexDirection: 'column', gap: 6,
    }}
    >
      {users.length === 0 && <div style={{ color: FM.inkDim, fontSize: 13 }}>No one here yet.</div>}
      {users.map((u) => {
        const voice = voiceById[u.userId];
        const isEducator = u.role === 'MODERATOR';
        return (
          <div
            key={u.userId}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px', borderRadius: 10,
            }}
          >
            <span style={{
              width: 8, height: 8, borderRadius: '50%', flex: 'none', background: voice?.talking ? FM.success : FM.line,
            }}
            />
            <span style={{
              flex: 1, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}
            >
              {u.name}
            </span>
            {voice?.muted && (
              <span style={{ fontSize: 10, fontWeight: 700, color: FM.inkDim }}>MUTED</span>
            )}
            <span style={{
              fontSize: 10, fontWeight: 800, letterSpacing: '.03em', textTransform: 'uppercase', color: isEducator ? FM.plum : FM.steel,
            }}
            >
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
