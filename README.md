# Fullmind Classroom — default BBB plugin

The **foundation** every Fullmind in-room feature is built on (LMS-aware timer, sidebar
panel, exit-ticket modal, branded notifications). It is a real, buildable BBB 3.0 plugin
cloned from the official `bigbluebutton/plugin-template` (`v0.0.x`, SDK `0.0.73`) with the
core `pluginApi` connections already wired up. Build a new feature by adding to
`src/fullmind-classroom/component.tsx` (or new files beside it) — the plumbing is done.

> A BBB plugin is a JS bundle the **server** delivers to every participant's browser
> automatically. Students install nothing. See `../KNOWLEDGE.md` §7 for the full model.

## What's already wired

In `src/fullmind-classroom/component.tsx`:

| Connection | API | Use it for |
|---|---|---|
| Core SDK handle | `BbbPluginSdk.initialize` + `getPluginApi` | everything |
| Tagged logging | `pluginLogger` (`[Fullmind]`) | proof-of-life + debugging |
| Current user | `pluginApi.useCurrentUser()` → `{ name, role, presenter, … }` | role-gating (MODERATOR/VIEWER) |
| Meeting data | `pluginApi.useMeeting()` → `Meeting[]` | the LMS-aware timer |
| Branded notification | `sendFullmindNotification()` → `uiCommands.notification.send` | branded toasts (client-side) |
| A UI surface | `pluginApi.setOptionsDropdownItems([...])` | proof-of-life ⋮-menu item |

All signatures were verified against the installed SDK `0.0.73` type definitions.

## Build

```bash
npm install          # already run; lockfile from the official template
npm run build-bundle # → dist/FullmindClassroom.js + dist/manifest.json
```

`manifest.json` `javascriptEntrypointUrl` (`FullmindClassroom.js`) must match
`webpack.config.js` `output.filename` — both are already set.

## Host + register (out of scope of this repo — needs infra/vidapi)

1. **Host** `dist/FullmindClassroom.js` + `dist/manifest.json` over HTTPS. Reuse the S3
   bucket the logo already uses (`public-global-files.s3.us-west-1.amazonaws.com`,
   proven reachable by BBB — see `../KNOWLEDGE.md` §3).
2. **Register** the manifest on the room:
   - *Quick test (no code):* API-mate `/create` against the test server with
     `pluginManifests=[{"url":"https://<host>/fullmind-classroom/manifest.json"}]`.
   - *Real Fullmind path:* add `pluginManifests` to `create_bbb_meeting` in
     `vidapi/app/utils/bbb/api.py` — a backend change → full ticket + Opus code review.
3. **Verify** in a live room (F12 console): look for `Loaded plugin FullmindClassroom`,
   open the ⋮ menu → **Fullmind — test connection** → expect the `[Fullmind]` logs + a toast.

## Extension points — where the un-wired connections go

Left out on purpose (YAGNI) until a feature needs them. When you build that feature:

- **Cross-user messaging (data channel)** — declare a `dataChannels` entry in `manifest.json`
  (name + push/replace permissions), then `pluginApi.useDataChannel(name, …)` in the
  component. Needed when a notification/state must appear on *every* participant's screen,
  not just one. (`KNOWLEDGE.md` §7.)
- **LMS data into the plugin (remote data)** — declare `remoteDataSources` in `manifest.json`
  pointing at a `${meta_…}` param, then read it via the SDK. This is how lesson-plan / timer
  data flows LMS → vidapi → plugin. Brainstorm the data contract first.
- **Sidebar panel** — add a Generic Content (sidekick) item via the SDK's extensible area,
  and badge it with `pluginApi.uiCommands.sidekickArea.options.setMenuBadge(id, '5')`. Base
  of the Fullmind sidebar (resources / lesson plan).
- **Floating window** — for the in-room exit-ticket modal.
- **Write to the backend** — `pluginApi.useCustomMutation('<graphql>')` (e.g. custom reactions).
- **Organizer-configurable settings** — a `settingsSchema` block in `manifest.json` exposes
  plugin settings to the meeting organizer via the LMS.
- **i18n** — add a `localesBaseUrl` to `manifest.json` + a `locales/` folder, then
  `pluginApi.useLocaleMessages()`.

See the full SDK surface in `../reference/bbb-plugins-docs.txt` and `../KNOWLEDGE.md` §7.

## Backlog — ported from the CSS reskin

