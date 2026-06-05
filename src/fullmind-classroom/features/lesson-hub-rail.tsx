import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import {
  BbbPluginSdk,
  FloatingWindow,
} from 'bigbluebutton-html-plugin-sdk';
import { FM } from './theme';

/**
 * Lesson Hub — SEAMLESS nav reskin (pure CSS).
 *
 * Background: the earlier rail REFLOWED BBB's columns (forcing the open panel to left:64 and
 * resizing the whiteboard). That column-moving is what made the whiteboard pop on every switch —
 * proven by measuring bbb0 with NO plugin, where chat↔notes leaves the whiteboard perfectly still
 * (BBB reuses one content node and never moves it).
 *
 * So this version moves NOTHING and — critically — mutates NO DOM. An earlier attempt rewrote the
 * nav items' innerHTML + ran a MutationObserver; that fought BBB's React reconciliation and crashed
 * the client ("Oops, something went wrong"). The fix is to reskin BBB's native nav with PURE CSS:
 *   • relabel via ::after ("Public Chat" → "Chat", "Shared Notes" → "Notes"), hiding BBB's own text
 *     with font-size:0 and its icon glyph with display:none;
 *   • draw the Fullmind outline icons via ::before using a CSS mask (so they inherit text colour —
 *     grey normally, white on the coral active tab);
 *   • colour the active tab coral via BBB's own [aria-expanded="true"] (it sets this on the open
 *     nav item — no JS needed to track state);
 *   • hide BBB's "Messages"/"Notes" section headers.
 *
 * No reflow, no FloatingWindow rail, no DOM mutation, no observer — the plugin only injects this
 * stylesheet. BBB owns the layout, so chat↔notes is seamless exactly like a default room.
 */

// Fullmind outline icons → CSS mask URLs (built at load; encodeURIComponent avoids hand-escaping).
const SVG_OPEN = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" '
  + 'stroke="black" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">';
const maskUrl = (paths: string): string => `url("data:image/svg+xml,${encodeURIComponent(`${SVG_OPEN}${paths}</svg>`)}")`;
const CHAT_MASK = maskUrl('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>');
const NOTES_MASK = maskUrl(
  '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h4"/>',
);

// Pure-CSS reskin of BBB's native sidebar nav. POSITION is untouched (BBB owns it) — cosmetic only.
const RESKIN_STYLE = `
  [data-test="userListContainer"] {
    /* Gray-100 rail so the nav reads as a distinct column from the white Chat/Notes panel that
       extends out beside it — the tone shift separates them, no border needed. Token lives in the
       base CSS :root; fallback keeps the rail grey even if the base CSS hasn't loaded yet. */
    background: var(--fm-gray-100, ${FM.gray100}) !important;
    font-family: ${FM.font} !important;
  }
  /* remove BBB's grey scroll-fade gradient behind the nav rows (it's a background-IMAGE, not a
     colour — that's the "grey boxes"). Our icons use mask-image, so they're unaffected. */
  [data-test="userListContainer"] * { background-image: none !important; }
  /* hide BBB's section headers */
  [data-test="messageTitle"], [data-test="notesTitle"] { display: none !important; }
  /* Chat + Notes → clean Fullmind tabs. Hiding BBB's child wrapper drops its built-in label + icon
     AND lets our ::before icon + ::after label sit together right after each other at the left. */
  [data-test="chatButton"] > *, [data-test="sharedNotesButton"] > * { display: none !important; }
  [data-test="chatButton"], [data-test="sharedNotesButton"] {
    display: flex !important;
    align-items: center !important;
    justify-content: flex-start !important;
    gap: 10px !important;
    /* width keeps the rounded box inside the 240px nav — without it the button stretches past the
       container's right edge and the overflow:hidden parent clips the right corners square. */
    width: calc(100% - 16px) !important;
    box-sizing: border-box !important;
    margin: 2px 8px !important;
    padding: 9px 12px !important;
    border-radius: 10px !important;
    border: 0 !important;
    cursor: pointer !important;
    color: ${FM.ink2} !important;
    background: transparent !important;
    box-shadow: none !important;
    outline: none !important;
  }
  /* our outline icons via mask (inherit colour → white on the coral active tab) */
  [data-test="chatButton"]::before, [data-test="sharedNotesButton"]::before {
    content: "" !important;
    flex: 0 0 22px !important;
    width: 22px !important;
    height: 22px !important;
    background-color: currentColor !important;
    -webkit-mask-size: contain !important; mask-size: contain !important;
    -webkit-mask-repeat: no-repeat !important; mask-repeat: no-repeat !important;
    -webkit-mask-position: center !important; mask-position: center !important;
  }
  [data-test="chatButton"]::before { -webkit-mask-image: ${CHAT_MASK} !important; mask-image: ${CHAT_MASK} !important; }
  [data-test="sharedNotesButton"]::before { -webkit-mask-image: ${NOTES_MASK} !important; mask-image: ${NOTES_MASK} !important; }
  /* our labels (smaller) */
  [data-test="chatButton"]::after, [data-test="sharedNotesButton"]::after {
    font: 600 13px/1 ${FM.font} !important;
  }
  [data-test="chatButton"]::after { content: "Chat" !important; }
  [data-test="sharedNotesButton"]::after { content: "Notes" !important; }
  /* hover: BBB-style grey box, rounded (declared BEFORE active so active wins on the open tab) */
  [data-test="chatButton"]:hover, [data-test="sharedNotesButton"]:hover { background: #e9ecef !important; }
  /* coral active tab — BBB sets aria-expanded="true" on the open nav item (no JS needed).
     color:#fff turns BOTH the ::after label and the ::before icon white (the icon uses
     background-color:currentColor, so it inherits this). */
  [data-test="chatButton"][aria-expanded="true"], [data-test="sharedNotesButton"][aria-expanded="true"] {
    background: ${FM.coral} !important;
    color: #fff !important;
    box-shadow: 0 6px 14px -6px rgba(243, 113, 103, 0.6) !important;
  }
  /* user rows hover — same light grey (Gray 200) as the Chat/Notes hover, so the whole nav matches */
  [data-test="userListContainer"] li:hover,
  [data-test="userListItemCurrent"]:hover,
  [data-test="userListItem"]:hover { background: #e9ecef !important; border-radius: 10px !important; }
  [data-test="userListContainer"] h2 {
    font: 700 11px/1 ${FM.font} !important;
    letter-spacing: 0.06em !important;
    text-transform: uppercase !important;
    color: #adb5bd !important;
    padding: 14px 14px 6px !important;
  }
  /* chat Send button → coral + rounded (the blue lived on the inner span[color="primary"]) */
  [data-test="sendMessageButton"], [data-test="sendMessageButton"] span[color="primary"] {
    background-color: ${FM.coral} !important;
    border-radius: 10px !important;
  }
  /* Unified GREY-OVERLAY hover for every coloured button — Send + action bar + Present + Raise hand.
     One inset translucent NEUTRAL grey (Gray 600 @ 18%) flooding the button: over a white circle it
     resolves to ~#e6e6e8 (matching the Chat/Notes/user grey); over the coral Send/active button it
     greys the coral toward neutral — never a brighter or darker coral. filter:none kills any leftover
     brightness hover. The shadow respects each button's own border-radius, so circles stay circular. */
  [data-test="sendMessageButton"]:hover,
  [data-test="actionsButton"]:hover,
  [data-test="unmuteMicButton"]:hover, [data-test="muteMicButton"]:hover,
  [data-test="joinVideo"]:hover, [data-test="leaveVideo"]:hover,
  [data-test="startScreenShare"]:hover, [data-test="stopScreenShare"]:hover,
  [data-test="reactionsButton"]:hover,
  [data-test="raiseHandBtn"]:hover {
    box-shadow: inset 0 0 0 999px rgba(108, 117, 125, 0.18) !important;
    filter: none !important;
  }
`;

