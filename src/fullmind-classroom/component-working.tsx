import * as React from 'react';
import FullmindClassroom from './component';
import SessionProgressBar from './session-progress-bar';

/**
 * FullmindClassroomWorking — the WORKING build of the plugin.
 *
 * This is the file the entrypoint renders so real features run in the room. It
 * deliberately does NOT replace the template: it renders the untouched
 * foundation (`./component` — all the core SDK plumbing + proof-of-life menu
 * item) and layers each shipped feature beside it as a sibling.
 *
 * Adding a feature = import it and drop one more sibling in here. The foundation
 * (`component.tsx`) stays the clean, minimal template it was always meant to be.
 *
 * Why siblings work: every component calls `BbbPluginSdk.initialize(uuid)`, which
 * just (re)binds the api handle on `window.bbb_plugins[uuid]` — idempotent. And
 * the foundation registers an Options-menu item while the bar registers a
 * floating window; those are independent setters, so they never clobber each
 * other.
 *
 * Shipped features:
 *   • Session Progress bar (prototype pin 4) — ./session-progress-bar
 */
function FullmindClassroomWorking(
  { pluginUuid }: { pluginUuid: string },
): React.ReactElement {
  return (
    <>
      <FullmindClassroom pluginUuid={pluginUuid} />
      <SessionProgressBar pluginUuid={pluginUuid} />
    </>
  );
}

export default FullmindClassroomWorking;
