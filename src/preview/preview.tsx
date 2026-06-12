/**
 * preview.tsx
 * Local visual preview harness — renders shipped components against the mock SDK.
 * NOT part of the shipped plugin build.
 *
 * Run with: npm run preview  →  http://localhost:4702
 *
 * Two views, switchable from the top toolbar:
 *   • Exit Ticket — the real student ExitTicketModal, with controls to flip the
 *     question type / error / loading states (for design review of the AD fixes).
 *   • Lesson Hub — the real LessonHubView rail + Session Progress band.
 */

import * as React from 'react';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';

import { LessonHubView } from '../fullmind-classroom/features/lesson-hub-rail';
import { SessionProgressView } from '../fullmind-classroom/session-progress-bar';
import { ExitTicketModal } from '../fullmind-classroom/exit-ticket/exit-ticket-modal';
import { ExitTicketQuestion } from '../fullmind-classroom/exit-ticket/constants';

const PREVIEW_UUID = 'preview-00000000-0000-0000-0000-000000000000';
const FONT = '"Plus Jakarta Sans", system-ui, -apple-system, sans-serif';

// Mock question-proxy payloads (the real shape vidapi returns), one per response_type.
const QUESTIONS: Record<'m' | 's' | 't' | 'f', ExitTicketQuestion> = {
  m: {
    id: 1, topic: 'Science', session_id: 1, meetingId: 'preview', relayToken: 'x',
    text: 'Select ALL the processes that are part of the water cycle.',
    response_type: 'm',
    choices: [
      { index: 'a', text: 'Evaporation' },
      { index: 'b', text: 'Condensation' },
      { index: 'c', text: 'Precipitation' },
      { index: 'd', text: 'Photosynthesis' },
    ],
  },
  s: {
    id: 2, topic: 'Science', session_id: 1, meetingId: 'preview', relayToken: 'x',
    text: 'Which process turns liquid water into water vapor?',
    response_type: 's',
    choices: [
      { index: 'a', text: 'Evaporation' },
      { index: 'b', text: 'Photosynthesis' },
      { index: 'c', text: 'Condensation' },
    ],
  },
  t: {
    id: 3, topic: 'Reflection', session_id: 1, meetingId: 'preview', relayToken: 'x',
    text: 'What is one thing you learned today?',
    response_type: 't',
    choices: [],
  },
  f: {
    id: 4, topic: 'Science', session_id: 1, meetingId: 'preview', relayToken: 'x',
    text: 'Upload a photo of your completed worksheet.',
    response_type: 'f',
    choices: [],
  },
};

type ETState = 'm' | 's' | 't' | 'f' | 'f-fail' | 'error' | 'loading';

function ExitTicketPreview() {
  const [state, setState] = useState<ETState>('m');
  const question = state === 'f-fail'
    ? QUESTIONS.f
    : (state === 'm' || state === 's' || state === 't' || state === 'f' ? QUESTIONS[state] : null);
  const error = state === 'error';

  // Mock upload: resolves after a beat ('f') or rejects ('f-fail') to demo the
  // Uploading… state and the error + retry path against the real modal.
  const mockUpload = () => new Promise<void>((resolve, reject) => {
    setTimeout(state === 'f-fail' ? () => reject(new Error('mock')) : resolve, 900);
  });

  const btn = (s: ETState, label: string) => (
    <button
      type="button"
      onClick={() => setState(s)}
      style={{
        font: 'inherit',
        fontWeight: state === s ? 700 : 500,
        padding: '6px 12px',
        borderRadius: 8,
        border: `1px solid ${state === s ? '#403770' : '#DEE2E6'}`,
        background: state === s ? '#403770' : '#fff',
        color: state === s ? '#fff' : '#403770',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ fontFamily: FONT }}>
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        display: 'flex', gap: 8, alignItems: 'center',
        padding: '10px 16px', background: '#fff', borderBottom: '1px solid #DEE2E6',
      }}
      >
        <strong style={{ color: '#403770', marginRight: 8 }}>Exit Ticket states:</strong>
        {btn('m', 'Multiple choice')}
        {btn('s', 'Single choice')}
        {btn('t', 'Text')}
        {btn('f', 'File upload')}
        {btn('f-fail', 'File (upload fails)')}
        {btn('error', 'Fetch error')}
        {btn('loading', 'Loading')}
        <span style={{ marginLeft: 12, fontSize: 12, color: '#6C757D' }}>
          Tab through choices to see the keyboard focus ring · hover/click Submit for its states
        </span>
      </div>
      <ExitTicketModal
        key={state}
        question={question}
        error={error}
        onSubmit={(a) => { /* preview no-op */ window.console.log('submit', a); }}
        onUploadFile={mockUpload}
      />
    </div>
  );
}

function RailPreview() {
  return (
    <div style={{ minHeight: '100vh', background: '#F0F3F6', position: 'relative' }}>
      <SessionProgressView pluginUuid={PREVIEW_UUID} />
      <LessonHubView pluginUuid={PREVIEW_UUID} />
    </div>
  );
}

function App() {
  const [view, setView] = useState<'exit-ticket' | 'rail'>('exit-ticket');
  return (
    <div style={{ fontFamily: FONT }}>
      <div style={{
        position: 'fixed', bottom: 12, right: 12, zIndex: 200, display: 'flex', gap: 6,
      }}
      >
        <button type="button" onClick={() => setView('exit-ticket')} style={{ font: 'inherit', padding: '6px 10px' }}>Exit Ticket</button>
        <button type="button" onClick={() => setView('rail')} style={{ font: 'inherit', padding: '6px 10px' }}>Lesson Hub</button>
      </div>
      {view === 'exit-ticket' ? <ExitTicketPreview /> : <RailPreview />}
    </div>
  );
}

const container = document.getElementById('root');
if (!container) throw new Error('No #root element found');
createRoot(container).render(<App />);
