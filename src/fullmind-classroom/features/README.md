# Fullmind Classroom — plugin features

Each feature is a self-contained file layered as a sibling in
`../component-working.tsx`. Pattern: a `View` component runs the SDK hooks inside its
own ReactDOM root; a `make<X>Area(uuid)` factory wraps it as a sidebar panel.

## Registration (important)
SDK `set*` methods are **last-writer-wins per plugin**. The three panels all use
`setGenericContentItems`, so they are registered together in ONE call from
`register-panels.tsx`. Never call `setGenericContentItems` from a panel file.

| Feature | File | Surface |
|---|---|---|
| Chat panel | `chat-panel.tsx` | sidebar panel (Generic Content) |
| Notes panel | `notes-panel.tsx` | sidebar panel (Generic Content) |
| Class panel | `class-panel.tsx` | sidebar panel (Generic Content) |
| Panel hub | `register-panels.tsx` | `setGenericContentItems` (once) |
| Font-size reorder | `font-size-reorder.tsx` | DOM only |
| Shared tokens | `theme.ts` | — |

## Live-wire constants (confirm in the test room)
- `notes-panel.tsx` → `NOTES_PAD_URL` — the Etherpad pad URL. Empty by default;
  while empty the Notes panel shows fallback text pointing to BBB's native Shared Notes.

## Assumed BBB icon names (confirm visually)
The sidebar buttons use BBB icon-set name strings — `chat` (`chat-panel.tsx`),
`user` (`class-panel.tsx`), `copy` (`notes-panel.tsx`). These are best-guesses; a wrong
name degrades to a fallback glyph (never a crash). If a button shows a generic glyph in
the live room, swap the `*_ICON` constant in that panel file for a confirmed name.

## Build & deploy
```bash
npm run build-bundle   # → dist/FullmindClassroom.js + dist/manifest.json
```
Manifest is at `0.0.3`. Upload both `dist/` files to the S3 folder per `DEV-HANDOFF.md`.

## Live-verification checklist
- Chat: messages list renders; typing + Send posts a public message.
- Class: roster matches participants; talking dot + MUTED reflect reality.
- Notes: set `NOTES_PAD_URL`; confirm the educator's notes embed (else fallback shows).
- Sidebar shows three Fullmind buttons (Chat, Notes, Class) under the "Fullmind" section,
  each with a sensible icon (see "Assumed BBB icon names" above if a glyph looks wrong).
- Settings → Application: the "%" value sits between the - and + buttons.
