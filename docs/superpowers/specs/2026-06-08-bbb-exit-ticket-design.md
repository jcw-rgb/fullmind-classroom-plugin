# Design — Exit Ticket in BBB (in-room)

> **⚠️ ADDENDUM (2026-06-12) — two mechanisms below were superseded during the build.**
> This spec is kept as the design-time record; the as-built deviations, both forced by
> BBB 3.0.18 realities and both live-verified:
>
> 1. **Route-in.** `remoteDataSources`/`getRemoteData` has NO server implementation on
>    BBB 3.0.x — the `/api/plugin/{name}/{source}/` endpoint the SDK calls returns a
>    bare nginx 404 (verified against the 3.0.18 source: no nginx route, no bbb-web
>    mapping, no akka handler). The plugin instead fetches the question DIRECTLY from
>    vidapi's question proxy (GET added to the scoped exit-ticket CORS), discovering
>    the external meeting id via `useCustomSubscription` on `meeting.extId`.
> 2. **Return path.** There is no vidapi "harvester" polling BBB's data channel.
>    Instead the TEACHER's plugin client relays each verified answer entry to vidapi
>    (`use-teacher-relay.ts` — deduped per student, reconnect self-healing), and vidapi
>    forwards server-to-server to the LMS with the meeting-scoped HMAC `relayToken`
>    minted onto the question payload. Consequence: the browser DOES talk to vidapi
>    (scoped CORS), never to the LMS. Type-'f' files upload browser→vidapi as
>    multipart (not pre-signed S3) — a binary can't ride the data channel.
>
> The "Submit trust model", "no CORS change", and "pre-signed S3 PUT" lines below are
> therefore historical. Security posture of the as-built path (self-asserted extId,
> deferred fromUserId reconciliation, is_correct in the room payload) is documented in
> `src/fullmind-classroom/exit-ticket/constants.ts` and the three PR descriptions.

**Date:** 2026-06-08
**Status:** Superseded in part — see addendum above. (At design time: approved design.)
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

Students never leave the room.

## Decisions (locked)

| Decision | Choice |
|---|---|
| Answer types (v1) | **All four**: single-choice, multiple-choice, open text, file upload |
| Star rating | **Included** (student rates educator 1–5, returned to LMS) |
| Teacher in-room view | **Live submission count** ("5 of 8 submitted") |
| Route-in mechanism | SDK **`remoteDataSources`** (meeting-level, server-fetched — confirmed) |
| Submit trust model | **Path 2 — server-relay**: plugin → BBB data channel → **vidapi** harvester → LMS (server-to-server). BBB vouches each sender's identity, so no impersonation. |
| Authoring | LMS only (educator, per session); the plugin fetches, never authors |
| Summon mechanism | Data channel broadcast (moderator → all clients) |
| Implementer | Us, all four subsystems |

## Spike result (2026-06-08) — why the trust model is server-relay

`reference/bbb-plugins-docs.txt` (lines 796–798) confirms `remoteDataSources` is
fetched by **BBB's plugin-server, server-side, at the meeting level** (one URL per
meeting via `meta_*`, cached on create or re-proxied on demand; `permissions` only
gates roles). It therefore **can deliver the question** (same for all students) but
**cannot deliver a per-student token** (the fetch carries no per-user identity).

So the browser cannot be handed an unforgeable per-student credential. The secure
path is to **not let the browser talk to the LMS at all**: the student's plugin
pushes its answer onto the BBB **data channel** (where BBB stamps the verified
`fromUserId`), and **our vidapi reads those entries and forwards them to the LMS
server-to-server**. No browser→LMS calls anywhere → **no CORS change, no per-user
token util needed.**

## Background — how exit tickets ("EOS") work in the LMS today

"Exit ticket" = **EOS (End Of Session)** in code: a `:question` attached to a
`:session`, plus `:student_response` entities, plus an optional `:rating`.

