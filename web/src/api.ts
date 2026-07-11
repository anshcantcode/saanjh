import type {
  ChatMessage,
  Companion,
  CompanionDraft,
  HealthResponse,
  JournalEntry,
  MoodEntry,
  Session,
  SessionKind,
  VoiceboxProfile,
  VoiceGeneration,
} from './types';

const configuredBase = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').trim();
export const API_BASE_URL = configuredBase.replace(/\/$/, '');

export class ApiError extends Error {
  status: number;
  detail?: unknown;

  constructor(message: string, status: number, detail?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown };

function errorText(body: unknown, fallback: string): string {
  if (typeof body === 'string' && body.trim()) return body;
  if (Array.isArray(body)) {
    const messages = body
      .map((item) => {
        if (item && typeof item === 'object') {
          const validation = item as Record<string, unknown>;
          const message = typeof validation.msg === 'string' ? validation.msg.trim() : '';
          const location = Array.isArray(validation.loc)
            ? validation.loc.filter((part) => part !== 'body').map(String).join('.')
            : '';
          if (message) return location ? `${location}: ${message}` : message;
        }
        return errorText(item, '');
      })
      .filter(Boolean);
    return messages.join(' • ') || fallback;
  }
  if (body && typeof body === 'object') {
    const value = body as Record<string, unknown>;
    for (const key of ['detail', 'message', 'error']) {
      if (typeof value[key] === 'string' && value[key]) return value[key] as string;
      if (value[key] && typeof value[key] === 'object') {
        const nested = errorText(value[key], '');
        if (nested) return nested;
      }
    }
  }
  return fallback;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const isForm = options.body instanceof FormData;
  const requestBody: BodyInit | undefined = options.body === undefined
    ? undefined
    : isForm
      ? options.body as FormData
      : JSON.stringify(options.body);
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(isForm ? {} : options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
    body: requestBody,
  });

  const contentType = response.headers.get('content-type') || '';
  const payload: unknown = contentType.includes('application/json')
    ? await response.json().catch(() => undefined)
    : await response.text().catch(() => undefined);

  if (!response.ok) {
    throw new ApiError(errorText(payload, `The server returned ${response.status}.`), response.status, payload);
  }
  return payload as T;
}

function listFrom<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    for (const key of ['items', 'data', 'results', 'entries', 'companions', 'moods', 'journal', 'sessions', 'profiles']) {
      if (Array.isArray(object[key])) return object[key] as T[];
    }
  }
  return [];
}

function objectFrom<T>(value: unknown, keys: string[]): T {
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    for (const key of keys) {
      if (object[key] && typeof object[key] === 'object') return object[key] as T;
    }
  }
  return value as T;
}

