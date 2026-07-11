/**
 * Typed client for the Saanjh FastAPI gateway.
 *
 * EXPO_PUBLIC_API_URL is a public build-time value, not a secret. Point it at
 * the HTTPS origin of the deployed gateway (for example,
 * https://api.example.com). Groq and Voicebox credentials remain on that
 * server and must never be placed in an EXPO_PUBLIC_* variable.
 */

declare const process: {
  env: {
    EXPO_PUBLIC_API_URL?: string;
  };
};

export const AI_DISCLOSURE = 'This is an AI-generated companion voice, not the real person.' as const;
export const DEFAULT_API_TIMEOUT_MS = 30_000;
// A cold Voicebox engine can take more than two minutes to enter GPU memory.
export const DEFAULT_VOICE_TIMEOUT_MS = 300_000;

export type Relationship = 'friend' | 'parent' | 'partner' | 'sibling' | 'mentor' | 'other';
export type VoiceStatus = 'self' | 'consented' | 'memorial';
export type MoodContext = 'check-in' | 'before-session' | 'after-session';
export type SessionKind = 'text' | 'voice';
export type SessionStatus = 'active' | 'completed' | 'cancelled' | 'failed';
export type MessageRole = 'user' | 'assistant';
export type MessageModality = 'text' | 'voice';

export interface ServiceHealth {
  status: 'ok' | 'unavailable';
  detail: string | null;
  model: string | null;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  database: ServiceHealth;
  groq: ServiceHealth;
  voicebox: ServiceHealth;
}

export interface CompanionValues {
  name: string;
  relationship: Relationship;
  custom_relationship?: string | null;
  voice_status: VoiceStatus;
  consent_acknowledged: boolean;
  consent_at?: string | null;
  consent_note?: string | null;
  ai_disclosure_acknowledged: boolean;
  disclosure_text?: typeof AI_DISCLOSURE;
  voice_sample_uri?: string | null;
  voice_sample_name?: string | null;
  sample_transcript?: string | null;
  voicebox_profile_id?: string | null;
  avatar_uri?: string | null;
  traits?: string[];
  memories?: string[];
  address_as?: string | null;
  helpful_when?: string | null;
  avoid?: string | null;
}

export interface CompanionCreate extends CompanionValues {
  id?: string;
}

export type CompanionPatch = Partial<CompanionValues>;

export interface Companion extends CompanionValues {
  id: string;
  consent_at: string;
  disclosure_text: typeof AI_DISCLOSURE;
  traits: string[];
  memories: string[];
  created_at: string;
  updated_at: string;
}

export interface MoodCreate {
  id?: string;
  mood: string;
  score?: 1 | 2 | 3 | 4 | 5 | null;
  note?: string | null;
  tags?: string[];
  context?: MoodContext | null;
  session_id?: string | null;
  created_at?: string | null;
}

