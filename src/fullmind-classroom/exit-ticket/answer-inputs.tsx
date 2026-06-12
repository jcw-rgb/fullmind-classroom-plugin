import * as React from 'react';

// Verified Fullmind tokens (Plus Jakarta Sans system); coral = selected, gray = idle.
const CORAL = '#F37167'; // Deep Coral 68 — selected border
const CORAL_80 = '#F8A7A0'; // Deep Coral 80 — keyboard focus ring (system focus colour)
const CORAL_90 = '#FBD3D0'; // Deep Coral 90 — selected fill (replaces a freelanced rgba)
const GRAY = '#DEE2E6'; // Gray 300 — idle border

// Hover + keyboard-focus states can't be expressed inline, so they live in one scoped
// stylesheet. :focus-visible (not :focus) shows the ring for keyboard users only, not on
// mouse click — the correct a11y behaviour. Injected once where the choices render.
const CHOICE_CSS = `
  .fm-et-choice { transition: border-color .12s ease, box-shadow .12s ease; }
  .fm-et-choice:hover { border-color: ${CORAL}; }
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
              // keyboard focus ring is layered on by .fm-et-choice:focus-visible above.
              border: `2px solid ${on ? CORAL : GRAY}`,
              outline: 'none',
              background: on ? CORAL_90 : '#fff',
              font: 'inherit',
              cursor: 'pointer',
              minHeight: 44, // 44px touch target (a11y)
            }}
          >
            {c.text}
          </button>
        );
      })}
    </div>
  );
}

/**
 * 1–5 star rating. Controlled; reports the clicked value. Stars are filled up to `value`.
 * aria-label per star keeps it operable/testable without relying on the glyph.
 */
export function StarRating(
  { value, onChange }: { value: number; onChange: (n: number) => void },
): React.ReactElement {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`Rate ${n} of 5`}
          onClick={() => onChange(n)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
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
