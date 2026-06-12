import * as React from 'react';
import { useState } from 'react';
import { ChoiceInput, FileInput, StarRating } from './answer-inputs';
import { ExitTicketQuestion, AnswerEntry } from './constants';

// Verified Fullmind tokens.
const PLUM = '#403770';
const CORAL = '#F37167'; // Deep Coral 68 — default
const CORAL_60 = '#F04E42'; // Deep Coral 60 — hover
const CORAL_50 = '#EC2213'; // Deep Coral 50 — active
const CORAL_80 = '#F8A7A0'; // Deep Coral 80 — focus ring
const GRAY = '#DEE2E6'; // Gray 300 — disabled background / input border
const GRAY_500 = '#ADB5BD'; // Gray 500 — disabled text
const DANGER = '#E0182D'; // Danger 50 — error text
const FONT = '"Plus Jakarta Sans", system-ui, sans-serif';

// Submit interactive states (hover/active/keyboard-focus) — pseudo-classes can't be inline.
// The state-driven background must ALSO live here (fed by an inline CSS custom property):
// an inline background would beat the :hover/:active rules and leave them dead.
const SUBMIT_CSS = `
  .fm-et-submit { background: var(--fm-et-submit-bg, ${CORAL}); transition: background .12s ease, box-shadow .12s ease; }
  .fm-et-submit:not(:disabled):hover { background: ${CORAL_60}; }
  .fm-et-submit:not(:disabled):active { background: ${CORAL_50}; }
  .fm-et-submit:focus-visible { outline: none; box-shadow: 0 0 0 3px ${CORAL_80}; }
`;

/**
 * Student modal — a FloatingWindow-rendered overlay (the SDK has no true blocking modal).
 * Renders the right input for the question's response_type, plus an optional star rating,
 * and submits via the controller's submitAnswer. Type-'f' uploads the file DIRECTLY to
 * vidapi via onUploadFile first (a binary can't ride the data channel), then pushes the
 * completion marker + rating through the normal channel. No Cancel: an exit ticket is
 * required; the teacher's `close` broadcast dismisses everyone.
 */
export function ExitTicketModal(
  {
    question, error, onSubmit, onUploadFile,
  }: {
    question: ExitTicketQuestion | null;
    error: boolean;
    onSubmit: (answer: Omit<AnswerEntry, 'extId'>) => void;
    onUploadFile: (file: File) => Promise<void>;
  },
): React.ReactElement {
  const [choices, setChoices] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [rating, setRating] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(false);

  const rt = question?.response_type;
  // With no question loaded, the student can still submit a rating. With a question,
  // require its answer (text for 't', a choice for 's'/'m', a file for 'f').
  const canSubmit = ((): boolean => {
    if (uploading) return false;
    if (rt === 't') return text.trim().length > 0;
    if (rt === 's' || rt === 'm') return choices.length > 0;
    if (rt === 'f') return file !== null;
    return rating > 0;
  })();

  // The channel payload: the completion marker + rating (and the answer for non-file
  // types). For 'f' the file itself is already at the LMS by the time this is pushed.
  const pushAnswer = () => {
    const answer: Omit<AnswerEntry, 'extId'> = {};
    if (rt === 't') answer.text = text.trim();
    else if (rt === 's' || rt === 'm') answer.choices = choices;
    if (rating > 0) answer.rating = rating;
    onSubmit(answer);
    setSubmitted(true);
  };

  const submit = () => {
    if (rt === 'f') {
      if (!file) return;
      setUploading(true);
      setUploadError(false);
      // Upload first; only mark complete once the file is safely at the server. On
      // failure keep the form (file still selected) so the student can just retry.
      onUploadFile(file)
        .then(() => pushAnswer())
        .catch(() => setUploadError(true))
        .finally(() => setUploading(false));
      return;
    }
    pushAnswer();
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
              {rt === 'f' && (
                <FileInput file={file} onChange={setFile} disabled={uploading} />
              )}
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, color: '#6C757D', marginBottom: 4 }}>Rate today&apos;s lesson</div>
                {/* Disabled while uploading: the in-flight submit captured the click-time
                    rating, so later star clicks would silently not be what gets saved. */}
                <StarRating value={rating} onChange={setRating} disabled={uploading} />
              </div>
              {uploadError && (
                <p role="alert" style={{ margin: '12px 0 0', fontSize: 14, color: DANGER }}>
                  Couldn&apos;t upload your file — please try submitting again.
                </p>
              )}
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
                    // faded coral — so it reads as inert rather than almost-clickable. The
                    // background renders via SUBMIT_CSS so :hover/:active can win over it.
                    '--fm-et-submit-bg': canSubmit ? CORAL : GRAY,
                    color: canSubmit ? '#fff' : GRAY_500,
                    border: 'none',
                    borderRadius: 12,
                    padding: '12px 20px',
                    fontWeight: 600,
                    cursor: canSubmit ? 'pointer' : 'default',
                    font: 'inherit',
                    minHeight: 44,
                  } as React.CSSProperties}
                >
                  {uploading ? 'Uploading…' : 'Submit exit ticket'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
