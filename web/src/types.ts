export type ConsentStatus = 'self' | 'consented' | 'memorial';
export type SessionKind = 'text' | 'voice';
export type SessionStatus = 'active' | 'completed' | 'cancelled' | 'failed';
export type MessageRole = 'user' | 'assistant';

export interface Companion {
  id: string;
  name: string;
  relationship: string;
  custom_relationship?: string;
  voice_status: ConsentStatus;
  consent_acknowledged?: boolean;
  ai_disclosure_acknowledged?: boolean;
  consent_note?: string;
  traits: string[];
  address_as?: string;
  helpful_when?: string;
  avoid?: string;
  memories?: string[];
  avatar_uri?: string;
  avatar_url?: string;
  voicebox_profile_id?: string;
  sample_transcript?: string;
  created_at?: string;
}

export interface MoodEntry {
  id: string;
  mood: string;
  score?: number;
  tags?: string[];
  note?: string;
  context?: 'check-in' | 'before-session' | 'after-session' | string;
  session_id?: string;
  created_at: string;
}

export interface JournalEntry {
  id: string;
  title?: string;
  body: string;
  session_id?: string;
  created_at: string;
  updated_at?: string;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  modality?: 'text' | 'voice';
  audio_url?: string;
  audio_uri?: string;
  voicebox_generation_id?: string;
  created_at: string;
}

export interface Session {
  id: string;
  companion_id: string;
  kind: SessionKind;
  status: SessionStatus;
  intention?: string;
  started_at: string;
  ended_at?: string;
  messages?: ChatMessage[];
}

export interface ServiceHealth {
  configured: boolean;
  online: boolean;
  model?: string;
  url?: string;
  detail?: string;
}

export interface HealthResponse {
  status: string;
  groq: ServiceHealth;
  voicebox: ServiceHealth;
}

export interface VoiceboxProfile {
  id: string;
  name?: string;
  status?: string;
}

export interface VoiceGeneration {
  id?: string;
  status?: string;
  audio_url?: string;
  detail?: string;
  error?: string;
}

export interface CompanionDraft {
  name: string;
  relationship: string;
  custom_relationship?: string;
  voice_status: ConsentStatus;
  consent_acknowledged: boolean;
  ai_disclosure_acknowledged: boolean;
  consent_note?: string;
  traits: string[];
  address_as?: string;
  helpful_when?: string;
  avoid?: string;
  voicebox_profile_id?: string;
  sample_transcript?: string;
}
