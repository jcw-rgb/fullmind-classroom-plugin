import * as React from 'react';
import FullmindClassroom from './component';
import RegisterFloatingWindows from './features/register-floating-windows';
import FontSizeReorder from './features/font-size-reorder';
import ExitTicket from './exit-ticket/exit-ticket';

/**
 * FullmindClassroomWorking — the WORKING build of the plugin.
 *
 * Renders the untouched foundation (./component) and layers each feature as a
 * sibling. Each owns a DISTINCT registration surface, so they never clobber:
 *   • foundation              → setOptionsDropdownItems
 *   • RegisterFloatingWindows → setFloatingWindows (progress bar + Lesson Hub rail, ONE call)
 *   • FontSizeReorder         → DOM only
 *   • ExitTicket              → setActionButtonDropdownItems (⊕ menu) + data channels
 *
 * Shipped features:
 *   • Lesson Hub rail (Chat / Notes / Class) — ./features/lesson-hub-rail
 *   • Session Progress bar                    — ./session-progress-bar
 *   • Font-size reorder (Settings)            — ./features/font-size-reorder
 *   • Exit Ticket (⊕ Start + answer relay)    — ./exit-ticket/exit-ticket
 */
function FullmindClassroomWorking(
  { pluginUuid }: { pluginUuid: string },
): React.ReactElement {
  return (
    <>
      <FullmindClassroom pluginUuid={pluginUuid} />
      <RegisterFloatingWindows pluginUuid={pluginUuid} />
      <FontSizeReorder />
      <ExitTicket pluginUuid={pluginUuid} />
    </>
  );
}

export default FullmindClassroomWorking;
