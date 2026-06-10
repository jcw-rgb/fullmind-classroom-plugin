// One source of truth for every exit-ticket module. These names MUST match the
// manifest (Phase 3 Task 1) and the Phase 2 vidapi contract.
export const PLUGIN_NAME = 'FullmindClassroom';
export const REMOTE_SOURCE = 'exitTicket';
export const CONTROL_CHANNEL = 'exit-ticket-control';
export const ANSWERS_CHANNEL = 'exit-ticket-answers';

// Control-channel payloads (teacher → everyone).
export type ControlState = 'open' | 'close';
export interface ControlEntry { state: ControlState; }

// The question routed in via getRemoteData('exitTicket'). Shape = the Phase 2
// question-proxy response: the LMS question JSON augmented with meetingId + relayToken.
// `meetingId` (external) is what the relay URL is built from; `relayToken` authorizes
// the relay POST. Both are added by vidapi, not the LMS.
export interface ExitTicketQuestion {
  id: number;
  text: string;
  topic: string;
  response_type: 's' | 'm' | 't' | 'f';
  choices: { index: string; text: string }[];
  session_id: number;
  meetingId: string;
  relayToken: string;
}

// Answer payload (student → moderators). Carries the student's OWN extId — the relay key.
// extId is knowable only for oneself (the SDK exposes peer ids without extId), which is
// what prevents a student from submitting as a classmate.
export interface AnswerEntry {
  extId: string;
  text?: string;
  choices?: string[];   // selected choice indexes
  rating?: number;      // 1..5
}