export function mediaUrl(path?: string): string | undefined {
  if (!path) return undefined;
  if (/^(https?:|blob:|data:)/i.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

export const api = {
  health: () => request<unknown>('/api/health').then((value) => {
    const source = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
    const service = (name: 'groq' | 'voicebox') => {
      const raw = (source[name] && typeof source[name] === 'object' ? source[name] : {}) as Record<string, unknown>;
      const status = typeof raw.status === 'string' ? raw.status.toLowerCase() : '';
      const detail = typeof raw.detail === 'string' ? raw.detail : undefined;
      const explicitlyUnconfigured = Boolean(detail && /not configured/i.test(detail));
      return {
        configured: typeof raw.configured === 'boolean' ? raw.configured : !explicitlyUnconfigured,
        online: typeof raw.online === 'boolean' ? raw.online : status === 'ok' || status === 'healthy' || status === 'online',
        model: typeof raw.model === 'string' ? raw.model : undefined,
        url: typeof raw.url === 'string' ? raw.url : undefined,
        detail,
      };
    };
    return {
      status: typeof source.status === 'string' ? source.status : 'unavailable',
      groq: service('groq'),
      voicebox: service('voicebox'),
    } satisfies HealthResponse;
  }),

  async companion(): Promise<Companion | null> {
    try {
      const payload = await request<unknown>('/api/companion');
      const list = listFrom<Companion>(payload);
      if (list.length) return list[0];
      const companion = objectFrom<Companion | null>(payload, ['companion', 'data']);
      return companion && typeof companion === 'object' && 'id' in companion ? companion : null;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },

  createCompanion: (draft: CompanionDraft) =>
    request<unknown>('/api/companion', { method: 'POST', body: draft })
      .then((value) => objectFrom<Companion>(value, ['companion', 'data'])),

  updateCompanion: (id: string, patch: Partial<CompanionDraft | Companion>) =>
    request<unknown>(`/api/companion/${encodeURIComponent(id)}`, { method: 'PUT', body: patch })
      .then((value) => objectFrom<Companion>(value, ['companion', 'data'])),

  deleteCompanion: (id: string) =>
    request<void>(`/api/companion/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  moods: () => request<unknown>('/api/moods').then(listFrom<MoodEntry>),
  createMood: (entry: Omit<MoodEntry, 'id' | 'created_at'>) =>
    request<unknown>('/api/moods', { method: 'POST', body: entry })
      .then((value) => objectFrom<MoodEntry>(value, ['mood', 'data'])),
  deleteMood: (id: string) => request<void>(`/api/moods/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  journal: () => request<unknown>('/api/journal').then(listFrom<JournalEntry>),
  createJournal: (entry: Pick<JournalEntry, 'title' | 'body' | 'session_id'>) =>
    request<unknown>('/api/journal', { method: 'POST', body: entry })
      .then((value) => objectFrom<JournalEntry>(value, ['entry', 'journal_entry', 'data'])),
  deleteJournal: (id: string) => request<void>(`/api/journal/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  sessions: () => request<unknown>('/api/sessions').then(listFrom<Session>),
  createSession: (companionId: string, kind: SessionKind, intention?: string) =>
    request<unknown>('/api/sessions', {
      method: 'POST',
      body: { companion_id: companionId, kind, intention: intention || undefined },
    }).then((value) => objectFrom<Session>(value, ['session', 'data'])),
  updateSession: (id: string, patch: Partial<Session>) =>
    request<unknown>(`/api/sessions/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch })
      .then((value) => objectFrom<Session>(value, ['session', 'data'])),
  addSessionMessage: (sessionId: string, message: Partial<ChatMessage>) =>
    request<unknown>(`/api/sessions/${encodeURIComponent(sessionId)}/messages`, { method: 'POST', body: message })
      .then((value) => objectFrom<ChatMessage>(value, ['message', 'data'])),

  chat: (body: { companion_id: string; session_id?: string; message: string; modality: 'text' | 'voice' }) =>
    request<unknown>('/api/chat', { method: 'POST', body }).then((value) => {
      const object = value as Record<string, unknown>;
      return {
        user_message: objectFrom<ChatMessage>(object.user_message, ['message', 'data']),
        assistant_message: objectFrom<ChatMessage>(object.assistant_message ?? object.reply ?? value, ['message', 'assistant_message', 'data']),
        audio_url: typeof object.audio_url === 'string' ? object.audio_url : undefined,
      };
    }),

  voiceboxHealth: () => request<unknown>('/api/voicebox/health'),
  voiceboxProfiles: () => request<unknown>('/api/voicebox/profiles').then(listFrom<VoiceboxProfile>),
  createVoiceboxProfile: (name: string) =>
    request<unknown>('/api/voicebox/profiles', {
      method: 'POST',
      body: { name, language: 'en', voice_type: 'cloned' },
    }).then((value) => objectFrom<VoiceboxProfile>(value, ['profile', 'data'])),
  deleteVoiceboxProfile: (profileId: string) =>
    request<void>(`/api/voicebox/profiles/${encodeURIComponent(profileId)}`, { method: 'DELETE' }),
  uploadVoiceSample: (profileId: string, file: File, transcript: string) => {
    const body = new FormData();
    body.append('file', file, file.name);
    body.append('reference_text', transcript);
    return request<unknown>(`/api/voicebox/profiles/${encodeURIComponent(profileId)}/samples`, { method: 'POST', body });
  },
  transcribe: (file: File) => {
    const body = new FormData();
    body.append('file', file, file.name);
    return request<unknown>('/api/voicebox/transcribe', { method: 'POST', body }).then((value) => {
      if (typeof value === 'string') return value;
      const object = value as Record<string, unknown>;
      const transcript = object.transcript ?? object.text ?? (object.data as Record<string, unknown> | undefined)?.transcript;
      if (typeof transcript !== 'string' || !transcript.trim()) throw new ApiError('Voicebox returned no transcript.', 502, value);
      return transcript;
    });
  },
  generateVoice: (body: { text: string; profile_id: string; engine?: string }) =>
    request<unknown>('/api/voicebox/generate', { method: 'POST', body }).then((value) => {
      const result = objectFrom<VoiceGeneration>(value, ['generation', 'data']);
      return {
        ...result,
        detail: result.detail || result.error,
        audio_url: mediaUrl(result.audio_url),
      };
    }),
  voiceGeneration: (generationId: string) =>
    request<unknown>(`/api/voicebox/history/${encodeURIComponent(generationId)}`).then((value) => {
      const result = objectFrom<VoiceGeneration>(value, ['generation', 'data']);
      return {
        ...result,
        detail: result.detail || result.error,
        audio_url: mediaUrl(result.audio_url),
      };
    }),
};

export function displayError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'The server could not complete that request.';
}
