/**
 * preview.tsx
 * Local visual preview harness — renders the three Fullmind panel Views side-by-side
 * with mock SDK data. NOT part of the shipped plugin build.
 *
 * Run with: npm run preview  →  http://localhost:4702
 */

import * as React from 'react';
import { createRoot } from 'react-dom/client';

import { ChatPanelView }  from '../fullmind-classroom/features/chat-panel';
import { ClassPanelView } from '../fullmind-classroom/features/class-panel';
import { NotesPanelView } from '../fullmind-classroom/features/notes-panel';

// A stable, arbitrary UUID for the preview — the mock-sdk ignores it anyway.
const PREVIEW_UUID = 'preview-00000000-0000-0000-0000-000000000000';

// ---------------------------------------------------------------------------
// Panel wrapper
// ---------------------------------------------------------------------------
interface PanelFrameProps {
  label: string;
  children: React.ReactNode;
}

function PanelFrame({ label, children }: PanelFrameProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: 320,
      height: 560,
      background: '#ffffff',
      borderRadius: 16,
      border: '1px solid #E6EAEE',
      boxShadow: '0 4px 20px rgba(0,0,0,0.07)',
      overflow: 'hidden',
    }}>
      {/* Panel label bar */}
      <div style={{
        padding: '10px 16px',
        borderBottom: '1px solid #E6EAEE',
        fontFamily: '"Plus Jakarta Sans", system-ui, -apple-system, sans-serif',
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: '.08em',
        textTransform: 'uppercase' as const,
        color: '#6C757D',
        background: '#F4F7F9',
        flexShrink: 0,
      }}>
        {label}
      </div>

      {/* Panel content — fills remaining height */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
function App() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#F0F3F6',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '48px 32px',
      gap: 12,
    }}>
      {/* Page header */}
      <div style={{
        fontFamily: '"Plus Jakarta Sans", system-ui, -apple-system, sans-serif',
        marginBottom: 24,
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: 22,
          fontWeight: 800,
          color: '#403770',
          letterSpacing: '-.01em',
        }}>
          Fullmind Classroom — Panel Preview
        </div>
        <div style={{
          marginTop: 6,
          fontSize: 13,
          color: '#6C757D',
        }}>
          Mock data · local only · not shipped
        </div>
      </div>

      {/* Three panels side by side */}
      <div style={{
        display: 'flex',
        gap: 24,
        flexWrap: 'wrap' as const,
        justifyContent: 'center',
      }}>
        <PanelFrame label="Chat">
          <ChatPanelView pluginUuid={PREVIEW_UUID} />
        </PanelFrame>

        <PanelFrame label="Notes">
          <NotesPanelView />
        </PanelFrame>

        <PanelFrame label="Class">
          <ClassPanelView pluginUuid={PREVIEW_UUID} />
        </PanelFrame>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mount
// ---------------------------------------------------------------------------
const container = document.getElementById('root');
if (!container) throw new Error('No #root element found');
createRoot(container).render(<App />);
