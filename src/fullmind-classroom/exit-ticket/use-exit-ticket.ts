import { useCallback, useEffect, useState } from 'react';
import {
  BbbPluginSdk, PluginApi, DataChannelTypes,
  DataChannelPushEntryFunctionUserRole as Role,
} from 'bigbluebutton-html-plugin-sdk';
import {
  CONTROL_CHANNEL, ANSWERS_CHANNEL, INGRESS_BASE,
  ControlEntry, ControlState, AnswerEntry, ExitTicketQuestion,
} from './constants';

/**
 * The exit-ticket controller hook — all machinery, no DOM. Students and the teacher
 * both use it; role decides behaviour. Phase 4's modal/panel consume this.
 *
 * Verified against SDK 0.0.73 + BBB 3.0.18:
 *   • useDataChannel<T>(name, type) → { data: GraphqlResponseWrapper<Entry<T>[]>, pushEntry }
 *   • pushEntry(obj, { receivers:[{ role }] }) delivers ONLY to that role (read-gating)
 *   • useCustomSubscription('subscription { meeting { extId } }') → external meeting id
 *     (useMeeting() doesn't resolve on 3.0.18; meeting.meetingId is the INTERNAL id)
 *   • the question is fetched DIRECTLY from vidapi (remoteDataSources/getRemoteData has no
 *     server implementation on BBB 3.0.x — /api/plugin/.../ returns nginx 404)
 *   • useCurrentUser().data.extId is exposed for the current user only
 */
export function useExitTicket(pluginUuid: string) {
  BbbPluginSdk.initialize(pluginUuid);
  const pluginApi: PluginApi = BbbPluginSdk.getPluginApi(pluginUuid);

  const me = pluginApi.useCurrentUser()?.data;
  const isModerator = me?.role === 'MODERATOR';

  // External meeting id (== create meetingID == LMS session uuid == vidapi key) — needed to
  // build the question URL. pluginApi.useMeeting() does NOT resolve on BBB 3.0.18 (the client
  // doesn't feed that consumption hook for plugins), so query the meeting table directly.
  // NOTE: in BBB 3.0's Hasura schema `meeting.meetingId` is the INTERNAL id — the EXTERNAL id
  // is `meeting.extId`.
  const meetingSub = pluginApi.useCustomSubscription?.<{ meeting: { extId: string }[] }>(
    'subscription { meeting { extId } }',
  );
  const meetingExtId = meetingSub?.data?.meeting?.[0]?.extId ?? '';

  // Control channel: latest open/close wins; everyone reads.
  const control = pluginApi.useDataChannel<ControlEntry>(
    CONTROL_CHANNEL,
    DataChannelTypes.LATEST_ITEM,
  );
  const controlEntries = control?.data?.data ?? [];
  const latestControl = controlEntries[controlEntries.length - 1]?.payloadJson;
  const isOpen = latestControl?.state === 'open';

  // Answers channel: students push their own answer to moderators only.
  const answers = pluginApi.useDataChannel<AnswerEntry>(
    ANSWERS_CHANNEL,
    DataChannelTypes.All_ITEMS,
  );

  // Route-in: fetch the question directly from vidapi while the ticket is open. BBB 3.0.18
  // does NOT implement the server half of remoteDataSources/getRemoteData (its
  // /api/plugin/{name}/{source}/ endpoint returns nginx 404), so we bypass it and fetch the
  // vidapi question endpoint ourselves (CORS-enabled).
  const [question, setQuestion] = useState<ExitTicketQuestion | null>(null);
  // questionError distinguishes "fetch failed" from "still loading" so the modal can show an
  // honest error (and fall back to the rating) instead of a spinner that never resolves.
  const [questionError, setQuestionError] = useState(false);
  useEffect(() => {
    if (!isOpen || !meetingExtId) { setQuestion(null); setQuestionError(false); return undefined; }
    const url = `${INGRESS_BASE}/public/a/bbb/exit-ticket/question/${meetingExtId}`;
    let cancelled = false;
    setQuestionError(false);
    fetch(url)
      .then((res) => (res.ok
        ? res.json()
        : Promise.reject(new Error(`HTTP ${res.status} for ${meetingExtId}`))))
      .then((data) => { if (!cancelled) { setQuestion(data as unknown as ExitTicketQuestion); } })
      .catch(() => { if (!cancelled) { setQuestion(null); setQuestionError(true); } });
    return () => { cancelled = true; };
  }, [isOpen, meetingExtId]);

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
    questionError,
    startTicket,
    closeTicket,
    submitAnswer,
    submittedCount: submittedExtIds.size,
    answersChannel: answers, // exposed for the relay loop (Task 4)
  };
}
