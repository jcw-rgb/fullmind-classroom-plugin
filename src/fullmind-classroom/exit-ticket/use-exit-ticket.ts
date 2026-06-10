import { useCallback, useEffect, useState } from 'react';
import {
  BbbPluginSdk, PluginApi, DataChannelTypes,
  DataChannelPushEntryFunctionUserRole as Role,
} from 'bigbluebutton-html-plugin-sdk';
import {
  CONTROL_CHANNEL, ANSWERS_CHANNEL, REMOTE_SOURCE,
  ControlEntry, ControlState, AnswerEntry, ExitTicketQuestion,
} from './constants';

/**
 * The exit-ticket controller hook — all machinery, no DOM. Students and the teacher
 * both use it; role decides behaviour. Phase 4's modal/panel consume this.
 *
 * Verified against SDK 0.0.73 type defs:
 *   • useDataChannel<T>(name, type) → { data: GraphqlResponseWrapper<Entry<T>[]>, pushEntry }
 *   • pushEntry(obj, { receivers:[{ role }] }) delivers ONLY to that role (read-gating)
 *   • getRemoteData(name) → Promise<object> (already parsed — NOT a fetch Response)
 *   • useCurrentUser().data.extId is exposed for the current user only
 */
export function useExitTicket(pluginUuid: string) {
  BbbPluginSdk.initialize(pluginUuid);
  const pluginApi: PluginApi = BbbPluginSdk.getPluginApi(pluginUuid);

  const me = pluginApi.useCurrentUser()?.data;
  const isModerator = me?.role === 'MODERATOR';

  // Control channel: latest open/close wins; everyone reads.
  const control = pluginApi.useDataChannel<ControlEntry>(CONTROL_CHANNEL, DataChannelTypes.LATEST_ITEM);
  const controlEntries = control?.data?.data ?? [];
  const latestControl = controlEntries[controlEntries.length - 1]?.payloadJson;
  const isOpen = latestControl?.state === 'open';

  // Answers channel: students push their own answer to moderators only.
  const answers = pluginApi.useDataChannel<AnswerEntry>(ANSWERS_CHANNEL, DataChannelTypes.All_ITEMS);

  // Route-in: fetch the question only while the ticket is open (onDemand source).
  // getRemoteData resolves the already-parsed object, so use it directly (no .json()).
  const [question, setQuestion] = useState<ExitTicketQuestion | null>(null);
  useEffect(() => {
    if (!isOpen) { setQuestion(null); return undefined; }
    const fetchRemote = pluginApi.getRemoteData;
    if (!fetchRemote) return undefined;
    let cancelled = false;
    fetchRemote(REMOTE_SOURCE)
      .then((data) => { if (!cancelled) setQuestion(data as unknown as ExitTicketQuestion); })
      .catch(() => { if (!cancelled) setQuestion(null); });
    return () => { cancelled = true; };
  }, [isOpen]);

  // Teacher broadcast (moderator only — gated by the ⊕ item's `allowed`).
  const broadcast = useCallback((state: ControlState) => {
    control.pushEntry({ state });
  }, [control]);
  const startTicket = useCallback(() => broadcast('open'), [broadcast]);
  const closeTicket = useCallback(() => broadcast('close'), [broadcast]);

  // Student submit: push own answer to moderators only (read-gated delivery).
  const submitAnswer = useCallback((answer: Omit<AnswerEntry, 'extId'>) => {
    if (!me?.extId) return;
    answers.pushEntry(
      { extId: me.extId, ...answer },
      { receivers: [{ role: Role.MODERATOR }] },
    );
  }, [answers, me?.extId]);

  // Live count (teacher view): distinct extIds that have submitted an answer.
  const submittedExtIds = new Set(
    (answers?.data?.data ?? []).map((e) => e.payloadJson?.extId).filter(Boolean),
  );

  return {
    isModerator,
    isOpen,
    question,
    startTicket,
    closeTicket,
    submitAnswer,
    submittedCount: submittedExtIds.size,
    answersChannel: answers, // exposed for the relay loop (Task 4)
  };
}
