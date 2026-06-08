# Design — Exit Ticket in BBB (in-room)

**Date:** 2026-06-08
**Status:** Approved design — ready for implementation planning.
**Tracking:** Spec-doc only (no Jira, per Justin 2026-06-08). The code-workflow is
followed minus the Jira ticket (Step 1) and Jira comment (Step 7); TDD,
verification, Opus backend review, and Justin's visual sign-off all still apply.

## Goal

Let an educator's LMS-authored exit ticket be **completed by students inside the
BBB room**, with answers returning to the LMS.

1. **Author → route in.** Educator writes the exit ticket in the LMS for a session
   (unchanged). The plugin pulls that question **into** the room.
2. **Summon.** Educator opens the **⊕ Actions** menu in the lower action bar →
   **"Start Exit Ticket"** → the ticket pops up on **every student's screen**.
3. **Return.** Student answers flow **back to the LMS**, landing on the same
   per-session record the educator already reviews.

Students never leave the room. (This replaces the earlier "redirect out to the
LMS" idea — there is no standalone exit-ticket URL anyway.)

## Decisions (locked)

| Decision | Choice |
|---|---|
| Answer types (v1) | **All four**: single-choice, multiple-choice, open text, file upload |
| Star rating | **Included** (student rates educator 1–5, returned to LMS) |
| Teacher in-room view | **Live submission count** ("5 of 8 submitted") |
| Trust model | **Approach A** — short-lived signed submit-token, delivered via the SDK's `remoteDataSources` |
| Authoring | LMS only (educator, per session); the plugin fetches, never authors |
| Summon mechanism | Data channel broadcast (moderator → all clients) |

## Background — how exit tickets ("EOS") work in the LMS today

"Exit ticket" = **EOS (End Of Session)** in code. It is a `:question` attached to
a `:session`, plus `:student_response` entities, plus an optional `:rating`.

- **Authored by the educator, per session**, in the LMS (`ManageSession`):
  `POST /api/v2/eos/question/session/{sessionId}`.
- **Four answer types:** `s` single-choice, `m` multiple-choice, `t` text,
  `f` file. Choice types **auto-score on submit** (`end_of_session/scoring.clj`);
  text/file are educator-graded.
- **Students take it as a dashboard MODAL today** (cookie-triggered after class) —
  there is **no `/exit-ticket/:id` URL and no token**. Identified by
  **(sessionId, studentId)**.
- **Submit:** `POST /api/v2/eos/student_response/session/{sessionId}/student/{studentId}`.
- **After submit:** stored in Datomic; auto-scored for choice; denormalized onto
  the session doc in ElasticSearch (`eosData`); surfaced in the **Exit Ticket
  Reports** dashboard (`/exit-ticket-reports`, by educator/student/school) and the
  per-session grading table (`EosTable`); score/reminder emails via SendGrid.
  **Nothing leaves the LMS** (no Salesforce, no warehouse, no billing gating, no
  export, no auto-deletion). **No parent-facing view.**

## Architecture (three codebases)

```
┌─────────────────┐  meta_* = LMS bootstrap URL   ┌──────────────────┐
│  vidapi          │ ────────────────────────────▶ │  BBB room +       │
│ (room creator,   │  (set at create; we control)  │  Fullmind plugin  │
│  we control it)  │                                └────────┬─────────┘
└─────────────────┘                                          │ getRemoteData → question + token
                                                             │ POST answers/rating (+ token)
                                                             ▼
┌────────────────────────────────────────────────────────────────────┐
│  v2_lms backend — new bootstrap + submit endpoints (token-verified)   │
│  reuse existing create-student-response → same reports/grading        │
└────────────────────────────────────────────────────────────────────┘
```

### Delivery mechanism (verified against `reference/bbb-plugins-docs.txt`)

- A plugin **cannot** read custom `userdata-*` join parameters — there is no SDK
  hook for it. So "inject a pass into the join, plugin reads it" is **not viable.**
- BBB's documented mechanism is **`remoteDataSources`**: the plugin manifest
  declares a data source whose URL is templated from a `meta_*` create param; the
  plugin calls `pluginApi.getRemoteData(name)` and BBB fetches that LMS URL. This
  is the channel for the bootstrap fetch (question + token).
- Broadcast to all clients uses **`useDataChannel`** (moderator `pushPermission`);
  the SDK can't inject UI on a remote client, so we broadcast a state flag and each
  client opens its **own** FloatingWindow in response.

## Data flow (click-by-click)

**Setup:** educator authors the ticket in the LMS (published); room is created with
`meta_*` pointing the plugin's remote-data-source at the LMS bootstrap endpoint.

**Route-in:** plugin loads → `getRemoteData('exitTicket')` → LMS returns the
**question** (text, type, choices, rating-requested?) + a **signed submit-token**
scoped to (this student, this session).

**Summon:** educator opens ⊕ Actions → **Start Exit Ticket** → plugin (moderator)
`pushEntry('open')` on the data channel → every student client opens its own modal.

**Complete & return:** student answers (choice/text/file) + stars → Submit → plugin
POSTs to the LMS submit endpoint with the token → LMS verifies token, resolves
session+student, **reuses `create-student-response`** → lands in today's
reports/grading. Plugin then `pushEntry('submitted')` (count signal only).

**Count & close:** teacher panel tallies "submitted" pings vs roster → "N of M".
Teacher clicks Close → `pushEntry('close')` → all student modals dismiss.

## Components to build

### BBB plugin (`fullmind-classroom-plugin`)
| File | Job |
|---|---|
| `src/fullmind-classroom/exit-ticket.tsx` (from `deferred/.wip`) | ⊕-menu item (moderator-only) + open/close broadcast + watcher + `getRemoteData` bootstrap |
| `src/fullmind-classroom/exit-ticket-modal.tsx` | Student modal (FloatingWindow-as-modal): renders by type + star rating; Submit → LMS; submitted state |
| `src/fullmind-classroom/exit-ticket-teacher-panel.tsx` | Live "N of M submitted" count |
| `src/fullmind-classroom/lms-client.ts` | fetch wrapper: fetch question, submit answer/rating, upload file |
| `manifest.json` | add `dataChannels` + `remoteDataSources` entries; bump version |
| `register-floating-windows.tsx` | register modal + teacher panel (single `setFloatingWindows` caller) |

### v2_lms backend (Clojure)
| Component | Job |
|---|---|
| Bootstrap endpoint (`remoteDataSource` target) | Return session's published question + signed short-lived submit-token scoped to (student, session) |
| Submit endpoint (token + uuids) | Verify token; resolve BBB uuids → LMS ids via existing `get-attendence-by-uuids`/`by-uuid`; **reuse `create-student-response`** (+ rating + file) |
| CORS | Add BBB room origin to allowlist (`cors-extra-origins`) |
| Token sign/verify util | New shared-secret signer |

### vidapi (room creator)
| Component | Job |
|---|---|
| Create call | Set `meta_*` → LMS bootstrap URL, carrying a meeting-scoped signed value so the LMS trusts the request |

**Reuse (manager rule #1):** backend reuses existing answer-recording + auto-scoring
(choices score server-side exactly as today); the plugin modal mirrors the LMS
`EosAnswerForm` behavior (types `s/m/t/f`, validation, lock-after-scored). We add an
*entry path*, not a parallel system.

## Security / trust model

The LMS today trusts BBB webhooks because they're **server-to-server on a private
network**; a student's browser is **not** trusted that way. So:

- The bootstrap fetch (via `remoteDataSources`) returns a **short-lived, signed
  submit-token** scoped to (student, session). The plugin includes it on submit;
  the LMS verifies the signature → can't be forged, expires after class.
- The bootstrap endpoint's own request legitimacy is established by a
  **meeting-scoped signed value** carried in the `meta_*` URL (only the LMS could
  mint it at room create).
- **OPEN ITEM (backend to finalize):** exactly how the bootstrap endpoint confirms
  *which user* is asking on that initial fetch (does BBB pass the user identity on a
  `remoteDataSource` fetch, or does the token need to be per-meeting + the submit
  carry the BBB user uuid for server-side resolution?). The mechanism is supported;
  the precise per-user binding is a backend detail to confirm early.
- We do **not** ship the "open mailbox" variant (unauthenticated browser-reachable
  write endpoints) — that's only safe for the existing private server-to-server
  webhooks, not for browser submissions of student data / educator ratings.

## Error handling & edge cases

- **No ticket authored when teacher clicks Start:** bootstrap reports none → teacher
  sees "No exit ticket is set up for this session — create one in the LMS first";
  nothing broadcasts.
- **Student joins late:** data channel replays latest "open" state → modal opens on join.
- **Already answered (refresh/rejoin):** show submitted state, don't re-prompt
  (existing handler upserts, so a duplicate is safe).
- **Submit fails / token expired:** retry w/ backoff; re-fetch token; final fallback
  is the **existing LMS dashboard modal** (question is published, normal post-class
  flow still catches them).
- **LMS unreachable / CORS misconfig:** bootstrap fails → "exit ticket unavailable";
  nothing broadcasts (fail safe).
- **File upload errors:** client-side size/type validation + retry; same S3 path as LMS.
- **Roles:** students get the modal; teacher gets the count panel — role-gated.
- **Double-click / multiple moderators:** "open" is idempotent channel state.

## Modal UI

No full mockup ever existed (only the ⊕-menu item was prototyped), so we build from
the verified Fullmind design system, consistent with the reskin:

- **Shell:** `FloatingWindow` styled as a modal — centered, `movable:false`, scrim
  `rgba(33,37,41,.55)`, card radius **14px**, off-white/white surface, **plum**
  (`#403770`) header, **Plus Jakarta Sans**.
- **Structure:** Header (plum: "Exit Ticket" + topic) → Body (question + answer UI)
  → star-rating row → Footer (**coral** `#F37167` Submit, gray Cancel).
- **Answer types:** choice = rounded 14px answer tiles (gamified-quiz pattern,
  per-option hue, selected = coral border + check); text = composer-style input
  (focus coral); file = upload control → S3; rating = 1–5 stars.
- Loop in AD for a mockup review before/after first build.

## Testing

- **Plugin:** unit-test open/close channel logic, bootstrap parsing, per-type
  rendering, submit-payload building (mock SDK per repo convention); manual live
  verification in a test room (`docs/TESTING-A-ROOM.md`).
- **Backend (Opus review):** bootstrap (returns question + token; rejects bad room
  signature), token verify, uuid→id resolution, submit reusing
  `create-student-response`, CORS. Data-shape audit on `s/m/t/f` codes vs fixtures.
- **vidapi:** verify `meta_*` set on create.
- **End-to-end (Opus):** Start → modal → submit → appears in LMS reports/grading,
  verified in a real room (kill/restart/wipe cache; Justin does visual sign-off).

## Build order (sequence the work)

1. **Backend (v2_lms):** bootstrap + submit endpoints, token util, CORS. *(Opus.)*
2. **vidapi:** set the `meta_*` bootstrap URL on create.
3. **Plugin plumbing:** `remoteDataSources` fetch + data-channel open/close + submit wiring.
4. **Plugin UI (last):** the modal + teacher count panel + file upload.

The in-room prompt is last; it can't be meaningfully built before the route-in,
broadcast, and return path exist.

## Open items / risks

- **Per-user binding on the bootstrap fetch** (security open item above) — confirm first.
- **`remoteDataSources` fetch semantics** — confirm whether BBB passes user identity
  and `fetchMode` (`onMeetingCreate` cache vs `onDemand` fresh) behavior in a live room.
- **File upload from inside BBB** — heaviest piece; may sequence last even within v1.
- **Cross-repo coordination** — backend + vidapi changes need the owning team's
  review; plugin + backend land as separate PRs (merge one at a time).

## Key references (from research)

- Plugin SDK: `node_modules/bigbluebutton-html-plugin-sdk/dist/cjs/data-channel/types.d.ts`
  (`useDataChannel`, `pushEntry`); `reference/bbb-plugins-docs.txt` (`remoteDataSources`
  ~lines 779–815; hooks ~489–500).
- BBB API: `reference/bbb-api-docs.txt` (`userdata-*` 1538–1540; `meta_*` create 335–341).
- LMS EOS: `v2_lms` `end_of_session/{routes,handler,scoring}.clj`,
  `sessions/{query,webhook_handler}.clj` (`get-attendence-by-uuids`), `middle.clj`
  (CORS), `sessions/model.clj` (`generate-wb-link-from-session`: meeting=`:ent/uuid`,
  attendee=student role `:ent/uuid`); frontend `v2_lms_react/src/components/forms/eos/`.
- Plugin scaffolding: `deferred/exit-ticket.tsx.wip` (⊕-menu item built);
  `src/fullmind-classroom/session-progress-bar.tsx` (FloatingWindow template).