Things the `fullmind-bbb-base.css` overlay **cannot** do (it can only restyle, not
restructure BBB's DOM), so they were deferred here. Each links back to a prototype
decision in `Prototype_01_2026-06-02_bbb-toolbar.html`.

- **Font-size stepper — value BETWEEN the buttons.** In Settings → Application, the
  prototype lays the row out as `Font size … [−] 90% [+]`. BBB's native DOM puts the
  `90%` value and the two buttons in **separate sibling cells** (value is outside the
  button group), so CSS can't interleave them — only restyle. The overlay already
  recolors the buttons coral→gray (`[data-test="decreaseFontSize"|"increaseFontSize"]`);
  this entry is the remaining **layout** half.
  - *Why not CSS:* the only CSS route is `display:contents`+`order` on BBB's **hashed**
    wrapper classes (`sc-*`), which BBB regenerates every build — fragile, breaks on
    upgrade.
  - *Plugin approach:* the SDK has no primitive for re-laying-out a built-in component,
    so do it imperatively — a `useEffect` that, while the settings panel is mounted,
    finds the value node and the two buttons by their **stable `data-test` hooks** and
    moves the value node between the button cells. JS *can* move a node across
    containers (CSS can't), which is why this belongs here.
  - *Risk:* it mutates BBB's native settings DOM, so re-verify after any BBB html5
    client upgrade (the `data-test` hooks are stable; the surrounding structure may not be).

- **Sidebar redesign — icon rail + push panel.** The prototype's left sidebar is a
  *different architecture* than BBB's, not a restyle: a vertical **Chat / Notes icon
  rail** (64px, coral active state, unread badge) feeding a 264px **push panel**. BBB
  3.0 has no persistent rail — chat, shared notes, and the user list are separate
  toggled panels — so the rail and the nav around it must be **built**, not styled. The
  CSS overlay handles the *contents* of the existing Public Chat panel (message bubbles,
  composer, Send, avatar shape); everything below is plugin work. Prototype refs:
  `.iconrail`, `.rail-btn`, `.slidepanel`.
  - **Chat / Notes icon rail** — a Generic Content (sidekick) area via the SDK's
    extensible area, OR a custom rail rendered by the plugin. Active = coral rounded
    square; this is the nav backbone the panel hangs off.
  - **Unread badge** (`3` on Chat) — `pluginApi.uiCommands.sidekickArea.options.setMenuBadge(id, '3')`.
  - *Risk / note:* the icon-rail nav may need to coexist with or replace BBB's native
    panel toggles — decide whether the plugin *adds* a rail or *re-homes* the native
    panels into it. This is a design decision, not just a build task.

  *Removed 2026-06-03: the "Class" tab + Level/XP gamification (Level 7 Explorer,
  per-user levels) — no way to build that feature yet, per Justin; not on the roadmap.
  Also dropped the "avatar initials" item: BBB chat avatars exist natively (per-user
  flat color via a `color="#…"` attr), so the CSS overlay restyles them — not plugin work.*

- **Whiteboard as an inset "floating card."** The prototype frames the whiteboard as
  a white rounded card with a ~22px light-gray mat around it (`.stage-main { padding:
  22px }`, `mainWhiteboard { border-radius:14px }`), so the board doesn't stretch
  edge-to-edge. The CSS overlay **cannot** do this. Verified live 6/3 against
  `bbb1-v3`: BBB's layout engine writes the stage geometry **inline as absolute px**
  on `[data-test="presentationContainer"]` (e.g. `width:894.6px; height:545.6px`) and
  renders the *entire* presentation — slide, bottom slide-navigation, presenter logo,
  and the blue tldraw editor frame — sized to that rectangle. Two CSS approaches were
  tried and both **crop** (clip the edge controls) rather than scale:
  1. `padding` on `presentationContainer` — slide stays full-size inside the padded
     box, overflow clipped.
  2. absolutely insetting the whiteboard wrapper (`> div:not([class*="Mui"])`) by 22px
     — the slide-nav, logo, and editor frame (siblings pinned to the full-size edges)
     get clipped off; tldraw does **not** re-measure to the wrapper.
  - *Root cause:* the slide-fit zoom is computed by **BBB's React layout** from
    `presentationContainer`'s measured geometry — not by tldraw independently observing
    its container — so no CSS shrink makes it re-fit smaller.
  - *Plugin approach:* feed BBB's layout a **smaller presentation bound** (inset the
    region the layout engine sizes the presentation into) so BBB re-fits the whole
    presentation — slide + nav + logo + frame — together into the inset card. This is a
    layout/structure change, the same class of work as the sidebar rail above. The CSS
    overlay keeps its lane: the light `--fm-stage` background behind the board (the
    "mat" colour) is already in `fullmind-bbb-base.css §B3`; only the *inset/scale* is
    plugin work.

- **Session Progress bar — SHIPPED (refinement open).** Already built in
  `src/fullmind-classroom/session-progress-bar.tsx`: a Fullmind-branded bar that fills
  with elapsed time and counts down minutes left, fed by `useCustomSubscription` on the
  GraphQL `meeting` table (`createdTime` + `durationInSeconds` — the timing fields are
  NOT on the typed `useMeeting` hook). Rendered as a `FloatingWindow` (the only area
  that takes arbitrary React).
  - *Form-factor delta vs prototype:* shipped as a **centered pill** pinned top-centre;
    the prototype draws it as a **full-width banner above the navbar** with a divider,
    a `Session Progress` label, a `%` readout, and `1:40 left` (`.banner`,
    `.masterbar > .fill#masterFill`, `.b-pct`, `.b-time`). Re-styling the floating
    window to the full-width banner is an open refinement, not new work — the data/logic
    is done. (The prototype's blue `4` pin is just a "plugin-provided" marker, not UI.)

- **Exit Ticket action-menu item — ITEM SHIPPED, behaviour deferred.** Built in
  `src/fullmind-classroom/exit-ticket.tsx`: adds the prototype's **"Start Exit Ticket"**
  entry to BBB's ⊕ Actions menu via `setActionButtonDropdownItems`, moderator-gated
  (`allowed: isModerator`), appended after BBB's native actions — mirroring the
  prototype's menu order. Per Justin (6/3), only the MENU ITEM ships now; the click
  behaviour is a placeholder.
  - *Wiring TODO:* `onClick` currently fires an honest "Exit Ticket — coming soon" toast
    and logs. Replace it with the real launcher — the prototype calls for a **modal**,
    and since the SDK has no true blocking modal, build it as a `FloatingWindow` styled
    to look modal (copy the `session-progress-bar.tsx` FloatingWindow pattern). Spec the
    exit-ticket flow (questions, where answers go) before building the modal body.
  - *Icon:* uses the stock glyph `'check'` (closest to the prototype's clipboard-check;
    the SDK takes a bbb-icons glyph NAME, not an SVG, so the custom prototype icon can't
    pass through). ⚠️ Confirm/swap against the live icon set on first room test — one
    constant (`EXIT_TICKET_ICON`) controls it; the label shows regardless.
