import * as React from 'react';

const PLUM = '#403770';
const GRAY = '#DEE2E6';
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
  return (
    <div style={{
      position: 'fixed', right: 16, bottom: 16, zIndex: 50, width: 260, background: '#fff',
      borderRadius: 14, boxShadow: '0 8px 28px rgba(0,0,0,.22)', fontFamily: FONT, color: '#212529', overflow: 'hidden',
    }}>
      <div style={{ background: PLUM, color: '#fff', padding: '10px 14px', fontWeight: 600, fontSize: 14 }}>Exit Ticket — live</div>
      <div style={{ padding: 14 }}>
        <div style={{ fontSize: 28, fontWeight: 700 }}>
          {/* clamp: a viewer who submits then leaves can push `submitted` past the live
              roster `total`, which would otherwise render a nonsensical "3 of 2". */}
          {Math.min(submitted, total)} <span style={{ fontSize: 16, color: '#6C757D' }}>of {total}</span>
        </div>
        <div style={{ fontSize: 13, color: outstanding ? '#6C757D' : '#198754', marginTop: 2 }}>
          {outstanding ? `${outstanding} still working…` : 'Everyone submitted'}
        </div>
        <button
          type="button"
          onClick={() => {
            if (outstanding > 0
              && !window.confirm(`${outstanding} student${outstanding > 1 ? "s haven't" : " hasn't"} submitted yet. Close the exit ticket anyway?`)) {
              return;
            }
            onClose();
          }}
          style={{ marginTop: 12, width: '100%', minHeight: 44, background: '#fff', border: `2px solid ${GRAY}`, borderRadius: 10, padding: '8px 0', fontWeight: 600, cursor: 'pointer', font: 'inherit' }}
        >
          Close exit ticket
        </button>
      </div>
    </div>
  );
}
