/**
 * mock-sdk.tsx
 * Stand-in for 'bigbluebutton-html-plugin-sdk' used only by the local preview build.
 * Aliased via webpack.preview.js → resolve.alias so the real SDK is never touched.
 *
 * Exports every name the LessonHub rail + session progress bar import.
 */

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PluginApi = any;

// ---------------------------------------------------------------------------
// Mock data — intentionally EMPTY so the preview shows the true fresh-room
// state: no messages, no roster, no audio. This mirrors how the real plugin
// starts in BBB (chat/notes empty, class empty until users join) — it carries
// NO prepopulated names or messages. Add rows here only for a throwaway local
// test; never commit fake content.
// ---------------------------------------------------------------------------
const MOCK_USERS: Array<{ userId: string; name: string; role: string }> = [];

const MOCK_MESSAGES: Array<{
  messageId: string;
  senderUserId: string;
  message: string;
  createdAt: string;
  messageMetadata: Record<string, unknown>;
}> = [];

const MOCK_VOICES: Array<{
  userId: string; talking: boolean; muted: boolean; startTime: number;
}> = [];

// ---------------------------------------------------------------------------
// Mock API object returned by getPluginApi()
// ---------------------------------------------------------------------------
// Preview-only session timing for the Session Progress band. NOT fake "content" like
// names/messages — it's the meeting clock the band needs to render at all. Tuned so the
// preview shows a representative ~33% fill + "40:00 left" (a 60-min session, 20 min in),
// matching the band-design spec's example. createdTime is computed once at module load.
const MOCK_SESSION_START = Date.now() - 20 * 60 * 1000; // 20 min ago
const MOCK_SESSION_TIMING = {
  data: { meeting: [{ createdTime: MOCK_SESSION_START, durationInSeconds: 60 * 60 }] },
};

// Preview-only current user. Drives the mini-lesson prompt's moderator gate — flip
// role to 'VIEWER' locally to verify the student (no-prompt) path.
const MOCK_CURRENT_USER = {
  data: {
    userId: 'preview-user',
    extId: 'preview-user',
    name: 'Preview Educator',
    role: 'MODERATOR',
    presenter: true,
    cameras: [],
  },
};

function makeMockApi(): PluginApi {
  return {
    useLoadedChatMessages: () => ({ data: MOCK_MESSAGES }),
    useLoadedUserList:     () => ({ data: MOCK_USERS }),
    useTalkingIndicator:   () => ({ data: MOCK_VOICES }),
    useCustomSubscription: () => MOCK_SESSION_TIMING,
    useCurrentUser:        () => MOCK_CURRENT_USER,

    serverCommands: {
      chat: {
        sendPublicChatMessage: (args: unknown) => {
          console.log('[mock-sdk] sendPublicChatMessage called', args);
        },
      },
    },

    // Returns the provided default — preview has no live native panel state.
    useUiData: (_name: string, defaultValue: unknown) => defaultValue,

    uiCommands: {
      chat: {
        form: {
          open: () => console.log('[mock-sdk] uiCommands.chat.form.open'),
          fill: (args: unknown) => console.log('[mock-sdk] uiCommands.chat.form.fill', args),
        },
      },
      sidekickOptionsContainer: {
        open:  (args: unknown) => console.log('[mock-sdk] uiCommands.sidekickOptionsContainer.open', args),
        close: (args: unknown) => console.log('[mock-sdk] uiCommands.sidekickOptionsContainer.close', args),
      },
    },
  };
}

// ---------------------------------------------------------------------------
// BbbPluginSdk mock
// ---------------------------------------------------------------------------
const _apiCache: Record<string, PluginApi> = {};

export const BbbPluginSdk = {
  initialize: (_pluginUuid: string) => {
    // no-op in preview
  },
  getPluginApi: (pluginUuid: string): PluginApi => {
    if (!_apiCache[pluginUuid]) {
      _apiCache[pluginUuid] = makeMockApi();
    }
    return _apiCache[pluginUuid];
  },
};

// ---------------------------------------------------------------------------
// GenericContentSidekickArea — no-op class; preview renders Views directly
// ---------------------------------------------------------------------------
export class GenericContentSidekickArea {
  constructor(_opts: unknown) {
    // no-op; the preview never calls the factory functions
  }
}

// ---------------------------------------------------------------------------
// FloatingWindow — no-op class; preview renders LessonHubView directly
// ---------------------------------------------------------------------------
export class FloatingWindow {
  constructor(_opts: unknown) {
    // no-op; the preview renders the View component directly, not via the factory
  }
}

// ---------------------------------------------------------------------------
// Misc named exports the SDK normally provides (add more as needed)
// ---------------------------------------------------------------------------
export const pluginLogger = {
  info:  (...args: unknown[]) => console.log('[mock-sdk] info:', ...args),
  warn:  (...args: unknown[]) => console.warn('[mock-sdk] warn:', ...args),
  error: (...args: unknown[]) => console.error('[mock-sdk] error:', ...args),
};

// ---------------------------------------------------------------------------
// Enum exports — the LessonHub rail imports these from the SDK alias
// ---------------------------------------------------------------------------
export enum UserListUiDataNames { USER_LIST_IS_OPEN = 'USER_LIST_IS_OPEN' }
export enum LayoutPresentatioAreaUiDataNames { CURRENT_ELEMENT = 'CURRENT_ELEMENT' }
export enum UiLayouts {
  PINNED_SHARED_NOTES = 'PINNED_SHARED_NOTES',
  EXTERNAL_VIDEO = 'EXTERNAL_VIDEO',
  SCREEN_SHARE = 'SCREEN_SHARE',
  WHITEBOARD = 'WHITEBOARD',
  GENERIC_CONTENT = 'GENERIC_CONTENT',
}
