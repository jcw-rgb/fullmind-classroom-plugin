import * as React from 'react';
import { useMemo } from 'react';
import * as ReactDOM from 'react-dom/client';
import {
  BbbPluginSdk,
  PluginApi,
  FloatingWindow,
} from 'bigbluebutton-html-plugin-sdk';
import { useSessionTiming } from './features/use-session-timing';

/**
 * Session Progress band — prototype pin 4 ("PLUGIN LATER").
 *
 * A thin Fullmind-branded BAND that spans the very top of the room, fills as the
 * session elapses, and counts down the time remaining. From the prototype legend:
 * "Not native AND not CSS — a bar that fills with elapsed/total time is new stateful
 * UI, so it's a plugin built from the meeting's start + duration."
 *
 * FORM FACTOR (2026-06-05): this is now the full-width banner from
 * Prototype_01_2026-06-02_bbb-toolbar.html `.banner`, NOT the old centered floating
 * pill. The plugin renders the band; the CSS reskin (fullmind-bbb-base.css) reserves
 * an equal strip at the top — `--fm-band-h` — and pushes the room down so the band
 * drops into a clean reserved space and overlaps nothing. See
 * docs/superpowers/specs/2026-06-03-session-progress-band-design.md.
 *
 * DIVISION OF LABOR:
 *   • Plugin owns the bar  — it renders the band element + drives the live fill +
 *     countdown (CSS can't create structure or do arithmetic on now − createdTime).
 *   • CSS owns the space   — reserves `--fm-band-h` at the top and shifts the layout.
 *   • Shared contract      — the single CSS var `--fm-band-h`: CSS declares + reserves
 *     it; the plugin reads the SAME var for the band's height, so the reserved strip
 *     and the rendered band can't drift apart. Colors are read the same way, with
 *     prototype-hex fallbacks so the bar still renders if it ever runs without the
 *     reskin (e.g. the local preview).
 *
 * WHY A FLOATING WINDOW (verified against SDK 0.0.73):
 *   • The timing data is NOT on the typed `useMeeting` hook (name/meetingId/loginUrl
 *     only). It lives on BBB's GraphQL `meeting` table, read via `useCustomSubscription`.
 *   • The nav bar slot only accepts a label+icon (BUTTON/INFO), so a *filling* bar
 *     can't live there. The only areas that render arbitrary React are floating-window
 *     and generic content — so the band is a floating window pinned to the top.
 *   • SDK data hooks are window-event bridged (not React-context bound), so
 *     `useCustomSubscription` works inside the floating window's own ReactDOM root —
 *     the bar updates itself on each tick without us re-registering it.
 */

// ── Prototype-hex fallbacks (used only when the reskin's CSS vars aren't present) ──
// The live values come from fullmind-bbb-base.css via getComputedStyle (see `tokens`
// below); these mirror the prototype's `.banner` so the band still renders standalone.
const FALLBACK = {
  bandH: '32px',
  plum: '#3E3A6E', // --fm-plum (band background)
  coral: '#F37167', // --fm-coral (fill start)
  coralEnd: '#FF9A8E', // fill gradient end (prototype; no CSS var)
  amberSoft: '#FFB37A', // subtle warm fill tint in the final stretch
  amber: '#FFC107', // final-stretch readout (system-status, NOT error-red)
  ink: '#FFFFFF',
  inkDim: 'rgba(255, 255, 255, 0.55)',
  track: 'rgba(255, 255, 255, 0.10)',
  divider: 'rgba(255, 255, 255, 0.08)',
  font: '"Plus Jakarta Sans", system-ui, -apple-system, sans-serif',
};

// Read a CSS custom property off :root, falling back to the prototype hex if absent.
function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

// MM:SS (minutes un-padded, seconds two-digit) — e.g. "40:00", "5:03", "0:00".
function formatMMSS(ms: number): string {
  const totalSec = Math.max(Math.round(ms / 1000), 0);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  const ss = seconds < 10 ? `0${seconds}` : `${seconds}`;
  return `${minutes}:${ss}`;
}