- **Authored by the educator, per session**, in the LMS (`ManageSession`):
  `POST /api/v2/eos/question/session/{sessionId}`.
- **Four answer types:** `s` single-choice, `m` multiple-choice, `t` text, `f` file.
  Choice types **auto-score on submit** (`end_of_session/scoring.clj`); text/file are
  educator-graded.
- **Students take it as a dashboard MODAL today** (cookie-triggered after class) — no
  `/exit-ticket/:id` URL, no token. Identified by **(sessionId, studentId)**.
- **Submit:** `POST /api/v2/eos/student_response/session/{sessionId}/student/{studentId}`.
- **After submit:** stored in Datomic; auto-scored for choice; denormalized onto the
  session doc in ElasticSearch (`eosData`); surfaced in the **Exit Ticket Reports**
  dashboard (`/exit-ticket-reports`) and the per-session grading table (`EosTable`);
  score/reminder emails via SendGrid. Nothing leaves the LMS. No parent-facing view.

## Architecture (three codebases)

```
            meta_* = LMS question URL (set at create; server-side fetch)
┌─────────────────┐ ───────────────────────────────▶ ┌──────────────────┐
│  vidapi          │                                   │  BBB room +       │
│ (room creator    │ ◀── reads data-channel entries ── │  Fullmind plugin  │
│  + harvester;    │     (BBB stamps verified sender)  └────────┬─────────┘
│  WE CONTROL IT)  │                                            │ getRemoteData → question
│                  │ ── forwards answers (server↔server) ──┐    │ pushEntry(answer) → data channel
└─────────────────┘                                       │    │
                                                           ▼    ▼
┌────────────────────────────────────────────────────────────────────┐
│  v2_lms backend                                                       │
│   • question-source endpoint (returns published question; called      │
│     server-side by BBB's plugin-server via remoteDataSources)         │
│   • submit endpoint (called by vidapi, server-to-server): resolve BBB  │
│     uuids → LMS ids, REUSE create-student-response → same reports      │
└────────────────────────────────────────────────────────────────────┘
```

**The browser only ever talks to BBB.** Route-in and submit both cross to the LMS
server-side. This is what makes Path 2 secure.

## Data flow (click-by-click)

**Setup:** educator authors the ticket in the LMS (published); room created with a
`meta_*` pointing the plugin's `remoteDataSources` at the LMS question endpoint.

**Route-in:** plugin calls `getRemoteData('exitTicket')` → BBB's plugin-server fetches
the LMS question endpoint and proxies back the **question** (text, type, choices,
rating-requested?) + the **sessionId** for the room.

**Summon:** educator opens ⊕ Actions → **Start Exit Ticket** → plugin (moderator)
`pushEntry('open')` on the data channel → every student client opens its own modal.

**Complete & return:** student answers (choice/text + stars) → Submit → plugin
`pushEntry(answer)` on a dedicated answers sub-channel (BBB stamps the verified
`fromUserId` = student role uuid). **vidapi reads** that entry and **POSTs it to the
LMS submit endpoint** (server-to-server). LMS resolves uuids → (sessionId, studentId)
via existing `get-attendence-by-uuids`/`by-uuid` and **reuses `create-student-response`**
(+ rating) → lands in today's reports/grading. Plugin also `pushEntry('submitted')`
(count signal).

**Count & close:** teacher panel tallies "submitted" pings vs roster → "N of M".
Teacher clicks Close → `pushEntry('close')` → all student modals dismiss.

