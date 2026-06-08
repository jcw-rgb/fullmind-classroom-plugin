/**
 * preview.tsx
 * Local visual preview harness — renders the actual LessonHubView from the
 * shipped rail component against the mock SDK. NOT part of the shipped plugin build.
 *
 * Run with: npm run preview  →  http://localhost:4702
 *
 * The rail is position:fixed; left:0; top:RAIL_TOP so it pins to the left edge of
 * the browser window — that's intentional. Click a rail button to open its panel.
 */

import * as React from 'react';
import { createRoot } from 'react-dom/client';

import { LessonHubView } from '../fullmind-classroom/features/lesson-hub-rail';
import { SessionProgressView } from '../fullmind-classroom/session-progress-bar';

// A stable, arbitrary UUID for the preview — the mock-sdk ignores it anyway.
const PREVIEW_UUID = 'preview-00000000-0000-0000-0000-000000000000';

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
function App() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#F0F3F6',
      position: 'relative',
    }}>
      {/* The real Session Progress band — position:fixed; spans the top edge */}
      <SessionProgressView pluginUuid={PREVIEW_UUID} />

      {/* Page caption — sits in the top-right, below the band, so the rail owns the left */}
      <div style={{
        position: 'fixed',
        top: 44,
        right: 20,
        fontFamily: '"Plus Jakarta Sans", system-ui, -apple-system, sans-serif',
        textAlign: 'right',
        zIndex: 10,
        pointerEvents: 'none',
      }}>
        <div style={{
          fontSize: 14,
          fontWeight: 800,
          color: '#403770',
          letterSpacing: '-.01em',
        }}>
          Fullmind Classroom — Lesson Hub rail
        </div>
        <div style={{
          marginTop: 4,
          fontSize: 12,
          color: '#6C757D',
        }}>
          Mock data · local only · click a rail button to open a panel
        </div>
      </div>

      {/* The real rail component — position:fixed; pins to left edge naturally */}
      <LessonHubView pluginUuid={PREVIEW_UUID} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mount
// ---------------------------------------------------------------------------
const container = document.getElementById('root');
if (!container) throw new Error('No #root element found');
createRoot(container).render(<App />);
