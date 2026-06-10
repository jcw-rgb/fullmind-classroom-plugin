import { useEffect, useRef } from 'react';
import { DataChannelEntryResponseType } from 'bigbluebutton-html-plugin-sdk';
import { AnswerEntry } from './constants';

/**
 * Pure: the latest answer per extId that hasn't been relayed yet. Drives both dedupe
 * (one POST per student even as the channel replays) and reconnect self-heal (a fresh
 * moderator sees an empty `relayed` set and re-reads the whole backlog). Later entries
 * for the same extId overwrite earlier ones, so an edited answer relays its latest value.
 */
export function unrelayedAnswers(
  entries: { payloadJson: AnswerEntry }[],
  relayed: Set<string>,
): AnswerEntry[] {
  const latest = new Map<string, AnswerEntry>();
  for (const e of entries) {
    const a = e?.payloadJson;
    if (a?.extId && !relayed.has(a.extId)) latest.set(a.extId, a);
  }
  return Array.from(latest.values()); // Array.from (not spread) — es5 target, no downlevelIteration
}

/**
 * Moderator-only: POST each not-yet-relayed answer to vidapi exactly once. Re-runs on
 * every channel update, so a reconnecting moderator re-reads the backlog and relays
 * anything it missed while gone (self-heal). A failed POST leaves the extId un-relayed,
 * so the next channel tick retries it.
 */
export function useTeacherRelay(
  enabled: boolean,
  ingressBase: string,
  meetingId: string,
  relayToken: string | undefined,
  answerEntries: DataChannelEntryResponseType<AnswerEntry>[] | undefined,
): void {
  const relayed = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!enabled || !relayToken || !meetingId || !ingressBase || !answerEntries) return;
    const todo = unrelayedAnswers(answerEntries, relayed.current);
    todo.forEach((a) => {
      const { extId, ...answer } = a;
      fetch(`${ingressBase}/public/a/bbb/exit-ticket/answer/${meetingId}/${extId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...answer, relayToken }),
      })
        .then((r) => { if (r.ok) relayed.current.add(extId); })
        .catch(() => { /* leave un-relayed; next channel tick retries (self-heal) */ });
    });
  }, [enabled, ingressBase, meetingId, relayToken, answerEntries]);
}
