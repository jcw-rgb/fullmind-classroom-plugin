import * as React from 'react';

// Verified Fullmind tokens (Plus Jakarta Sans system); coral = selected, gray = idle.
const CORAL = '#F37167'; // Deep Coral 68 — selected border
const CORAL_80 = '#F8A7A0'; // Deep Coral 80 — keyboard focus ring (system focus colour)
const CORAL_90 = '#FBD3D0'; // Deep Coral 90 — selected fill (replaces a freelanced rgba)
const GRAY = '#DEE2E6'; // Gray 300 — idle border

// Hover + keyboard-focus states can't be expressed inline, so they live in one scoped
// stylesheet. The state-driven border/background must ALSO live here (fed by inline CSS
// custom properties) — an inline style beats any stylesheet pseudo-class, which would
// leave :hover dead. :focus-visible (not :focus) shows the ring for keyboard users only,
// not on mouse click — the correct a11y behaviour. Injected once where the choices render.
const CHOICE_CSS = `
  .fm-et-choice {
    border: 2px var(--fm-et-bs, solid) var(--fm-et-bc, ${GRAY});
    background: var(--fm-et-bg, #fff);
    transition: border-color .12s ease, box-shadow .12s ease;
  }
  .fm-et-choice:not(:disabled):hover { border-color: ${CORAL}; }
  .fm-et-choice:focus-visible { outline: none; box-shadow: 0 0 0 3px ${CORAL_80}; }
`;

/**
 * Per-type choice input. `s` = single (replace), `m` = multiple (toggle set membership).
 * Pure + controlled: owns no state, reports the next selection via onChange. Kept isolated
 * so the selection logic is verifiable on its own.
 */
export function ChoiceInput(
  {
    type, choices, selected, onChange,
  }: {
    type: 's' | 'm';
    choices: { index: string; text: string }[];
    selected: string[];
    onChange: (next: string[]) => void;
  },
): React.ReactElement {
  const toggle = (idx: string) => {
    if (type === 's') { onChange([idx]); return; }
    onChange(selected.includes(idx) ? selected.filter((i) => i !== idx) : [...selected, idx]);
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <style>{CHOICE_CSS}</style>
      {choices.map((c) => {
        const on = selected.includes(c.index);
        return (
          <button
            key={c.index}
            type="button"
            className="fm-et-choice"
            aria-pressed={on}
            onClick={() => toggle(c.index)}
            style={{
              textAlign: 'left',
              padding: '12px 16px',
              borderRadius: 16,
              // Selected = coral border + coral-90 fill (the "outline" is the border); the
              // border/background render via CHOICE_CSS so :hover/:focus-visible can win.
              '--fm-et-bc': on ? CORAL : GRAY,
              '--fm-et-bg': on ? CORAL_90 : '#fff',
              outline: 'none',
              font: 'inherit',
              cursor: 'pointer',
              minHeight: 44, // 44px touch target (a11y)
            } as React.CSSProperties}
          >
            {c.text}
          </button>
        );
      })}
    </div>
  );
}

/**
 * File picker for type-'f' questions. Controlled: holds no state, reports the chosen File
 * via onChange. A hidden <input type="file"> behind a styled trigger button — the button
 * reuses .fm-et-choice so hover/keyboard-focus match the choice boxes. Empty = dashed gray
 * (an upload affordance); chosen = solid coral + coral-90 fill (mirrors a selected choice),
 * showing the file name. Clicking again re-opens the picker to swap the file.
 */
export function FileInput(
  { file, onChange, disabled }: {
    file: File | null;
    onChange: (f: File | null) => void;
    disabled: boolean;
  },
): React.ReactElement {
  const inputRef = React.useRef<HTMLInputElement>(null);
  return (
    <div>
      <style>{CHOICE_CSS}</style>
      <input
        ref={inputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        className="fm-et-choice"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        style={{
          width: '100%',
          textAlign: 'center',
          padding: '12px 16px',
          borderRadius: 16,
          '--fm-et-bs': file ? 'solid' : 'dashed',
          '--fm-et-bc': file ? CORAL : GRAY,
          '--fm-et-bg': file ? CORAL_90 : '#fff',
          outline: 'none',
          font: 'inherit',
          cursor: disabled ? 'default' : 'pointer',
          minHeight: 44, // 44px touch target (a11y)
          color: '#212529',
        } as React.CSSProperties}
      >
        {file ? file.name : 'Choose a file to upload'}
      </button>
      {file && (
        <div style={{ marginTop: 4, fontSize: 12, color: '#6C757D' }}>
          Click again to choose a different file.
        </div>
      )}
    </div>
  );
}

/**
 * 1–5 star rating. Controlled; reports the clicked value. Stars are filled up to `value`.
 * aria-label per star keeps it operable/testable without relying on the glyph.
 */
export function StarRating(
  { value, onChange, disabled }: {
    value: number;
    onChange: (n: number) => void;
    disabled: boolean;
  },
): React.ReactElement {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`Rate ${n} of 5`}
          disabled={disabled}
          onClick={() => onChange(n)}
          style={{
            background: 'none',
            border: 'none',
            cursor: disabled ? 'default' : 'pointer',
            fontSize: 24,
            lineHeight: 1,
            padding: 10,
            color: n <= value ? CORAL : GRAY, // padding→44px touch target
          }}
        >
          ★
        </button>
      ))}
    </div>
  );
}
