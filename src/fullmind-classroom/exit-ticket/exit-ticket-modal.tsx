import * as React from 'react';
import { useState } from 'react';
import { ChoiceInput, StarRating } from './answer-inputs';
import { ExitTicketQuestion, AnswerEntry } from './constants';

// Verified Fullmind tokens.
const PLUM = '#403770';
const CORAL = '#F37167'; // Deep Coral 68 — default
const CORAL_60 = '#F04E42'; // Deep Coral 60 — hover
const CORAL_50 = '#EC2213'; // Deep Coral 50 — active
const CORAL_80 = '#F8A7A0'; // Deep Coral 80 — focus ring
const GRAY = '#DEE2E6'; // Gray 300 — disabled background / input border
const GRAY_500 = '#ADB5BD'; // Gray 500 — disabled text
const FONT = '"Plus Jakarta Sans", system-ui, sans-serif';

// Submit interactive states (hover/active/keyboard-focus) — pseudo-classes can't be inline.
const SUBMIT_CSS = `
  .fm-et-submit:not(:disabled):hover { background: ${CORAL_60}; }
  .fm-et-submit:not(:disabled):active { background: ${CORAL_50}; }
  .fm-et-submit:focus-visible { outline: none; box-shadow: 0 0 0 3px ${CORAL_80}; }
`;

/**
 * Student modal — a FloatingWindow-rendered overlay (the SDK has no true blocking modal).
 * Renders the right input for the question's response_type, plus an optional star rating,
 * and submits via the controller's submitAnswer. No Cancel: an exit ticket is required;
 * the teacher's `close` broadcast dismisses everyone.
 */
export function ExitTicketModal(
  { question, error, onSubmit }: {
    question: ExitTicketQuestion | null;
    error: boolean;
    onSubmit: (answer: Omit<AnswerEntry, 'extId'>) => void;
  },
): React.ReactElement {
  const [choices, setChoices] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [rating, setRating] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const rt = question?.response_type;
  // With no question loaded, the student can still submit a rating. With a question,
  // require its answer (text for 't', a choice for 's'/'m').
  const canSubmit = ((): boolean => {
    if (rt === 't') return text.trim().length > 0;
    if (rt === 's' || rt === 'm') return choices.length > 0;
    return rating > 0;
  })();

  const submit = () => {
    const answer: Omit<AnswerEntry, 'extId'> = {};
    if (rt === 't') answer.text = text.trim();
    else if (rt === 's' || rt === 'm') answer.choices = choices;
    if (rating > 0) answer.rating = rating;
    onSubmit(answer);
    setSubmitted(true);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 50,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(33,37,41,.55)',
      fontFamily: FONT,
    }}
    >
      <style>{SUBMIT_CSS}</style>
      <div style={{
        width: 'min(520px, 92vw)', background: '#FFFCFA', borderRadius: 16, overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,.3)',
      }}
      >
        <div style={{
          background: PLUM, color: '#fff', padding: '16px 24px', fontWeight: 600, textAlign: 'center',
        }}
        >
          {submitted ? 'Student Exit Ticket Completed!' : 'Student Exit Ticket'}
        </div>
        <div style={{ padding: 24, color: '#212529' }}>
          {submitted ? (
            <p style={{ margin: 0, fontSize: 16, textAlign: 'center' }}>Great job! Thank you for submitting the exit ticket.</p>
          ) : (
            <>
              {/* eslint-disable-next-line no-nested-ternary */}
              {question?.text
                ? <p style={{ marginTop: 0, fontSize: 16, lineHeight: 1.5 }}>{question.text}</p>
                : error
                  ? (
                    <p style={{ marginTop: 0, fontSize: 14, color: '#6C757D' }}>
                      Couldn&apos;t load the question — you can still rate the lesson below.
                    </p>
                  )
                  : <p style={{ marginTop: 0, fontSize: 14, color: '#6C757D' }}>Loading question…</p>}
              {(rt === 's' || rt === 'm') && (
                <ChoiceInput
                  type={rt}
                  choices={question?.choices ?? []}
                  selected={choices}
                  onChange={setChoices}
                />
              )}
              {rt === 't' && (
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={4}
                  style={{
                    width: '100%', borderRadius: 14, border: `2px solid ${GRAY}`, padding: 12, font: 'inherit', boxSizing: 'border-box',
                  }}
                />
              )}
              {/* File type 'f' is deferred (Task 5 — needs the pre-signed-S3 sub-spec). Render an
                  honest placeholder rather than a silently un-submittable empty body. */}
              {rt === 'f' && (
                <p style={{ margin: 0, color: '#6C757D', fontSize: 14 }}>File upload is coming soon.</p>
              )}
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, color: '#6C757D', marginBottom: 4 }}>Rate today&apos;s lesson</div>
                <StarRating value={rating} onChange={setRating} />
              </div>
              <div style={{
                display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20,
              }}
              >
                <button
                  type="button"
                  className="fm-et-submit"
                  disabled={!canSubmit}
                  onClick={submit}
                  style={{
                    // Disabled = the system disabled pair (Gray 300 bg / Gray 500 text), not
                    // faded coral — so it reads as inert rather than almost-clickable.
                    background: canSubmit ? CORAL : GRAY,
                    color: canSubmit ? '#fff' : GRAY_500,
                    border: 'none',
                    borderRadius: 12,
                    padding: '12px 20px',
                    fontWeight: 600,
                    cursor: canSubmit ? 'pointer' : 'default',
                    font: 'inherit',
                    minHeight: 44,
                  }}
                >
                  Submit exit ticket
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
