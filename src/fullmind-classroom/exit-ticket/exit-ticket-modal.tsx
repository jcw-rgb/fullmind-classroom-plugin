import * as React from 'react';
import { useState } from 'react';
import { ChoiceInput, StarRating } from './answer-inputs';
import { ExitTicketQuestion, AnswerEntry } from './constants';

// Verified Fullmind tokens.
const PLUM = '#403770';
const CORAL = '#F37167';
const GRAY = '#DEE2E6';
const FONT = '"Plus Jakarta Sans", system-ui, sans-serif';

/**
 * Student modal — a FloatingWindow-rendered overlay (the SDK has no true blocking modal).
 * Renders the right input for the question's response_type, plus an optional star rating,
 * and submits via the controller's submitAnswer. No Cancel: an exit ticket is required;
 * the teacher's `close` broadcast dismisses everyone.
 */
export function ExitTicketModal(
  { question, onSubmit }: {
    question: ExitTicketQuestion;
    onSubmit: (answer: Omit<AnswerEntry, 'extId'>) => void;
  },
): React.ReactElement {
  const [choices, setChoices] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [rating, setRating] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = question.response_type === 't' ? text.trim().length > 0 : choices.length > 0;

  const submit = () => {
    const answer: Omit<AnswerEntry, 'extId'> = {};
    if (question.response_type === 't') answer.text = text.trim();
    else answer.choices = choices;
    if (rating > 0) answer.rating = rating;
    onSubmit(answer);
    setSubmitted(true);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'rgba(33,37,41,.55)', fontFamily: FONT,
    }}>
      <div style={{ width: 'min(520px, 92vw)', background: '#FFFCFA', borderRadius: 14, overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,.3)' }}>
        <div style={{ background: PLUM, color: '#fff', padding: '14px 20px', fontWeight: 600 }}>
          Exit Ticket{question.topic ? ` — ${question.topic}` : ''}
        </div>
        <div style={{ padding: 20, color: '#212529' }}>
          {submitted ? (
            <p style={{ margin: 0, fontSize: 16 }}>Thanks — your answer was submitted.</p>
          ) : (
            <>
              <p style={{ marginTop: 0, fontSize: 16, lineHeight: 1.5 }}>{question.text}</p>
              {(question.response_type === 's' || question.response_type === 'm') && (
                <ChoiceInput type={question.response_type} choices={question.choices} selected={choices} onChange={setChoices} />
              )}
              {question.response_type === 't' && (
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={4}
                  style={{ width: '100%', borderRadius: 14, border: `2px solid ${GRAY}`, padding: 12, font: 'inherit', boxSizing: 'border-box' }}
                />
              )}
              {/* File type 'f' is handled in Task 5 (deferred — needs the pre-signed-S3 sub-spec). */}
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, color: '#6C757D', marginBottom: 4 }}>Rate today&apos;s lesson</div>
                <StarRating value={rating} onChange={setRating} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
                <button
                  type="button"
                  disabled={!canSubmit}
                  onClick={submit}
                  style={{
                    background: canSubmit ? CORAL : GRAY, color: '#fff', border: 'none',
                    borderRadius: 10, padding: '10px 18px', fontWeight: 600,
                    cursor: canSubmit ? 'pointer' : 'default', font: 'inherit', minHeight: 44,
                  }}
                >
                  Submit
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
