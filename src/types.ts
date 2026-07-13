export const APP_DATA_VERSION = 1 as const;

export type AppDataVersion = typeof APP_DATA_VERSION;
export type ISODateString = string;
export type CompanionRelationship =
  | 'friend'
  | 'parent'
  | 'partner'
  | 'sibling'
  | 'mentor'
  | 'other';

/** How the app is permitted to use the source voice. */
export type ConsentStatus = 'self' | 'consented' | 'memorial';

export interface CompanionProfile {
  id: string;
  name: string;
  relationship: CompanionRelationship;
  customRelationship?: string;
  voiceStatus: ConsentStatus;
  consentAcknowledged: boolean;
  consentAt: ISODateString;
  consentNote?: string;
  voiceSampleUri?: string;
  voiceSampleName?: string;
  sampleTranscript?: string;
  voiceboxProfileId?: string;
  avatarUri?: string;
  traits: string[];
  memories: string[];
  addressAs?: string;
  helpfulWhen?: string;
  avoid?: string;
  createdAt: ISODateString;
}

export interface OnboardingProfile {
  hasSeenWelcome: boolean;
  companion?: CompanionProfile;
}

export type MoodScore = 1 | 2 | 3 | 4 | 5;
export type MoodContext = 'check-in' | 'before-session' | 'after-session';

export interface MoodEntry {
  id: string;
  mood: string;
  score?: MoodScore;
  note?: string;
  tags?: string[];
  context?: MoodContext;
  sessionId?: string;
  createdAt: ISODateString;
}

export interface JournalEntry {
  id: string;
  title?: string;
  body: string;
  sessionId?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export type ChatRole = 'user' | 'assistant';
export type ChatModality = 'text' | 'voice';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  modality: ChatModality;
  createdAt: ISODateString;
  audioUri?: string;
  voiceboxGenerationId?: string;
}

export type SessionKind = 'text' | 'voice';
export type SessionStatus = 'active' | 'completed' | 'cancelled' | 'failed';

export interface SessionEntry {
  id: string;
  companionId: string;
  kind: SessionKind;
  status: SessionStatus;
  startedAt: ISODateString;
  endedAt?: ISODateString;
  messages: ChatMessage[];
  intention?: string;
  moodBeforeId?: string;
  moodAfterId?: string;
  journalEntryId?: string;
  errorMessage?: string;
}

export interface AppSettings {
  /** Public HTTPS FastAPI address; user-editable so a tunnel change never requires rebuilding the APK. */
  apiBaseUrl: string;
  allowTranscripts: boolean;
  reducedMotion: boolean;
}

export interface AppData {
  version: AppDataVersion;
  hasSeenWelcome: boolean;
  companion?: CompanionProfile;
  moods: MoodEntry[];
  journal: JournalEntry[];
  sessions: SessionEntry[];
  /** Remote profiles created during an interrupted sync that still need deletion. */
  pendingVoiceboxProfileIds: string[];
  settings: AppSettings;
}

/** Creates a genuinely empty local profile; it never inserts demo companions or entries. */
export function createEmptyAppData(): AppData {
  return {
    version: APP_DATA_VERSION,
    hasSeenWelcome: false,
    moods: [],
    journal: [],
    sessions: [],
    pendingVoiceboxProfileIds: [],
    settings: {
      apiBaseUrl: '',
      allowTranscripts: false,
      reducedMotion: false,
    },
  };
}
