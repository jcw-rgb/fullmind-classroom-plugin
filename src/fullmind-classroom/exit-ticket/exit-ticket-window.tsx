import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import { BbbPluginSdk, PluginApi, FloatingWindow } from 'bigbluebutton-html-plugin-sdk';
import { useExitTicket } from './use-exit-ticket';
import { ExitTicketModal } from './exit-ticket-modal';
import { ExitTicketTeacherPanel } from './exit-ticket-teacher-panel';

/**
 * The exit-ticket overlay's content: one FloatingWindow that renders the right view by
 * role/state and nothing while closed. Mirrors session-progress-bar.tsx's
 * FloatingWindow-with-its-own-ReactDOM-root pattern (the proven overlay template), so the
 * SDK data hooks work inside this detached root.
 *
 *   • closed                 → null (registered always; visible only while open)
 *   • open + moderator        → teacher panel (N of M + Close)
 *   • open + viewer + question → student modal
 *   • open + viewer, no question yet → null (waiting for route-in)
 */
function ExitTicketView({ pluginUuid }: { pluginUuid: string }): React.ReactElement | null {
  BbbPluginSdk.initialize(pluginUuid);
  const pluginApi: PluginApi = BbbPluginSdk.getPluginApi(pluginUuid);
  const et = useExitTicket(pluginUuid);

  // Roster size for "N of M" — count viewers (students) in the room.
  const users = pluginApi.useLoadedUserList()?.data ?? [];
  const studentTotal = users.filter((u) => u.role === 'VIEWER').length;

  if (!et.isOpen) return null;
  if (et.isModerator) {
    return (
      <ExitTicketTeacherPanel
        submitted={et.submittedCount}
        total={studentTotal}
        onClose={et.closeTicket}
      />
    );
  }
  if (!et.question) return null;
  return <ExitTicketModal question={et.question} onSubmit={et.submitAnswer} />;
}

export function makeExitTicketWindow(pluginUuid: string): FloatingWindow {
  return new FloatingWindow({
    id: 'fullmind-exit-ticket',
    top: 0,
    left: 0,
    movable: false,
    backgroundColor: 'transparent',
    boxShadow: 'none',
    contentFunction: (element: HTMLElement): ReactDOM.Root => {
      const root = ReactDOM.createRoot(element);
      root.render(<ExitTicketView pluginUuid={pluginUuid} />);
      return root;
    },
  });
}
