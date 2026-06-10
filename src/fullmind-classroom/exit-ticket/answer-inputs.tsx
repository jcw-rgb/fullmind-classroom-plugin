import * as React from 'react';

// Verified Fullmind tokens (Plus Jakarta Sans system); coral = selected, gray = idle.
const CORAL = '#F37167';
const GRAY = '#DEE2E6';

/**
 * Per-type choice input. `s` = single (replace), `m` = multiple (toggle set membership).
 * Pure + controlled: owns no state, reports the next selection via onChange. Kept isolated
 * so the selection logic is verifiable on its own.
 */
export function ChoiceInput(
  { type, choices, selected, onChange }: {
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
      {choices.map((c) => {
        const on = selected.includes(c.index);
        return (
          <button
            key={c.index}
            type="button"
            onClick={() => toggle(c.index)}
            style={{
              textAlign: 'left', padding: '12px 14px', borderRadius: 14,
              border: `2px solid ${on ? CORAL : GRAY}`, background: on ? 'rgba(243,113,103,0.08)' : '#fff',
              font: 'inherit', cursor: 'pointer', minHeight: 44, // 44px touch target (a11y)
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
            background: 'none', border: 'none', cursor: 'pointer', fontSize: 24,
            lineHeight: 1, padding: 10, color: n <= value ? CORAL : GRAY, // padding→44px touch target
          }}
        >
          ★
        </button>
      ))}
    </div>
  );
}
