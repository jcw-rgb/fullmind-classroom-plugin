import * as React from 'react';
import FullmindClassroom from './component';
import SessionProgressBar from './session-progress-bar';
import RegisterPanels from './features/register-panels';
import FontSizeReorder from './features/font-size-reorder';

/**
 * FullmindClassroomWorking — the WORKING build of the plugin.
 *
 * Renders the untouched foundation (./component) and layers each shipped feature as
 * a sibling. Each component calls BbbPluginSdk.initialize(uuid) (idempotent), and
 * each feature owns a DIFFERENT registration surface, so they never clobber:
 *   • foundation        → setOptionsDropdownItems (proof-of-life menu item)
 *   • progress bar      → setFloatingWindows (its own floating window)
 *   • RegisterPanels    → setGenericContentItems (the three sidebar panels, ONE call)
 *   • FontSizeReorder   → DOM only (no SDK setter)
 *
 * Shipped features:
 *   • Session Progress bar (prototype pin 4) — ./session-progress-bar
 *   • Sidebar panels: Chat / Notes / Class    — ./features/register-panels
 *   • Font-size reorder (Settings)            — ./features/font-size-reorder
 */
function FullmindClassroomWorking(
  { pluginUuid }: { pluginUuid: string },
): React.ReactElement {
  return (
    <>
      <FullmindClassroom pluginUuid={pluginUuid} />
      <SessionProgressBar pluginUuid={pluginUuid} />
      <RegisterPanels pluginUuid={pluginUuid} />
      <FontSizeReorder />
    </>
  );
}

export default FullmindClassroomWorking;
