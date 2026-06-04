import * as React from 'react';
import { useEffect, useState } from 'react';
import * as ReactDOM from 'react-dom/client';
import {
  BbbPluginSdk,
  PluginApi,
  FloatingWindow,
} from 'bigbluebutton-html-plugin-sdk';

/**
 * Session Progress bar — prototype pin 4 ("PLUGIN LATER").
 *
 * A thin Fullmind-branded bar pinned at the top of the room that fills as the
 * session elapses and counts down the minutes remaining. From the prototype
 * legend: "Not native AND not CSS — a bar that fills with elapsed/total time is
 * new stateful UI, so it's a plugin built from the meeting's start + duration."
 *
 * WHY IT IS BUILT THE WAY IT IS (each choice was verified against SDK 0.0.73):
 *   • The timing data is NOT on the typed `useMeeting` hook (that only returns
 *     name/meetingId/loginUrl). It lives on BBB's GraphQL `meeting` table, read
 *     here via `useCustomSubscription` — exactly the hook the legend names.
 *   • The nav bar area only accepts a label+icon (BUTTON/INFO), so a *filling*
 *     bar can't live there ("no nav-bar plugin slot" in the legend). The only
 *     areas that render arbitrary React are `floating-window` and generic
 *     content — so the bar is a floating window pinned to the top.
 *   • The SDK data hooks are window-event bridged (not React-context bound), so
 *     `useCustomSubscription` works fine inside the floating window's own
 *     ReactDOM root — which is how the bar updates itself without us having to
 *     re-register it on every tick.
 */

// ── Fullmind brand tokens (mirror KNOWLEDGE.md §5 + the design system) ────────
// Kept local to this feature so it stays a self-contained drop-in file.
const FM = {
  plum: 'rgba(64, 55, 112, 0.92)', // #403770 — dark "authority" surface, slightly frosted
  ink: '#FFFCFA', // off-white text
  coral: '#F37167', // primary fill
  coralBright: '#F8A7A0', // fill highlight (Deep Coral 80)
  warning: '#FFC107', // system-status amber for the final minutes (NOT error red)
  track: 'rgba(255, 255, 255, 0.18)', // unfilled portion of the bar
  font: '"Plus Jakarta Sans", system-ui, -apple-system, sans-serif',
};

// GraphQL subscription for the room clock.
// ⚠️ DEV: confirm these two field names against the LIVE BBB 3.0 `meeting` schema
// during the first room test (the offline docs don't pin them down). If they
// differ, this string is the ONLY thing that changes — the math below is generic.
//   • createdTime       — epoch ms the meeting was created (the start clock)
//   • durationInSeconds — configured length; 0 means "no limit" (vidapi sets this
//                         from the LMS class duration, so it is normally > 0)
const SESSION_TIMING_SUBSCRIPTION = `
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

// One <style> for the live-dot keyframes (inline styles can't express @keyframes).
// A <style> rendered into the tree applies document-wide, which is all we need.
const PULSE_KEYFRAMES = `
  @keyframes fm-spb-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%      { opacity: 0.35; transform: scale(0.7); }
  }
`;

/**
 * The bar itself. Rendered into the floating window's detached root, so it owns
 * its own subscription + 1s tick and re-renders in place as time advances.
 */
export function SessionProgressView(
  { pluginUuid }: { pluginUuid: string },
): React.ReactElement | null {
  BbbPluginSdk.initialize(pluginUuid); // idempotent — just (re)binds the api handle
  const pluginApi: PluginApi = BbbPluginSdk.getPluginApi(pluginUuid);

  const timing = pluginApi.useCustomSubscription<MeetingTimingResponse>(
    SESSION_TIMING_SUBSCRIPTION,
  );
  const row = timing?.data?.meeting?.[0];

  // The tick that drives the smooth fill + the minute countdown. Updating `now`
  // once a second is cheap and keeps the bar honest without spamming re-renders.
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
  const remainingMin = Math.ceil(remainingMs / 60000);

  // Right-hand readout. Three honest states: loading, unlimited, counting down.
  let readout: string;
  if (!row) readout = '…';
  else if (!hasDuration) readout = 'Live';
  else if (remainingMs < 60000) readout = '<1 min left';
  else readout = `${remainingMin} min left`;

  // Final-stretch cue: amber readout + faster pulse under 5 minutes. Amber is a
  // "system status" signal (Nielsen #1), deliberately NOT error-red.
  const isFinalStretch = hasDuration && remainingMs <= 5 * 60000;

  return (
    <div
      role="progressbar"
      aria-label="Session progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(fraction * 100)}
      style={{
        position: 'fixed',
        top: 10,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 30, // above the stage chrome, below BBB's own modals
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 16px',
        background: FM.plum,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        borderRadius: 999,
        boxShadow: '0 6px 20px rgba(20, 17, 34, 0.35)',
        fontFamily: FM.font,
        color: FM.ink,
        userSelect: 'none',
        pointerEvents: 'none', // purely informational — never steals clicks
      }}
    >
      <style>{PULSE_KEYFRAMES}</style>

      {/* live dot */}
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: isFinalStretch ? FM.warning : FM.coral,
          animation: `fm-spb-pulse ${isFinalStretch ? 0.8 : 1.6}s ease-in-out infinite`,
          flex: '0 0 auto',
        }}
      />

      {/* label */}
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          opacity: 0.85,
          flex: '0 0 auto',
        }}
      >
        Session
      </span>

      {/* the bar */}
      <span
        style={{
          position: 'relative',
          width: 200,
          height: 8,
          borderRadius: 999,
          background: FM.track,
          overflow: 'hidden',
          flex: '0 0 auto',
        }}
      >
        <span
          style={{
            position: 'absolute',
            inset: 0,
            width: `${fraction * 100}%`,
            borderRadius: 999,
            background: `linear-gradient(90deg, ${FM.coral}, ${FM.coralBright})`,
            boxShadow: `0 0 8px ${FM.coral}`,
            transition: 'width 0.6s ease',
          }}
        />
      </span>

      {/* remaining time */}
      <span
        style={{
          fontSize: 13,
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          color: isFinalStretch ? FM.warning : FM.ink,
          whiteSpace: 'nowrap',
          flex: '0 0 auto',
        }}
      >
        {readout}
      </span>
    </div>
  );
}

export function makeSessionProgressWindow(pluginUuid: string): FloatingWindow {
  return new FloatingWindow({
    id: 'fullmind-session-progress',
    top: 0,
    left: 0,
    movable: false,
    backgroundColor: 'transparent',
    boxShadow: 'none',
    contentFunction: (element: HTMLElement): ReactDOM.Root => {
      const root = ReactDOM.createRoot(element);
      root.render(<SessionProgressView pluginUuid={pluginUuid} />);
      return root;
    },
  });
}