export interface MoodEntry {
  id: string;
  mood: string;
  score: 1 | 2 | 3 | 4 | 5 | null;
  note: string | null;
  tags: string[];
  context: MoodContext | null;
  session_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface JournalCreate {
  id?: string;
  title?: string | null;
  body: string;
  session_id?: string | null;
  created_at?: string | null;
}

export interface JournalEntry {
  id: string;
  title: string | null;
  body: string;
  session_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionCreate {
  id?: string;
  companion_id: string;
  kind: SessionKind;
  status?: SessionStatus;
  intention?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  error_message?: string | null;
}

export interface SessionPatch {
  status?: SessionStatus;
  intention?: string | null;
  ended_at?: string | null;
  error_message?: string | null;
}

export interface SessionEntry {
  id: string;
  companion_id: string;
  kind: SessionKind;
  status: SessionStatus;
  intention: string | null;
  started_at: string;
  ended_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface MessageCreate {
  id?: string;
  role: MessageRole;
  content: string;
  modality?: MessageModality;
  audio_uri?: string | null;
  voicebox_generation_id?: string | null;
  created_at?: string | null;
}

export interface MessagePatch {
  content?: string;
  modality?: MessageModality;
  audio_uri?: string | null;
  voicebox_generation_id?: string | null;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: MessageRole;
  content: string;
  modality: MessageModality;
  audio_uri: string | null;
  voicebox_generation_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatRequest {
  companion_id: string;
  session_id?: string | null;
  message: string;
  modality?: MessageModality;
}

export interface ChatTurn {
  session_id: string;
  user_message: ChatMessage;
  assistant_message: ChatMessage;
  model: string;
}

export interface VoiceboxProfileCreate {
  name: string;
  description?: string | null;
  language?: string;
  voice_type?: string;
  default_engine?: string | null;
}

/** Voicebox is an upstream service, so it may add fields across versions. */
export interface VoiceboxProfile {
  id?: string;
  profile_id?: string;
  name?: string;
  status?: string;
  [key: string]: unknown;
}

export interface VoiceboxGenerateRequest {
  text: string;
  profile_id: string;
  language?: string;
  engine?: string | null;
}

export interface VoiceboxGeneration {
  id?: string;
  generation_id?: string;
  job_id?: string;
  status?: string;
  audio_url?: string;
  audio_path?: string;
  detail?: string;
  error?: string;
  [key: string]: unknown;
}

export interface NormalizedVoiceboxGeneration extends VoiceboxGeneration {
  generation_id: string;
  audio_url?: string;
}

/** File shape accepted by React Native's FormData implementation. */
export interface ReactNativeFile {
  uri: string;
  name: string;
  type: string;
}

export interface TranscriptionOptions {
  language?: string;
  model?: string;
}

export interface Pagination {
  limit?: number;
  offset?: number;
}

export interface ApiRequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface WaitForGenerationOptions extends ApiRequestOptions {
  pollIntervalMs?: number;
  maxWaitMs?: number;
}

export interface FastApiValidationIssue {
  location: string;
  message: string;
  type?: string;
}

interface BackendErrorBody {
  service?: string;
  code?: string;
  message?: string;
  upstream_status?: number | null;
}

interface ErrorDescription {
  message: string;
  code?: string;
  service?: string;
  upstreamStatus?: number | null;
  validationIssues?: FastApiValidationIssue[];
}

export class SaanjhApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly service?: string;
  readonly upstreamStatus?: number | null;
  readonly validationIssues?: FastApiValidationIssue[];
  readonly details?: unknown;
  readonly method?: string;
  readonly url?: string;

