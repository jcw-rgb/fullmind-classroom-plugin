import { useEffect, useRef } from 'react';
import {
  BbbPluginSdk, PluginApi, ActionButtonDropdownOption, pluginLogger,
} from 'bigbluebutton-html-plugin-sdk';
import { useExitTicket } from './use-exit-ticket';
import { useTeacherRelay } from './use-teacher-relay';
import { INGRESS_BASE } from './constants';

/**
 * Exit Ticket — the prototype's "Start Exit Ticket" item in the ⊕ Actions menu,
 * now WIRED: clicking it broadcasts `open` on the control channel (Phase 3), which
 * routes the question into every client. This file registers the trigger and, for
 * moderators, runs the relay loop that forwards verified answers to vidapi. The
 * student modal + teacher count/close panel are Phase 4 (they consume useExitTicket).
 *
 * Verified against SDK 0.0.73: setActionButtonDropdownItems registers ⊕-menu items;
 * `allowed:false` hides an item (role gate); it is a DISTINCT surface from the
 * foundation's setOptionsDropdownItems and the progress bar's setFloatingWindows, so
 * the features never clobber each other.
 */

const LOG = '[Fullmind]';

// Exit-ticket glyph. The dropdown `icon` is a bbb-icons FONT GLYPH NAME (not an SVG).
// 'check' is the closest stock glyph to the prototype's checkmark. ⚠️ CONFIRM/SWAP
// against the live bbb-icons set on first room test — a missing glyph only blanks the
// icon, never hides the item. This is the ONE place to change the icon.
const EXIT_TICKET_ICON = 'check';

function ExitTicket({ pluginUuid }: { pluginUuid: string }): null {
  BbbPluginSdk.initialize(pluginUuid);
  const pluginApi: PluginApi = BbbPluginSdk.getPluginApi(pluginUuid);
  const et = useExitTicket(pluginUuid);

  // Moderator-only relay loop. meetingId + relayToken arrive on the routed-in question.
  useTeacherRelay(
    et.isModerator,
    INGRESS_BASE,
    et.question?.meetingId ?? '',
    et.question?.relayToken,
    et.answersChannel?.data?.data,
  );

  // Keep the latest startTicket reachable from the registered onClick without
  // re-registering the menu item on every render (the SDK returns fresh refs each tick).
  const startRef = useRef(et.startTicket);
  startRef.current = et.startTicket;

  useEffect(() => {
    pluginApi.setActionButtonDropdownItems([
      new ActionButtonDropdownOption({
        id: 'fullmind-start-exit-ticket',
        label: 'Start Exit Ticket',
        icon: EXIT_TICKET_ICON,
        tooltip: 'Start the end-of-class exit ticket',
        allowed: et.isModerator, // false hides it for viewers — register unconditionally
        onClick: () => {
          pluginLogger.info(`${LOG} Start Exit Ticket → broadcasting open`);
          startRef.current();
        },
      }),
    ]);
  }, [et.isModerator]);

  // Registrar + relay host — renders no DOM of its own (Phase 4 adds the modal/panel).
  return null;
}

export default ExitTicket;
