# Feature — Exit Ticket in BBB (in-room)

Educator authors an exit ticket in the LMS → the plugin routes it **into** the
BBB room → educator clicks **⊕ Actions → "Start Exit Ticket"** → it pops up on
**every student's screen** → answers return to the LMS's existing per-session
record (same reports + grading the educator already uses). Students never leave
the room.

**Status (2026-06-08): design approved, implementation not started.**

📄 **Canonical design:** `docs/superpowers/specs/2026-06-08-bbb-exit-ticket-design.md`
— full architecture, data flow, security model, components per codebase, error
handling, modal UI, testing, build order, and references. Read that, not this file.

## Locked decisions
- **Answer types (v1):** all four — single-choice, multiple-choice, text, file upload.
- **Star rating:** included.
- **Teacher in-room view:** live submission count ("5 of 8").
- **Route-in:** the question is pulled in via the SDK's `remoteDataSources`
  (meeting-level, server-fetched — confirmed; a plugin cannot read per-user join data).
- **Submit trust model (Path 2):** plugin → BBB data channel → **vidapi** harvester →
  LMS server-to-server. BBB vouches each sender's identity, so no impersonation and no
  browser→LMS calls (hence no CORS, no per-user token).
- **Spans three codebases:** plugin + `v2_lms` backend + vidapi. Build order:
  backend → vidapi → plugin plumbing → plugin UI (modal last).

## Existing scaffolding
| File | State |
|---|---|
| `deferred/exit-ticket.tsx.wip` | Built: "Start Exit Ticket" ⊕-menu item, moderator-only, placeholder onClick. The summon-broadcast goes here. |
| `src/fullmind-classroom/session-progress-bar.tsx` | The FloatingWindow template to model the modal on. |