// Load the global base reskin (plum bars, Fullmind logo, fonts) alongside the plugin. bbb0-v3
// ignores the `userdata-bbb_custom_style_url` room param, so the CSS used to be hand-injected —
// which a page reload always wiped ("css is not loaded"). Instead we derive the base-CSS URL from
// the plugin's OWN script origin (tunnel in dev, S3 in prod) and append a <link> to <head> once.
// Appending a fresh <link> is safe — it never touches BBB's React tree, so it can't crash BBB.
function ensureBaseCssLink(): void {
  if (typeof document === 'undefined' || document.getElementById('fm-base-css')) return;
  const self = Array.from(document.querySelectorAll('script[src]'))
    .find((s) => /FullmindClassroom\.js/i.test((s as HTMLScriptElement).src)) as
      HTMLScriptElement | undefined;
  if (!self) {
    // eslint-disable-next-line no-console
    console.warn('[FullmindClassroom] plugin script not found — base reskin CSS not loaded');
    return;
  }
  const url = new URL('fullmind-bbb-base.css', self.src);
  // carry the script's ?version= so the CSS busts cache in lockstep with the plugin bundle
  url.search = new URL(self.src).search;
  const link = document.createElement('link');
  link.id = 'fm-base-css';
  link.rel = 'stylesheet';
  link.href = url.href;
  document.head.appendChild(link);
}

export function LessonHubView({ pluginUuid }: { pluginUuid: string }): React.ReactElement {
  BbbPluginSdk.initialize(pluginUuid);
  // The plugin renders no UI and mutates no React DOM — it injects the nav reskin stylesheet below
  // and links the global base reskin once (see ensureBaseCssLink). BBB owns the layout and keeps
  // the whiteboard fixed, so switching is seamless and nothing can crash its React tree.
  React.useEffect(() => { ensureBaseCssLink(); }, []);
  return <style>{RESKIN_STYLE}</style>;
}

export function makeLessonHubWindow(pluginUuid: string): FloatingWindow {
  return new FloatingWindow({
    id: 'fullmind-lesson-hub',
    top: 0,
    left: 0,
    movable: false,
    backgroundColor: 'transparent',
    boxShadow: 'none',
    contentFunction: (element: HTMLElement): ReactDOM.Root => {
      const root = ReactDOM.createRoot(element);
      root.render(<LessonHubView pluginUuid={pluginUuid} />);
      return root;
    },
  });
}
