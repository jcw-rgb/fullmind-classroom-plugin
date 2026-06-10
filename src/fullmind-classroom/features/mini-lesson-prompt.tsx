import * as React from 'react';
import { useEffect, useState } from 'react';
import * as ReactDOM from 'react-dom/client';
import {
  BbbPluginSdk,
  PluginApi,
  FloatingWindow,
} from 'bigbluebutton-html-plugin-sdk';
import { useSessionTiming } from './use-session-timing';

/**
 * Mini-lesson prompt — a ONE-TIME modal that appears when the session has
 * MINI_LESSON_PROMPT_MINUTES left, nudging the educator to begin the mini-lesson.
 *
 * Reuses the shared session clock (useSessionTiming). Rendered as its own
 * FloatingWindow (registered alongside the band + rail in the hub) so it can paint a
 * full-screen scrim + centered card. When closed it renders nothing, so the floating
 * window's container is empty and never steals clicks from the room.
 *
 * BEHAVIOR:
 *   • Moderators/instructors ONLY — students (role VIEWER) never see it.
 *   • Shows ONCE — the first tick where remaining ≤ threshold (and still > 0). Once
 *     dismissed it does not reappear (a teacher who joins already under the threshold
 *     still sees it once).
 *   • "Begin" dismisses it. The real action isn't defined yet — see handleBegin TODO.
 */

// Minutes-remaining that triggers the prompt. The mockup shows 20; this is the single
// knob — the message text derives from it, so the number shown can never disagree.
const MINI_LESSON_PROMPT_MINUTES = 55;

// Self-contained tokens (mockup-matched), same pattern as the band's FALLBACK.
const TOKENS = {
  scrim: 'rgba(38, 34, 68, 0.55)', // dim plum veil over the room
  card: '#FFFFFF',
  plum: '#3E3A6E', // emphasised copy
  ink: '#495057', // body copy (Gray 700)
  coral: '#F37167', // primary action
  iconBg: '#E7F6E9', // pale mint ring behind the clock
  iconFg: '#3E3A6E', // clock glyph
  font: '"Plus Jakarta Sans", system-ui, -apple-system, sans-serif',
};

export function MiniLessonPromptView(
  { pluginUuid }: { pluginUuid: string },
): React.ReactElement | null {
  BbbPluginSdk.initialize(pluginUuid); // idempotent — just (re)binds the api handle
  const pluginApi: PluginApi = BbbPluginSdk.getPluginApi(pluginUuid);

  const { hasDuration, remainingMs } = useSessionTiming(pluginApi);

  // Moderators/instructors ONLY — students (role VIEWER) never see this prompt. BBB's
  // role is "MODERATOR" for the teacher; everyone else is "VIEWER". (Role can load a
  // beat after mount, so the effect below re-checks once it arrives.)
  const currentUser = pluginApi.useCurrentUser();
  const isModerator = currentUser?.data?.role?.toUpperCase() === 'MODERATOR';

  const [open, setOpen] = useState<boolean>(false);
  const [hasShown, setHasShown] = useState<boolean>(false);

  const thresholdMs = MINI_LESSON_PROMPT_MINUTES * 60000;

  // Fire once when the clock first crosses the threshold (still time left) — and only
  // for a moderator/instructor.
  useEffect(() => {
    if (!hasShown && isModerator && hasDuration && remainingMs > 0 && remainingMs <= thresholdMs) {
      setOpen(true);
      setHasShown(true);
    }
  }, [hasShown, isModerator, hasDuration, remainingMs, thresholdMs]);

  if (!open) return null;

  const handleBegin = () => {
    // TODO(team): wire the real "begin the mini-lesson" action here (e.g. open the
    // mini-lesson content, switch slides, or fire an analytics event). The click event
    // isn't defined yet, so for now Begin just dismisses the prompt.
    setOpen(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Mini-lesson reminder"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 40, // above the band (30) + rail (20), below BBB's own modals
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        boxSizing: 'border-box',
        background: TOKENS.scrim,
        fontFamily: TOKENS.font,
      }}
    >
      <div
        style={{
          width: 'min(520px, 100%)',
          background: TOKENS.card,
          borderRadius: 20,
          boxShadow: '0 24px 60px rgba(20, 17, 34, 0.35)',
          padding: '36px 40px 32px',
          textAlign: 'center',
          boxSizing: 'border-box',
        }}
      >
        {/* clock icon in a pale mint ring */}
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: TOKENS.iconBg,
            margin: '0 auto 22px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            width="30"
            height="30"
            viewBox="0 0 24 24"
            fill="none"
            stroke={TOKENS.iconFg}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="9" />
            <polyline points="12 7 12 12 15 14" />
          </svg>
        </div>

        <p
          style={{
            margin: '0 0 24px',
            fontSize: 19,
            lineHeight: 1.45,
            color: TOKENS.ink,
          }}
        >
          <strong style={{ color: TOKENS.plum, fontWeight: 700 }}>
            {`${MINI_LESSON_PROMPT_MINUTES} minutes remaining`}
          </strong>
          {' in the current session, please begin the '}
          <strong style={{ color: TOKENS.plum, fontWeight: 700 }}>
            {'Mini Lesson '}
          </strong>
          {' if applicable, and remember to have students complete the '}
          <strong style={{ color: TOKENS.plum, fontWeight: 700 }}>
            {'Exit Ticket '}
          </strong>
          {' during this session.'}
        </p>

        <button
          type="button"
          onClick={handleBegin}
          style={{
            width: '100%',
            border: 0,
            borderRadius: 12,
            padding: '14px 0',
            background: TOKENS.coral,
            color: '#fff',
            fontFamily: 'inherit',
            fontSize: 16,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Begin
        </button>
      </div>
    </div>
  );
}

export function makeMiniLessonPromptWindow(pluginUuid: string): FloatingWindow {
  return new FloatingWindow({
    id: 'fullmind-mini-lesson-prompt',
    top: 0,
    left: 0,
    movable: false,
    backgroundColor: 'transparent',
    boxShadow: 'none',
    contentFunction: (element: HTMLElement): ReactDOM.Root => {
      const root = ReactDOM.createRoot(element);
      root.render(<MiniLessonPromptView pluginUuid={pluginUuid} />);
      return root;
    },
  });
}