**File upload (type `f`) — separate path, sequenced last:** the data channel can't
carry a binary blob. The question endpoint returns a **pre-signed S3 PUT URL** (scoped
to the meeting's upload folder); the browser uploads the file directly to S3 via that
signed URL (no LMS auth needed — the signature authorizes it), then the file
*reference* rides the data channel like any other answer. (Mini-design TBD in the
file-upload phase.)

## Components to build

### BBB plugin (`fullmind-classroom-plugin`)
| File | Job |
|---|---|
| `src/fullmind-classroom/exit-ticket.tsx` (from `deferred/.wip`) | ⊕-menu item (moderator-only) + open/close broadcast + watcher + `getRemoteData` route-in |
| `src/fullmind-classroom/exit-ticket-modal.tsx` | Student modal (FloatingWindow-as-modal): renders by type + star rating; Submit → `pushEntry(answer)`; submitted state |
| `src/fullmind-classroom/exit-ticket-teacher-panel.tsx` | Live "N of M submitted" count (watches "submitted" pings) |
| `manifest.json` | add `dataChannels` (open/close/answer/submitted) + `remoteDataSources` (question) entries; bump version |
| `register-floating-windows.tsx` | register modal + teacher panel (single `setFloatingWindows` caller) |

(No browser LMS-client module — the plugin never calls the LMS directly.)

### v2_lms backend (Clojure)
| Component | Job |
|---|---|
| Question-source endpoint | Returns the session's published question for a meeting (called server-side by BBB's plugin-server via `remoteDataSources`); identifies the session from the meeting uuid carried in the `meta_*` URL |
| Submit endpoint (server-to-server, called by vidapi) | Resolve BBB uuids → LMS ids via existing `get-attendence-by-uuids`/`by-uuid`; **reuse `create-student-response`** (+ rating); optionally gated by a shared secret |
| (No CORS change, no per-user token util needed) | — |

### vidapi (room creator + harvester) — WE CONTROL IT
| Component | Job |
|---|---|
| Create call | Set `meta_*` → LMS question endpoint URL (carrying the meeting/session reference) |
| **Answers harvester** | Read the plugin's answer data-channel entries for the meeting (BBB stamps the verified `fromUserId`) and forward each to the LMS submit endpoint server-to-server |

**Reuse (manager rule #1):** backend reuses existing answer-recording + auto-scoring;
plugin modal mirrors the LMS `EosAnswerForm` behavior (`s/m/t/f`, validation,
lock-after-scored). We add an *entry path*, not a parallel system.

## Security / trust model (Path 2)

- **No browser→LMS calls.** Route-in is a server-side `remoteDataSources` fetch; submit
  is browser→data channel→vidapi→LMS. The browser only ever talks to BBB.
- **Identity is vouched by BBB:** each data-channel entry carries a `fromUserId` that
  BBB sets (the student joined via a signed join URL minted by the LMS for *that*
  student). vidapi trusts it; a student cannot forge a classmate's `fromUserId`.
- **vidapi→LMS** runs server-to-server (private), following the existing webhook trust
  model; optionally hardened with a shared secret (net-new, small).
- **Route-in URL secrecy:** the `meta_*` question URL is injected server-side at create
  and never exposed to the browser; can carry a meeting-scoped signed value so the LMS
  trusts the plugin-server fetch.

## Error handling & edge cases

- **No ticket authored when teacher clicks Start:** route-in reports none → teacher sees
  "No exit ticket is set up for this session — create one in the LMS first"; nothing broadcasts.
- **Student joins late:** data channel replays latest "open" state → modal opens on join.
- **Already answered (refresh/rejoin):** show submitted state, don't re-prompt (existing
  handler upserts, so duplicates are safe; vidapi can also de-dupe per `fromUserId`).
- **vidapi→LMS submit fails:** retry w/ backoff from vidapi; final fallback is the
  **existing LMS dashboard modal** (question is published, normal post-class flow catches them).
- **LMS unreachable at route-in:** `getRemoteData` fails → "exit ticket unavailable";
  nothing broadcasts (fail safe).
- **File upload errors:** client-side size/type validation + retry; pre-signed S3 PUT.
- **Roles:** students get the modal; teacher gets the count panel — role-gated.
- **Double-click / multiple moderators:** "open" is idempotent channel state.

## Modal UI

No mockup ever existed (only the ⊕-menu item was prototyped), so we build from the
verified Fullmind design system, consistent with the reskin:

