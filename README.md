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