  constructor(
    message: string,
    options: {
      status?: number;
      code?: string;
      service?: string;
      upstreamStatus?: number | null;
      validationIssues?: FastApiValidationIssue[];
      details?: unknown;
      method?: string;
      url?: string;
      cause?: unknown;
    } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'SaanjhApiError';
    this.status = options.status ?? 0;
    this.code = options.code;
    this.service = options.service;
    this.upstreamStatus = options.upstreamStatus;
    this.validationIssues = options.validationIssues;
    this.details = options.details;
    this.method = options.method;
    this.url = options.url;
  }
}

type ApiBody = FormData | Record<string, unknown> | unknown[] | null;
type InternalRequestOptions = ApiRequestOptions & {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: ApiBody;
  headers?: Record<string, string>;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function normalizeApiBaseUrl(value: string | undefined): string {
  const normalized = value?.trim().replace(/\/+$/, '') ?? '';
  if (!normalized) return '';
  if (!/^https?:\/\//i.test(normalized)) {
    throw new SaanjhApiError('EXPO_PUBLIC_API_URL must begin with http:// or https://.', {
      code: 'invalid-api-url',
    });
  }
  return normalized;
}

export const SAANJH_API_BASE_URL = normalizeApiBaseUrl(process.env.EXPO_PUBLIC_API_URL);

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

export function mediaUrl(path: string | null | undefined, baseUrl = SAANJH_API_BASE_URL): string | undefined {
  const value = nonEmptyString(path);
  if (!value) return undefined;
  if (/^(https?:|file:|content:|blob:|data:)/i.test(value)) return value;
  const normalizedBase = normalizeApiBaseUrl(baseUrl);
  if (!normalizedBase) {
    throw new SaanjhApiError('Set EXPO_PUBLIC_API_URL before resolving backend media.', {
      code: 'api-not-configured',
    });
  }
  return joinUrl(normalizedBase, value);
}

function queryString(values: object): string {
  const pairs = Object.entries(values as Record<string, string | number | undefined>)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return pairs.length ? `?${pairs.join('&')}` : '';
}

function validationIssues(detail: unknown): FastApiValidationIssue[] | undefined {
  if (!Array.isArray(detail)) return undefined;
  const issues = detail.flatMap((value): FastApiValidationIssue[] => {
    if (!isObject(value)) return [];
    const message = nonEmptyString(value.msg) ?? nonEmptyString(value.message);
    if (!message) return [];
    const rawLocation = Array.isArray(value.loc) ? value.loc : [];
    const location = rawLocation
      .filter((part) => part !== 'body')
      .map(String)
      .join('.');
    return [{
      location: location || 'request',
      message,
      type: nonEmptyString(value.type),
    }];
  });
  return issues.length ? issues : undefined;
}

function describeError(payload: unknown, status: number): ErrorDescription {
  if (isObject(payload) && isObject(payload.error)) {
    const body = payload.error as BackendErrorBody;
    const message = nonEmptyString(body.message);
    if (message) {
      return {
        message,
        code: nonEmptyString(body.code),
        service: nonEmptyString(body.service),
        upstreamStatus: typeof body.upstream_status === 'number' || body.upstream_status === null
          ? body.upstream_status
          : undefined,
      };
    }
  }

  const detail = isObject(payload) ? payload.detail : undefined;
  const issues = validationIssues(detail);
  if (issues) {
    return {
      message: issues.map((issue) => `${issue.location}: ${issue.message}`).join('\n'),
      code: 'validation-error',
      validationIssues: issues,
    };
  }

  const direct = nonEmptyString(detail)
    ?? (isObject(payload) ? nonEmptyString(payload.message) : undefined)
    ?? nonEmptyString(payload);
  return {
    message: direct ?? `The Saanjh API returned HTTP ${status}.`,
    code: status === 422 ? 'validation-error' : 'http-error',
  };
}

function parsePayload(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function appendFile(form: FormData, file: ReactNativeFile): void {
  if (!file.uri.trim()) {
    throw new SaanjhApiError('The selected audio file has no URI.', { code: 'invalid-file' });
  }
  if (!file.name.trim()) {
    throw new SaanjhApiError('The selected audio file has no name.', { code: 'invalid-file' });
  }
  if (!file.type.trim()) {
    throw new SaanjhApiError('The selected audio file has no MIME type.', { code: 'invalid-file' });
  }
  form.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.type,
  } as unknown as Blob);
}

function unwrapObject(value: unknown, keys: string[]): Record<string, unknown> | undefined {
  if (!isObject(value)) return undefined;
  for (const key of keys) {
    if (isObject(value[key])) return value[key];
  }
  return value;
}

function generationId(value: Record<string, unknown>): string | undefined {
  for (const key of ['id', 'generation_id', 'job_id']) {
    const id = nonEmptyString(value[key]);
    if (id) return id;
    if (typeof value[key] === 'number' && Number.isFinite(value[key])) return String(value[key]);
  }
  return undefined;
}

function normalizeGeneration(value: unknown, baseUrl: string): NormalizedVoiceboxGeneration {
  const generation = unwrapObject(value, ['generation', 'data', 'result', 'job']);
  const id = generation && generationId(generation);
  if (!generation || !id) {
    throw new SaanjhApiError('Voicebox returned a generation without an id.', {
      status: 502,
      code: 'invalid-voicebox-response',
      service: 'Voicebox',
      details: value,
    });
  }
  const rawAudioUrl = nonEmptyString(generation.audio_url);
  const status = nonEmptyString(generation.status)?.toLowerCase();
  const resolvedAudioUrl = rawAudioUrl
    ? mediaUrl(rawAudioUrl, baseUrl)
    : status === 'completed' || nonEmptyString(generation.audio_path)
      ? mediaUrl(`/api/voicebox/audio/${encodeURIComponent(id)}`, baseUrl)
      : undefined;
  return {
    ...generation,
    generation_id: id,
    audio_url: resolvedAudioUrl,
  } as NormalizedVoiceboxGeneration;
}

function transcriptionText(value: unknown): string | undefined {
  if (typeof value === 'string') return nonEmptyString(value);
  const candidate = unwrapObject(value, ['data', 'transcription', 'result']);
  if (!candidate) return undefined;
  return nonEmptyString(candidate.transcript) ?? nonEmptyString(candidate.text);
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(new SaanjhApiError('The request was cancelled.', { code: 'aborted' }));
  }
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(new SaanjhApiError('The request was cancelled.', { code: 'aborted' }));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export class SaanjhApiClient {
  readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly defaultTimeoutMs: number;

  constructor(options: {
    baseUrl?: string;
    fetchImpl?: typeof fetch;
    defaultTimeoutMs?: number;
  } = {}) {
    this.baseUrl = normalizeApiBaseUrl(options.baseUrl ?? SAANJH_API_BASE_URL);
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? DEFAULT_API_TIMEOUT_MS;
  }

  private async request<T>(path: string, options: InternalRequestOptions = {}): Promise<T> {
    if (!this.baseUrl) {
      throw new SaanjhApiError(
        'The Saanjh backend is not configured. Set EXPO_PUBLIC_API_URL to its public HTTPS address and rebuild the app.',
        { code: 'api-not-configured' },
      );
    }

    const url = joinUrl(this.baseUrl, path);
    const method = options.method ?? 'GET';
    const controller = new AbortController();
    const externalSignal = options.signal;
    const relayAbort = () => controller.abort();
    if (externalSignal?.aborted) controller.abort();
    else externalSignal?.addEventListener('abort', relayAbort, { once: true });

    let timedOut = false;
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const isForm = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const body = options.body === undefined
      ? undefined
      : isForm
        ? options.body as FormData
        : JSON.stringify(options.body);

    try {
      const response = await this.fetchImpl(url, {
        method,
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          ...(!isForm && options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...options.headers,
        },
        body,
      });
      const payload = parsePayload(await response.text());
      if (!response.ok) {
        const description = describeError(payload, response.status);
        throw new SaanjhApiError(description.message, {
          status: response.status,
          code: description.code,
          service: description.service,
          upstreamStatus: description.upstreamStatus,
          validationIssues: description.validationIssues,
          details: payload,
          method,
          url,
        });
      }
      return payload as T;
    } catch (error) {
      if (error instanceof SaanjhApiError) throw error;
      if (timedOut) {
        throw new SaanjhApiError(`The Saanjh API did not respond within ${Math.round(timeoutMs / 1000)} seconds.`, {
          code: 'timeout',
          method,
          url,
          cause: error,
        });
      }
      if (externalSignal?.aborted || controller.signal.aborted) {
        throw new SaanjhApiError('The request was cancelled.', {
          code: 'aborted',
          method,
          url,
          cause: error,
        });
      }
      throw new SaanjhApiError('Could not reach the Saanjh backend. Check your connection and the public API address.', {
        code: 'network-error',
        method,
        url,
        cause: error,
      });
    } finally {
      clearTimeout(timer);
      externalSignal?.removeEventListener('abort', relayAbort);
    }
  }

  health(options?: ApiRequestOptions): Promise<HealthResponse> {
    return this.request('/api/health', options);
  }

  getCurrentCompanion(options?: ApiRequestOptions): Promise<Companion | null> {
    return this.request('/api/companion', options);
  }

  getCompanion(companionId: string, options?: ApiRequestOptions): Promise<Companion> {
    return this.request(`/api/companion/${encodeURIComponent(companionId)}`, options);
  }

  createCompanion(input: CompanionCreate, options?: ApiRequestOptions): Promise<Companion> {
    return this.request('/api/companion', { ...options, method: 'POST', body: input as unknown as Record<string, unknown> });
  }

  updateCompanion(companionId: string, patch: CompanionPatch, options?: ApiRequestOptions): Promise<Companion> {
    return this.request(`/api/companion/${encodeURIComponent(companionId)}`, {
      ...options,
      method: 'PATCH',
      body: patch as Record<string, unknown>,
    });
  }

  deleteCompanion(companionId: string, options?: ApiRequestOptions): Promise<void> {
    return this.request(`/api/companion/${encodeURIComponent(companionId)}`, { ...options, method: 'DELETE' });
  }

  listMoods(pagination: Pagination = {}, options?: ApiRequestOptions): Promise<MoodEntry[]> {
    return this.request(`/api/moods${queryString(pagination)}`, options);
  }

  getMood(moodId: string, options?: ApiRequestOptions): Promise<MoodEntry> {
    return this.request(`/api/moods/${encodeURIComponent(moodId)}`, options);
  }

  createMood(input: MoodCreate, options?: ApiRequestOptions): Promise<MoodEntry> {
    return this.request('/api/moods', { ...options, method: 'POST', body: input as unknown as Record<string, unknown> });
  }

  deleteMood(moodId: string, options?: ApiRequestOptions): Promise<void> {
    return this.request(`/api/moods/${encodeURIComponent(moodId)}`, { ...options, method: 'DELETE' });
  }

  listJournal(pagination: Pagination = {}, options?: ApiRequestOptions): Promise<JournalEntry[]> {
    return this.request(`/api/journal${queryString(pagination)}`, options);
  }

  getJournalEntry(entryId: string, options?: ApiRequestOptions): Promise<JournalEntry> {
    return this.request(`/api/journal/${encodeURIComponent(entryId)}`, options);
  }

  createJournalEntry(input: JournalCreate, options?: ApiRequestOptions): Promise<JournalEntry> {
    return this.request('/api/journal', { ...options, method: 'POST', body: input as unknown as Record<string, unknown> });
  }

  deleteJournalEntry(entryId: string, options?: ApiRequestOptions): Promise<void> {
    return this.request(`/api/journal/${encodeURIComponent(entryId)}`, { ...options, method: 'DELETE' });
  }

  listSessions(
    filters: Pagination & { companion_id?: string } = {},
    options?: ApiRequestOptions,
  ): Promise<SessionEntry[]> {
    return this.request(`/api/sessions${queryString(filters)}`, options);
  }

  getSession(sessionId: string, options?: ApiRequestOptions): Promise<SessionEntry> {
    return this.request(`/api/sessions/${encodeURIComponent(sessionId)}`, options);
  }

  createSession(input: SessionCreate, options?: ApiRequestOptions): Promise<SessionEntry> {
    return this.request('/api/sessions', { ...options, method: 'POST', body: input as unknown as Record<string, unknown> });
  }

  updateSession(sessionId: string, patch: SessionPatch, options?: ApiRequestOptions): Promise<SessionEntry> {
    return this.request(`/api/sessions/${encodeURIComponent(sessionId)}`, {
      ...options,
      method: 'PATCH',
      body: patch as Record<string, unknown>,
    });
  }

  listMessages(sessionId: string, pagination: Pagination = {}, options?: ApiRequestOptions): Promise<ChatMessage[]> {
    return this.request(
      `/api/sessions/${encodeURIComponent(sessionId)}/messages${queryString(pagination)}`,
      options,
    );
  }

  createMessage(sessionId: string, input: MessageCreate, options?: ApiRequestOptions): Promise<ChatMessage> {
    return this.request(`/api/sessions/${encodeURIComponent(sessionId)}/messages`, {
      ...options,
      method: 'POST',
      body: input as unknown as Record<string, unknown>,
    });
  }

  updateMessage(
    sessionId: string,
    messageId: string,
    patch: MessagePatch,
    options?: ApiRequestOptions,
  ): Promise<ChatMessage> {
    return this.request(
      `/api/sessions/${encodeURIComponent(sessionId)}/messages/${encodeURIComponent(messageId)}`,
      { ...options, method: 'PATCH', body: patch as Record<string, unknown> },
    );
  }

  chat(input: ChatRequest, options?: ApiRequestOptions): Promise<ChatTurn> {
    return this.request('/api/chat', {
      ...options,
      timeoutMs: options?.timeoutMs ?? 60_000,
      method: 'POST',
      body: input as unknown as Record<string, unknown>,
    });
  }

  voiceboxHealth(options?: ApiRequestOptions): Promise<unknown> {
    return this.request('/api/voicebox/health', options);
  }

  async listVoiceboxProfiles(options?: ApiRequestOptions): Promise<VoiceboxProfile[]> {
    const payload = await this.request<unknown>('/api/voicebox/profiles', options);
    if (Array.isArray(payload)) return payload.filter(isObject) as VoiceboxProfile[];
    if (isObject(payload)) {
      for (const key of ['profiles', 'data', 'items']) {
        if (Array.isArray(payload[key])) return payload[key].filter(isObject) as VoiceboxProfile[];
      }
    }
    throw new SaanjhApiError('Voicebox returned an invalid profiles list.', {
      status: 502,
      code: 'invalid-voicebox-response',
      service: 'Voicebox',
      details: payload,
    });
  }

  async createVoiceboxProfile(
    input: VoiceboxProfileCreate,
    options?: ApiRequestOptions,
  ): Promise<VoiceboxProfile> {
    const payload = await this.request<unknown>('/api/voicebox/profiles', {
      ...options,
      method: 'POST',
      body: input as unknown as Record<string, unknown>,
    });
    const profile = unwrapObject(payload, ['profile', 'data']);
    if (!profile) {
      throw new SaanjhApiError('Voicebox returned an invalid profile.', {
        status: 502,
        code: 'invalid-voicebox-response',
        service: 'Voicebox',
        details: payload,
      });
    }
    return profile as VoiceboxProfile;
  }

  deleteVoiceboxProfile(profileId: string, options?: ApiRequestOptions): Promise<void> {
    return this.request(`/api/voicebox/profiles/${encodeURIComponent(profileId)}`, {
      ...options,
      method: 'DELETE',
    });
  }

  uploadVoiceSample(
    profileId: string,
    file: ReactNativeFile,
    referenceText: string,
    options?: ApiRequestOptions,
  ): Promise<unknown> {
    const form = new FormData();
    appendFile(form, file);
    form.append('reference_text', referenceText);
    return this.request(`/api/voicebox/profiles/${encodeURIComponent(profileId)}/samples`, {
      ...options,
      timeoutMs: options?.timeoutMs ?? DEFAULT_VOICE_TIMEOUT_MS,
      method: 'POST',
      body: form,
    });
  }

  async transcribe(
    file: ReactNativeFile,
    input: TranscriptionOptions = {},
    options?: ApiRequestOptions,
  ): Promise<string> {
    const form = new FormData();
    appendFile(form, file);
    if (input.language?.trim()) form.append('language', input.language.trim());
    if (input.model?.trim()) form.append('model', input.model.trim());
    const payload = await this.request<unknown>('/api/voicebox/transcribe', {
      ...options,
      timeoutMs: options?.timeoutMs ?? DEFAULT_VOICE_TIMEOUT_MS,
      method: 'POST',
      body: form,
    });
    const transcript = transcriptionText(payload);
    if (!transcript) {
      throw new SaanjhApiError('Voicebox returned no transcription text.', {
        status: 502,
        code: 'invalid-voicebox-response',
        service: 'Voicebox',
        details: payload,
      });
    }
    return transcript;
  }

  async generateVoice(
    input: VoiceboxGenerateRequest,
    options?: ApiRequestOptions,
  ): Promise<NormalizedVoiceboxGeneration> {
    const payload = await this.request<unknown>('/api/voicebox/generate', {
      ...options,
      timeoutMs: options?.timeoutMs ?? DEFAULT_VOICE_TIMEOUT_MS,
      method: 'POST',
      body: input as unknown as Record<string, unknown>,
    });
    return normalizeGeneration(payload, this.baseUrl);
  }

  async getVoiceGeneration(
    id: string,
    options?: ApiRequestOptions,
  ): Promise<NormalizedVoiceboxGeneration> {
    const payload = await this.request<unknown>(`/api/voicebox/history/${encodeURIComponent(id)}`, options);
    return normalizeGeneration(payload, this.baseUrl);
  }

  async waitForVoiceGeneration(
    id: string,
    options: WaitForGenerationOptions = {},
  ): Promise<NormalizedVoiceboxGeneration> {
    const startedAt = Date.now();
    const maxWaitMs = options.maxWaitMs ?? DEFAULT_VOICE_TIMEOUT_MS;
    const pollIntervalMs = options.pollIntervalMs ?? 1_000;
    while (Date.now() - startedAt < maxWaitMs) {
      const generation = await this.getVoiceGeneration(id, options);
      const status = generation.status?.toLowerCase();
      if (status === 'completed' || generation.audio_url) return generation;
      if (status === 'failed' || status === 'error' || status === 'cancelled') {
        throw new SaanjhApiError(generation.error ?? generation.detail ?? 'Voicebox could not generate this audio.', {
          status: 502,
          code: 'generation-failed',
          service: 'Voicebox',
          details: generation,
        });
      }
      await delay(pollIntervalMs, options.signal);
    }
    throw new SaanjhApiError('Voicebox did not finish generating audio in time.', {
      code: 'generation-timeout',
      service: 'Voicebox',
      details: { generationId: id, maxWaitMs },
    });
  }

  voiceAudioUrl(generationId: string): string {
    return mediaUrl(`/api/voicebox/audio/${encodeURIComponent(generationId)}`, this.baseUrl) as string;
  }
}

export const saanjhApi = new SaanjhApiClient();
export const api = saanjhApi;

export function displaySaanjhError(error: unknown): string {
  if (error instanceof SaanjhApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'The request could not be completed.';
}
