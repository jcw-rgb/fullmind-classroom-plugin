# Dev handoff — load the Fullmind Classroom plugin into ONE test room

**Goal:** make the production BBB server serve this plugin to **a single LMS test room only**,
so Justin can verify it live. Same change, gated, becomes the production rollout later.

**Who needs to do what**
- *Already done (no dev needed):* the plugin is built (`dist/FullmindClassroom.js` + `dist/manifest.json`).
- *Dev (you):* (1) upload 2 files to S3, (2) add a **gated** `pluginManifests` to the vidapi create call, (3) deploy.
- *Justin:* joins the test room, verifies, gives the go to widen the gate.

---

## 1. Host the two files on S3

Upload **both** files, unchanged, into one folder of the existing public bucket
(`public-global-files`, the same bucket that already serves the room logo — proven reachable by BBB):

```
s3://public-global-files/fullmind-classroom-plugin/manifest.json
s3://public-global-files/fullmind-classroom-plugin/FullmindClassroom.js
```

Resulting public URLs (must be HTTPS + publicly GET-able, like the logo):

```
manifest:  https://public-global-files.s3.us-west-1.amazonaws.com/fullmind-classroom-plugin/manifest.json
bundle:    https://public-global-files.s3.us-west-1.amazonaws.com/fullmind-classroom-plugin/FullmindClassroom.js
```

> The manifest's `javascriptEntrypointUrl` is **relative** (`"FullmindClassroom.js"`), so BBB
> resolves the bundle from the **same folder** as the manifest. Keep both files together; that's the only constraint.
> `manifest.json` already carries `"version": "0.0.4"` — BBB appends `?version=0.0.4` to bust browser cache.
> **When the bundle changes, bump that version** (in `manifest.json`) and re-upload both, or clients keep the cached JS.

---

## 2. Add a gated `pluginManifests` to the create call

**File:** `vidapi/app/utils/bbb/api.py` → `create_bbb_meeting`
(the function that already builds the BBB `/create` params — logo, displayBrandingArea, welcome, logoutURL, meta_*).

**Add ONE param, only for the test room.** BBB's create param format (verified against BBB 3.0 plugin docs):

```python
pluginManifests=[{"url":"https://public-global-files.s3.us-west-1.amazonaws.com/fullmind-classroom-plugin/manifest.json"}]
```

Illustrative slot-in (adapt variable names to the real dict in `create_bbb_meeting`):

```python
import json
from app.config import settings  # wherever vidapi reads env/config

FULLMIND_PLUGIN_MANIFEST_URL = (
    "https://public-global-files.s3.us-west-1.amazonaws.com/fullmind-classroom-plugin/manifest.json"
)

# ... inside create_bbb_meeting, where `params` (the create-param dict) is assembled,
#     BEFORE the checksum is computed:

# GATE: only the test room gets the plugin. Allowlist by BBB meetingID (safest).
# Put the test room's meetingID in an env var so prod classes are untouched.
test_ids = settings.FULLMIND_PLUGIN_TEST_MEETING_IDS  # e.g. comma-separated env string
if meeting_id in {x.strip() for x in test_ids.split(",") if x.strip()}:
    params["pluginManifests"] = json.dumps(
        [{"url": FULLMIND_PLUGIN_MANIFEST_URL}],
        separators=(",", ":"),  # compact JSON, no spaces
    )
```

### ⚠️ The one thing that will silently break it
`pluginManifests` must be added to the **same param dict that gets signed** by
`auth.py → signed_url` (SHA-1 of `cmd + queryString + secret`). If it's appended to the URL
*after* the checksum is computed, BBB rejects the call with a checksum mismatch and the meeting
won't create. Add it before signing — then the existing signing code covers it automatically.

### Gating choices (pick one)
- **Allowlist by meetingID (recommended):** env var `FULLMIND_PLUGIN_TEST_MEETING_IDS`. Flip to prod = remove the `if`.
- **By meeting name marker:** if the test room has a distinctive name, gate on that instead.
- **Server-wide (prod rollout, later):** drop `pluginManifests` into `/etc/bigbluebutton/bbb-web.properties`
  on the BBB box — applies to every meeting, no per-create change. (Create-call + properties lists are *merged*, so this is additive and safe.)

---

## 3. Verify (Justin, in the test room)

1. Join the LMS test room as normal.
2. Open browser console (F12) → look for `Loaded plugin FullmindClassroom`.
3. Open the **⋮ (Options)** menu → click **"Fullmind — test connection"**.
4. Expect: `[Fullmind]` log lines (user + meeting data) **and** a branded toast
   `Hi <name> — connected to <room>…`. That confirms the whole pipeline (load → run → read room data → render UI).
5. The bundle also renders the **Lesson Hub rail** — a vertical bar of three icon
   buttons (Chat / Notes / Class) docked to the left edge below the top nav. Click
   one to slide out its panel. Chat/Notes/Class start empty and fill from the live
   room. Four `// CONFIRM IN LIVE ROOM` constants in the source (`NOTES_PAD_URL` +
   three BBB-layout selectors + the rail top offset) need tuning once in the test
   room so the rail sits below the nav, the panel "push" shrinks the whiteboard, and
   BBB's native sidebar is hidden — see `src/fullmind-classroom/features/README.md`.

---

## 4. Compatibility note
- `manifest.json` requires SDK `~0.0.73` (matches BBB 3.0). Confirm the production server's html5 client
  ships a compatible `bigbluebutton-html-plugin-sdk` (0.0.7x line). If the server is newer, rebuild against its SDK version and bump the manifest `version`.

## 5. Ship to all classes (after Justin signs off)
- Remove the `if` gate (apply to every create) **or** move the `pluginManifests` line to
  `bbb-web.properties` server-wide. Either way, the bundle + manifest already on S3 are unchanged.

---

*Bundle built from this repo with `npm run build-bundle` (SDK 0.0.73, webpack production). Source: `src/fullmind-classroom/component.tsx`.*