- **Shell:** `FloatingWindow` styled as a modal — centered, `movable:false`, scrim
  `rgba(33,37,41,.55)`, card radius **14px**, off-white/white surface, **plum**
  (`#403770`) header, **Plus Jakarta Sans**.
- **Structure:** Header (plum: "Exit Ticket" + topic) → Body (question + answer UI) →
  star-rating row → Footer (**coral** `#F37167` Submit, gray Cancel).
- **Answer types:** choice = rounded 14px answer tiles (gamified-quiz pattern,
  per-option hue, selected = coral border + check); text = composer-style input (focus
  coral); file = upload control → pre-signed S3; rating = 1–5 stars.
- Loop in AD for a mockup review before/after first build.

## Testing

- **Plugin:** unit-test open/close channel logic, route-in parsing, per-type rendering,
  answer `pushEntry` payload building (mock SDK per repo convention); manual live
  verification in a test room (`docs/TESTING-A-ROOM.md`).
- **Backend (Opus review):** question-source endpoint (returns published question;
  resolves session from meeting uuid), submit endpoint (uuid→id resolution, reuse
  `create-student-response`, optional shared-secret gate). Data-shape audit on `s/m/t/f`
  codes vs fixtures.
- **vidapi (Opus review):** `meta_*` set on create; harvester reads data-channel entries
  and forwards correctly; de-dupe + retry.
- **End-to-end (Opus):** Start → modal → submit → appears in LMS reports/grading, verified
  in a real room (kill/restart/wipe cache; Justin does visual sign-off).

## Build order (sequence the work)

1. **Backend (v2_lms):** question-source endpoint + submit endpoint (+ optional secret). *(Opus.)*
2. **vidapi:** set `meta_*` question URL on create + build the answers harvester. *(Opus.)*
3. **Plugin plumbing:** `remoteDataSources` route-in + data-channel open/close/answer/submitted wiring.
4. **Plugin UI:** modal + teacher count panel — **file upload last** (needs the pre-signed-S3 mini-design).

The in-room prompt is last; it can't be meaningfully built before route-in, broadcast,
and the return path exist.

## Open items / risks

- **vidapi reading BBB data-channel entries** — confirm the mechanism early (likely
  querying BBB's GraphQL `pluginDataChannelEntry` with an internal token; vidapi already
  talks to BBB but this is a new API surface). This gates the harvester.
- **File upload under Path 2** — needs the pre-signed-S3 sub-design; heaviest piece,
  sequenced last even within v1.
- **Answers transiting the data channel** — restrict the answer sub-channel's read
  permission so other students can't read peers' answers; keep payloads minimal.
- **Cross-repo coordination** — backend + vidapi + plugin land as separate PRs (merge one
  at a time); backend/vidapi want Opus review.

## Key references (from research)

- Plugin SDK: `node_modules/bigbluebutton-html-plugin-sdk/dist/cjs/data-channel/types.d.ts`
  (`useDataChannel`, `pushEntry`, `fromUserId`); `reference/bbb-plugins-docs.txt`
  (`remoteDataSources` 779–815, spike-confirmed server-side/meeting-level at 796–798;
  hooks 489–500).
- BBB API: `reference/bbb-api-docs.txt` (`meta_*` create 335–341; `userdata-*` 1538–1540).
- LMS EOS: `v2_lms` `end_of_session/{routes,handler,scoring}.clj`,
  `sessions/{query,webhook_handler}.clj` (`get-attendence-by-uuids`), `sessions/model.clj`
  (`generate-wb-link-from-session`: meeting=`:ent/uuid`, attendee=student role `:ent/uuid`);
  frontend `v2_lms_react/src/components/forms/eos/`.
- Plugin scaffolding: `deferred/exit-ticket.tsx.wip` (⊕-menu item built);
  `src/fullmind-classroom/session-progress-bar.tsx` (FloatingWindow template).
