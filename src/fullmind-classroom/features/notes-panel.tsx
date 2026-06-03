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
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, textAlign: 'center', fontFamily: FM.font, color: FM.ink,
    }}
    >
      <div style={{ fontSize: 14, fontWeight: 700 }}>Lesson Notes</div>
      <div style={{ fontSize: 13, color: FM.inkDim, lineHeight: 1.5 }}>
        The educator&apos;s shared notes open in the live room. Use BBB&apos;s Shared
        Notes below.
      </div>
      <button
        type="button"
        onClick={() => pluginApi.uiCommands.sidekickOptionsContainer.open()}
        style={{
          background: FM.coral, color: '#fff', border: 0, borderRadius: 10, padding: '10px 16px', fontFamily: FM.font, fontWeight: 700, cursor: 'pointer',
        }}
      >
        Open Shared Notes
      </button>
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
