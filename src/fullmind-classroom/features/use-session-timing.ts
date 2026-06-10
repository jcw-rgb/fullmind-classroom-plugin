import { useEffect, useState } from 'react';
import { PluginApi } from 'bigbluebutton-html-plugin-sdk';

/**
 * Shared session-clock hook — the SINGLE source of truth for the room's timing.
 *
 * Both the Session Progress band and the mini-lesson prompt read the session clock,
 * so the GraphQL subscription + the elapsed/remaining math live here once. (The band
 * file used to own them and flagged the field names as "the ONLY thing that changes" —
 * keeping them in two places would invite drift, so they're centralised here.)
 *
 * Each floating window has its own ReactDOM root, so this hook runs independently per
 * consumer (its own subscription + 1s tick). That's fine — each window self-updates.
 */

// ⚠️ DEV: confirm these two field names against the LIVE BBB 3.0 `meeting` schema in the
// first room test. If they differ, THIS string is the only thing that changes — the
// math below is generic.
//   • createdTime       — epoch ms the meeting was created (the start clock)
//   • durationInSeconds — configured length; 0 means "no limit"
export const SESSION_TIMING_SUBSCRIPTION = `
  subscription FullmindSessionTiming {
    meeting {
      createdTime
      durationInSeconds
    }
  }
`;

interface MeetingTimingRow {
  createdTime: number;
  durationInSeconds: number;
}

interface MeetingTimingResponse {
  meeting: MeetingTimingRow[];
}

export interface SessionTiming {
  /** true once the meeting row is known AND it carries a positive duration. */
  hasDuration: boolean;
  /** ms left in the session (0 when unlimited or not yet known). */
  remainingMs: number;
  /** elapsed / total, clamped to [0, 1] (0 when unlimited or not yet known). */
  fraction: number;
  /** true while the meeting row hasn't loaded yet. */
  loading: boolean;
}

export function useSessionTiming(pluginApi: PluginApi): SessionTiming {
  const timing = pluginApi.useCustomSubscription<MeetingTimingResponse>(
    SESSION_TIMING_SUBSCRIPTION,
  );
  const row = timing?.data?.meeting?.[0];

  // 1s tick drives the smooth fill + countdown. Cheap, and keeps consumers honest.
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const intervalId = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(intervalId);
  }, []);

  const totalMs = (row?.durationInSeconds ?? 0) * 1000;
  const hasDuration = totalMs > 0;
  const elapsedMs = row ? Math.max(now - row.createdTime, 0) : 0;
  const fraction = hasDuration ? Math.min(elapsedMs / totalMs, 1) : 0;
  const remainingMs = hasDuration ? Math.max(totalMs - elapsedMs, 0) : 0;

  return {
    hasDuration,
    remainingMs,
    fraction,
    loading: !row,
  };
}
