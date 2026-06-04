# Feature — Session Progress bar (prototype pin 4)

The first real plugin feature built on the foundation. A thin Fullmind-branded
bar pinned at the top of the room that **fills as the session elapses** and
counts down the **minutes remaining**.

> Maps to `Prototype_01_2026-06-02_bbb-toolbar.html` pin **4** ("PLUGIN LATER"):
> *"Not native AND not CSS — a bar that fills with elapsed/total time is new
> stateful UI, so it's a plugin."*

## Files (the template was NOT overwritten)

| File | Role |
|---|---|
| `src/fullmind-classroom/component.tsx` | **Untouched** foundation/template. |
| `src/fullmind-classroom/session-progress-bar.tsx` | **NEW** — the feature (registrar + the bar view). |
| `src/fullmind-classroom/component-working.tsx` | **NEW** — the working root: foundation + each feature, as siblings. |
| `src/index.tsx` | One-line entry switch (foundation → working root). Revert line is in a comment. |

To run the bare template again, swap the one import in `index.tsx` back to
`./fullmind-classroom/component`.

## How it works (verified against SDK 0.0.73)

- **Data:** the timing is NOT on the typed `useMeeting` hook (that returns only
  `name`/`meetingId`/`loginUrl`). It comes from BBB's GraphQL `meeting` table via
  **`useCustomSubscription`** — the hook the prototype legend named.
- **Surface:** the nav bar area only accepts a label+icon, so a *filling* bar
  can't live there (the legend's "no nav-bar plugin slot"). The bar is a
  **floating window** — the area whose `contentFunction` renders arbitrary React.
- **Self-updating:** SDK hooks are window-event bridged (not React-context
  bound), so the bar runs its own subscription + 1s tick inside the floating
  window's own root. The window is registered **once**; it never re-thrashes.

### Design tradeoff (surfaced, not hidden)
The prototype draws the bar *embedded in the nav banner*. The SDK has no slot for
custom UI in the nav, so it is a floating window pinned top-center instead —
visually faithful (real gradient fill), structurally an overlay. The only
alternative is a text-only nav `INFO` label (e.g. unicode blocks), which loses
the smooth fill. Flag for review if embedded-in-nav is a hard requirement.

## ⚠️ One thing to confirm in the first live room

The GraphQL field names `createdTime` and `durationInSeconds` are the documented
BBB 3.0 `meeting` columns but were **not** confirmable against a live schema from
the build machine. In the test room, open the console and check the bar fills.
If it stays empty, the field names are the only thing to adjust — they're
isolated in `SESSION_TIMING_SUBSCRIPTION` at the top of
`session-progress-bar.tsx`; the math is generic. (`durationInSeconds === 0` is
handled as "unlimited" → the bar shows **Live** instead of dividing by zero.)

## Build + deploy

```bash
npm run build-bundle   # → dist/FullmindClassroom.js + dist/manifest.json
```

Bundle rebuilt; `manifest.json` bumped **0.0.1 → 0.0.2** so BBB busts the cached
JS (`?version=0.0.2`). Hosting + registration are unchanged — follow
`DEV-HANDOFF.md` (upload both `dist/` files to the same S3 folder, gated
`pluginManifests` on the test room).

## Verify (in the test room)

1. Join the test room. The bar appears pinned at the top.
2. It fills left→right as the session runs; the right reads `N min left`.
3. Under 5 minutes: the dot + readout turn amber (system-status cue, not error).
