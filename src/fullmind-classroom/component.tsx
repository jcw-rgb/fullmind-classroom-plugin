import * as React from 'react';
import { useEffect } from 'react';
import {
  BbbPluginSdk,
  PluginApi,
  OptionsDropdownOption,
  NotificationTypeUiCommand,
  pluginLogger,
} from 'bigbluebutton-html-plugin-sdk';

/**
 * FullmindClassroom — the DEFAULT plugin foundation.
 *
 * This is the starting point every Fullmind in-room feature grows from (timer,
 * sidebar panel, exit-ticket, branded notifications). It deliberately wires only
 * the CORE connections, each of which is the base of a planned feature — nothing
 * speculative. See README.md "Extension points" for where the rest plug in.
 *
 * The shape of every connection below was verified against the real SDK 0.0.73
 * type definitions, not guessed.
 */

interface FullmindClassroomProps {
  pluginUuid: string;
}

// Brand tag for every console line this plugin emits — makes it easy to filter
// the browser console to just Fullmind output when debugging in a live room.
const LOG = '[Fullmind]';

// BBB icon-set name, defined once so the toast and the menu item never drift.
// 'user' is the known-good name from the SDK docs — swap to a fitting Fullmind
// icon here (one place) once confirmed against the icon set.
const FULLMIND_ICON = 'user';

function FullmindClassroom(
  { pluginUuid }: FullmindClassroomProps,
): React.ReactElement<FullmindClassroomProps> {
  // ── CONNECTION 1: core SDK handle ──────────────────────────────────────────
  // initialize() must run once before getPluginApi(); pluginApi is the single
  // object every other connection hangs off of.
  BbbPluginSdk.initialize(pluginUuid);
  const pluginApi: PluginApi = BbbPluginSdk.getPluginApi(pluginUuid);

  // ── CONNECTION 2: live room data (read) ────────────────────────────────────
  // Hooks must be called unconditionally at the top of the component (React's
  // rules of hooks). Each returns { loading, data, error }.
  //   • useCurrentUser → who am I + my role (MODERATOR vs VIEWER) + presenter flag.
  //   • useMeeting     → the meeting(s) I'm in; data is an ARRAY (Meeting[]).
  // These two are the foundation of role-gated features and the LMS-aware timer.
  const currentUserResponse = pluginApi.useCurrentUser();
  const meetingResponse = pluginApi.useMeeting();

  const currentUser = currentUserResponse?.data;
  const meeting = meetingResponse?.data?.[0];
  const isModerator = currentUser?.role === 'MODERATOR';

  // ── CONNECTION 3: branded notification helper (drive the UI) ────────────────
  // A reusable wrapper around uiCommands.notification.send. Client-side only —
  // to show a toast on every participant's screen, send it over a data channel
  // instead (see README "Extension points"). This is the base of roadmap #9.
  const sendFullmindNotification = (
    message: string,
    type: NotificationTypeUiCommand = NotificationTypeUiCommand.INFO,
  ): void => {
    pluginApi.uiCommands.notification.send({
      type,
      icon: FULLMIND_ICON,
      message,
    });
  };

  // ── CONNECTION 4: a UI surface + proof-of-life ──────────────────────────────
  // One Options-dropdown (⋮) item that exercises every connection above at once:
  // it reads the live user/meeting data and fires a branded toast. This is how
  // you confirm the whole pipeline (load → run → read → render) works in a room.
  //
  // setOptionsDropdownItems REPLACES the item list, so we must NOT re-run it on
  // every render. The SDK data hooks hand back a NEW object reference on every
  // core data push, so depending on `currentUser`/`meeting` directly would re-
  // register the item constantly (thrash). Depend on the stable PRIMITIVE fields
  // we actually display instead — the effect then only re-runs when a shown
  // value genuinely changes, and the closure captures the matching values.
  useEffect(() => {
    pluginLogger.info(`${LOG} FullmindClassroom mounted — pipeline is LIVE.`);

    pluginApi.setOptionsDropdownItems([
      new OptionsDropdownOption({
        label: 'Fullmind — test connection',
        icon: FULLMIND_ICON,
        onClick: () => {
          pluginLogger.info(`${LOG} current user:`, currentUser);
          pluginLogger.info(`${LOG} meeting:`, meeting);

          const who = currentUser?.name ?? 'there';
          const room = meeting?.name ?? 'your Fullmind classroom';
          sendFullmindNotification(
            `Hi ${who} — connected to ${room}.`
            + ` (role: ${currentUser?.role ?? 'unknown'}, moderator: ${isModerator})`,
          );
        },
      }),
    ]);
  }, [currentUser?.userId, currentUser?.name, currentUser?.role, meeting?.name]);

  // Foundation renders no visible DOM of its own — features add their own UI
  // through the SDK's extensible areas. Returning null is correct here.
  return null;
}

export default FullmindClassroom;
