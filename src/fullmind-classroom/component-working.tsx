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
