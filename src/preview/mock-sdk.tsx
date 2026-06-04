/**
 * mock-sdk.tsx
 * Stand-in for 'bigbluebutton-html-plugin-sdk' used only by the local preview build.
 * Aliased via webpack.preview.js → resolve.alias so the real SDK is never touched.
 *
 * Exports every name that chat-panel.tsx, class-panel.tsx, and notes-panel.tsx import.
 */

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PluginApi = any;

// ---------------------------------------------------------------------------
// Mock data — IDs kept consistent so chat sender names resolve from userlist
// ---------------------------------------------------------------------------
const MOCK_USERS = [
  { userId: 'u-moderator-1', name: 'Ms. Rivera', role: 'MODERATOR' },
  { userId: 'u-student-1',   name: 'Aiden Park',   role: 'VIEWER' },
  { userId: 'u-student-2',   name: 'Sofia Okafor',  role: 'VIEWER' },
  { userId: 'u-student-3',   name: 'Leo Fernandez', role: 'VIEWER' },
  { userId: 'u-student-4',   name: 'Priya Nair',    role: 'VIEWER' },
];

const MOCK_MESSAGES = [
  {
    messageId: 'msg-1',
    senderUserId: 'u-moderator-1',
    message: 'Good morning everyone! Let\'s get started with today\'s lesson.',
    createdAt: Date.now() - 300_000,
    messageMetadata: {},
  },
  {
    messageId: 'msg-2',
    senderUserId: 'u-student-1',
    message: 'Good morning Ms. Rivera!',
    createdAt: Date.now() - 250_000,
    messageMetadata: {},
  },
  {
    messageId: 'msg-3',
    senderUserId: 'u-student-2',
    message: 'Will we be covering fractions today?',
    createdAt: Date.now() - 200_000,
    messageMetadata: {},
  },
  {
    messageId: 'msg-4',
    senderUserId: 'u-moderator-1',
    message: 'Yes! We\'ll start with equivalent fractions and move on to adding them.',
    createdAt: Date.now() - 150_000,
    messageMetadata: {},
  },
  {
    messageId: 'msg-5',
    senderUserId: 'u-student-3',
    message: 'I practiced last night!',
    createdAt: Date.now() - 60_000,
    messageMetadata: {},
  },
];

const MOCK_VOICES = [
  { userId: 'u-moderator-1', talking: true,  muted: false, startTime: Date.now() - 5000 },
  { userId: 'u-student-1',   talking: false, muted: true,  startTime: 0 },
  { userId: 'u-student-2',   talking: false, muted: false, startTime: 0 },
  { userId: 'u-student-3',   talking: false, muted: false, startTime: 0 },
  { userId: 'u-student-4',   talking: false, muted: true,  startTime: 0 },
];

// ---------------------------------------------------------------------------
// Mock API object returned by getPluginApi()
// ---------------------------------------------------------------------------
function makeMockApi(): PluginApi {
  return {
    useLoadedChatMessages: () => ({ data: MOCK_MESSAGES }),
    useLoadedUserList:     () => ({ data: MOCK_USERS }),
    useTalkingIndicator:   () => ({ data: MOCK_VOICES }),

    serverCommands: {
      chat: {
        sendPublicChatMessage: (args: unknown) => {
          console.log('[mock-sdk] sendPublicChatMessage called', args);
        },
      },
    },

    uiCommands: {
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
// Misc named exports the SDK normally provides (add more as needed)
// ---------------------------------------------------------------------------
export const pluginLogger = {
  info:  (...args: unknown[]) => console.log('[mock-sdk] info:', ...args),
  warn:  (...args: unknown[]) => console.warn('[mock-sdk] warn:', ...args),
  error: (...args: unknown[]) => console.error('[mock-sdk] error:', ...args),
};
