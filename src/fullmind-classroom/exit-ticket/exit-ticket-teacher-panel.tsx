import * as React from 'react';
import { useState } from 'react';

const NAVBAR_PLUM = '#3E3A6E'; // matches the reskinned action bar (#Navbar)
const CORAL = '#F37167'; // Fullmind primary action (Deep Coral 68)
const CORAL_HOVER = '#F04E42'; // deeper coral on hover (Coral 60, --fm-coral-hover)
const FONT = '"Plus Jakarta Sans", system-ui, sans-serif';

/**
 * Teacher panel — a small bottom-right FloatingWindow card: live "N of M submitted" plus a
 * Close button. Closing while answers are outstanding fires a confirm (the spec's
 * end-of-ticket backstop — intercepting BBB's native End-meeting button isn't a documented
 * SDK capability, so the warning lives on the teacher's natural last action).
 */
export function ExitTicketTeacherPanel(
  { submitted, total, onClose }: { submitted: number; total: number; onClose: () => void },
): React.ReactElement {
  const outstanding = Math.max(total - submitted, 0);
  const [hover, setHover] = useState(false);
  return (
    <div style={{
      // Centered overlay: translate(-50%,-50%) pulls the card back by half its own
      // size so it stays dead-center regardless of width/height.
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: 50,
      width: 260,
      background: '#fff',
      borderRadius: 14,
      boxShadow: '0 8px 28px rgba(0,0,0,.22)',
      fontFamily: FONT,
      color: '#212529',
      overflow: 'hidden',
    }}
    >
      <div style={{
        background: NAVBAR_PLUM, color: '#fff', padding: '10px 14px', fontWeight: 600, fontSize: 14, textAlign: 'center',
      }}
      >
        Exit Ticket Live
      </div>
      <div style={{ padding: 14 }}>
        <div style={{ fontSize: 28, fontWeight: 700, textAlign: 'center' }}>
          {/* clamp: a viewer who submits then leaves can push `submitted` past the live
              roster `total`, which would otherwise render a nonsensical "3 of 2". */}
          {Math.min(submitted, total)}
          {' '}
          <span style={{ fontSize: 16, color: '#6C757D' }}>
            {`of ${total}`}
          </span>
        </div>
        <div style={{
          fontSize: 13, color: outstanding ? '#6C757D' : '#198754', marginTop: 2, textAlign: 'center',
        }}
        >
          {outstanding ? `${outstanding} still working…` : 'Completed'}
        </div>
        <button
          type="button"
          onClick={() => {
            if (outstanding > 0
              // eslint-disable-next-line no-alert -- intentional close backstop
              && !window.confirm(`${outstanding} student${outstanding > 1 ? "s haven't" : " hasn't"} submitted yet. Close the exit ticket anyway?`)) {
              return;
            }
            onClose();
          }}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          style={{
            marginTop: 12, width: '100%', minHeight: 44, background: hover ? CORAL_HOVER : CORAL, color: '#fff', border: 'none', borderRadius: 10, padding: '8px 0', fontWeight: 600, cursor: 'pointer', font: 'inherit',
          }}
        >
          Close Exit Ticket
        </button>
      </div>
    </div>
  );
}