/**
 * The band itself. Rendered into the floating window's detached root; the shared
 * useSessionTiming hook drives the subscription + 1s tick, so the band re-renders in
 * place as time advances. The only motion is the fill edge creeping right — calm,
 * glanceable, ambient (no pulse, no live dot, no sheen — decided 2026-06-03).
 */
export function SessionProgressView(
  { pluginUuid }: { pluginUuid: string },
): React.ReactElement | null {
  BbbPluginSdk.initialize(pluginUuid); // idempotent — just (re)binds the api handle
  const pluginApi: PluginApi = BbbPluginSdk.getPluginApi(pluginUuid);

  // Session clock — shared hook owns the subscription + 1s tick + math.
  const {
    hasDuration, remainingMs, fraction, loading,
  } = useSessionTiming(pluginApi);

  // Height + colors from the reskin's CSS vars (single source of truth), read once.
  const tokens = useMemo(() => ({
    bandH: cssVar('--fm-band-h', FALLBACK.bandH),
    plum: cssVar('--fm-plum', FALLBACK.plum),
    coral: cssVar('--fm-coral', FALLBACK.coral),
  }), []);

  // Right-hand readout + percent. Three honest states: loading, unlimited, counting.
  let readout: string;
  let percent: string;
  if (loading) {
    readout = '…';
    percent = '';
  } else if (!hasDuration) {
    readout = 'Live';
    percent = '';
  } else {
    readout = `${formatMMSS(remainingMs)} left`;
    percent = `${Math.round(fraction * 100)}%`;
  }

  // Final-stretch cue: under 5 minutes the readout + fill shift toward amber — a
  // STATIC color change only (no pulse, no acceleration). Amber is a system-status
  // signal (Nielsen #1), deliberately NOT error-red.
  const isFinalStretch = hasDuration && remainingMs <= 5 * 60000;
  const fillEnd = isFinalStretch ? FALLBACK.amberSoft : FALLBACK.coralEnd;

  return (
    <div
      role="progressbar"
      aria-label="Session progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(fraction * 100)}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: tokens.bandH,
        zIndex: 30, // above the stage chrome, below BBB's own modals
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '0 18px',
        background: tokens.plum,
        borderBottom: `1px solid ${FALLBACK.divider}`,
        fontFamily: FALLBACK.font,
        color: FALLBACK.ink,
        userSelect: 'none',
        pointerEvents: 'none', // purely informational — never steals clicks
      }}
    >
      {/* label: trend icon + "Session Progress" (second word bold white) */}
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          flex: '0 0 auto',
          fontSize: 12,
          color: FALLBACK.inkDim,
          whiteSpace: 'nowrap',
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ display: 'block', flex: '0 0 auto' }}
        >
          <polyline points="3 17 9 11 13 15 21 7" />
          <polyline points="16 7 21 7 21 12" />
        </svg>
        <span>
          Session Progress
          {' '}
          {/* <strong style={{ color: FALLBACK.ink, fontWeight: 700 }}>Progress</strong> */}
        </span>
      </span>

      {/* the track — takes the remaining width */}
      <span
        style={{
          position: 'relative',
          flex: '1 1 auto',
          height: 9,
          borderRadius: 999,
          background: FALLBACK.track,
          overflow: 'hidden',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            width: `${fraction * 100}%`,
            borderRadius: 999,
            background: `linear-gradient(90deg, ${tokens.coral}, ${fillEnd})`,
            boxShadow: '0 0 12px rgba(243, 113, 103, 0.5)',
            transition: 'width 0.5s cubic-bezier(.2,.8,.2,1)',
          }}
        />
      </span>

      {/* percent */}
      <span
        style={{
          flex: '0 0 auto',
          minWidth: 38,
          textAlign: 'right',
          fontSize: 13,
          fontWeight: 800,
          fontVariantNumeric: 'tabular-nums',
          color: FALLBACK.ink,
        }}
      >
        {percent}
      </span>

      {/* remaining time — clock icon + MM:SS left */}
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flex: '0 0 auto',
          fontSize: 12,
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
          color: isFinalStretch ? FALLBACK.amber : FALLBACK.inkDim,
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ display: 'block', flex: '0 0 auto', opacity: 0.7 }}
        >
          <circle cx="12" cy="12" r="9" />
          <polyline points="12 7 12 12 16 14" />
        </svg>
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
