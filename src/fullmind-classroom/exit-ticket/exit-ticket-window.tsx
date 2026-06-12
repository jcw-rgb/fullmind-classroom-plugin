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
  // Always render the modal while the ticket is open — never gate it on the question
  // having loaded, so the student always sees the rating + Submit even if the routed-in
  // question is still loading or unavailable. The question text/input fill in once it loads.
  return (
    <ExitTicketModal
      question={et.question}
      error={et.questionError}
      onSubmit={et.submitAnswer}
      onUploadFile={et.uploadFile}
    />
  );
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
