/**
 * Typed client for the Saanjh FastAPI gateway.
 *
 * The app prefers EXPO_PUBLIC_API_URL but also falls back to Expo's runtime
 * config extra.apiUrl so Android builds keep working even when that env var is
 * absent. Groq and Voicebox credentials remain server-side and must never be
 * placed in an EXPO_PUBLIC_* variable.
 */

import Constants from 'expo-constants';
import { File as ExpoFile, UploadType } from 'expo-file-system';
import { Platform } from 'react-native';

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

export interface LocalCompanionContext {
  name: string;
  relationship: Relationship;
  custom_relationship?: string | null;
  voice_status: VoiceStatus;
  consent_acknowledged: true;
  ai_disclosure_acknowledged: true;
  traits?: string[];
  memories?: string[];
  address_as?: string | null;
  helpful_when?: string | null;
  avoid?: string | null;
}

export interface LocalChatRequest {
  companion: LocalCompanionContext;
  history?: Array<{ role: MessageRole; content: string }>;
  message: string;
}

export interface LocalChatResponse {
  reply: string;
  model: string;
  disclosure_text: typeof AI_DISCLOSURE;
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

export interface FileUploadProgress {
  bytesSent: number;
  totalBytes: number;
  /** A real byte ratio when the native uploader knows the total, otherwise null. */
  ratio: number | null;
  stage: 'reading' | 'uploading' | 'registering';
}

export interface FileUploadOptions extends ApiRequestOptions {
  onUploadProgress?: (progress: FileUploadProgress) => void;
}

export interface WaitForGenerationOptions extends ApiRequestOptions {
  pollIntervalMs?: number;
  maxWaitMs?: number;
  onProgress?: (progress: VoiceGenerationProgress) => void;
}

export interface VoiceGenerationProgress {
  generation: NormalizedVoiceboxGeneration;
  status: string;
  elapsedMs: number;
  pollCount: number;
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

const fallbackApiUrl = ((): string => {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromEnv) return fromEnv;

  const runtimeExtra = (
    (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)
    ?? (Constants.manifest2?.extra as { apiUrl?: string } | undefined)
    ?? (Constants.manifest?.extra as { apiUrl?: string } | undefined)
  );
  const fromExpoConfig = runtimeExtra?.apiUrl?.trim();
  if (fromExpoConfig) return fromExpoConfig;

  return '';
})();

export function normalizeApiBaseUrl(value: string | undefined): string {
  const normalized = value?.trim().replace(/\/+$/, '') ?? '';
  if (!normalized) return '';
  if (!/^https?:\/\//i.test(normalized)) {
    throw new SaanjhApiError('The Saanjh backend URL must begin with http:// or https://.', {
      code: 'invalid-api-url',
    });
  }
  return normalized;
}

export const SAANJH_API_BASE_URL = normalizeApiBaseUrl(fallbackApiUrl);

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

function appendQueryParam(url: string, key: string, value: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
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
      if (status === 401 || nonEmptyString(body.code) === 'authentication_required') {
        return {
          message: 'Authentication failed. Verify the backend connection and try again.',
          code: 'authentication_required',
          service: nonEmptyString(body.service),
          upstreamStatus: typeof body.upstream_status === 'number' || body.upstream_status === null
            ? body.upstream_status
            : undefined,
        };
      }
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

function uploadRatio(bytesSent: number, totalBytes: number): number | null {
  if (!Number.isFinite(totalBytes) || totalBytes <= 0) return null;
  return Math.max(0, Math.min(1, bytesSent / totalBytes));
}

function unwrapObject(value: unknown, keys: string[]): Record<string, unknown> | undefined {
  if (!isObject(value)) return undefined;
  for (const key of keys) {
    if (isObject(value[key])) return value[key];
  }
  return value;
}

function generationId(value: Record<string, unknown>): string | undefined {
  for (const key of ['id', 'generation_id', 'job_id', 'task_id']) {
    const id = nonEmptyString(value[key]);
    if (id) return id;
    if (typeof value[key] === 'number' && Number.isFinite(value[key])) return String(value[key]);
  }
  return undefined;
}

function voiceboxProfileId(value: Record<string, unknown>): string | undefined {
  for (const key of ['id', 'profile_id', 'voice_id']) {
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
  const rawAudioUrl = nonEmptyString(generation.audio_url) ?? nonEmptyString(generation.audio_uri);
  const hasAudioPath = Boolean(
    nonEmptyString(generation.audio_path)
    ?? nonEmptyString(generation.output_path)
    ?? nonEmptyString(generation.file_path)
    ?? nonEmptyString(generation.path),
  );
  const status = (nonEmptyString(generation.status) ?? nonEmptyString(generation.state))?.toLowerCase();
  const completed = status
    ? ['completed', 'complete', 'done', 'success', 'succeeded'].includes(status)
    : false;
  const resolvedAudioUrl = rawAudioUrl
    ? mediaUrl(rawAudioUrl, baseUrl)
    : completed || hasAudioPath
      ? mediaUrl(`/api/voicebox/audio/${encodeURIComponent(id)}`, baseUrl)
      : undefined;
  return {
    ...generation,
    generation_id: id,
    status: status ?? generation.status,
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
  private currentBaseUrl: string;
  private accessToken: string;
  private readonly fetchImpl: typeof fetch;
  private readonly defaultTimeoutMs: number;

  constructor(options: {
    baseUrl?: string;
    accessToken?: string;
    fetchImpl?: typeof fetch;
    defaultTimeoutMs?: number;
  } = {}) {
    this.currentBaseUrl = normalizeApiBaseUrl(options.baseUrl ?? SAANJH_API_BASE_URL);
    this.accessToken = options.accessToken?.trim() ?? '';
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? DEFAULT_API_TIMEOUT_MS;
  }

  get baseUrl(): string {
    return this.currentBaseUrl;
  }

  configure(options: { baseUrl?: string; accessToken?: string }): void {
    if (options.baseUrl !== undefined) this.currentBaseUrl = normalizeApiBaseUrl(options.baseUrl);
    if (options.accessToken !== undefined) this.accessToken = options.accessToken.trim();
  }

  private async request<T>(path: string, options: InternalRequestOptions = {}): Promise<T> {
    if (!this.baseUrl) {
      throw new SaanjhApiError(
        'The Saanjh backend is not configured. Add and test its public HTTPS address in the app connection settings.',
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
          ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
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

  private async requestBytes(path: string, options: ApiRequestOptions = {}): Promise<Uint8Array> {
    if (!this.baseUrl) throw new SaanjhApiError('The Saanjh backend is not configured.', { code: 'api-not-configured' });
    const baseUploadUrl = joinUrl(this.baseUrl, path);
    const url = this.accessToken ? appendQueryParam(baseUploadUrl, 'access_token', this.accessToken) : baseUploadUrl;
    const controller = new AbortController();
    const relayAbort = () => controller.abort();
    if (options.signal?.aborted) controller.abort();
    else options.signal?.addEventListener('abort', relayAbort, { once: true });
    const timeoutMs = options.timeoutMs ?? DEFAULT_VOICE_TIMEOUT_MS;
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    try {
      const response = await this.fetchImpl(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          Accept: 'audio/wav,audio/*;q=0.9,*/*;q=0.1',
          ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
        },
      });
      if (!response.ok) {
        const payload = parsePayload(await response.text());
        const description = describeError(payload, response.status);
        throw new SaanjhApiError(description.message, {
          status: response.status,
          code: description.code,
          service: description.service,
          details: payload,
          method: 'GET',
          url,
        });
      }
      return new Uint8Array(await response.arrayBuffer());
    } catch (error) {
      if (error instanceof SaanjhApiError) throw error;
      if (timedOut) throw new SaanjhApiError('Generated audio took too long to download.', { code: 'timeout', cause: error });
      if (options.signal?.aborted) throw new SaanjhApiError('The request was cancelled.', { code: 'aborted', cause: error });
      throw new SaanjhApiError('Could not download the generated audio from Saanjh.', { code: 'network-error', cause: error });
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', relayAbort);
    }
  }

  /**
   * Upload a local file using Expo's native transfer implementation on Android/iOS.
   *
   * React Native's fetch/FormData bridge can reject a perfectly valid file:// URI
   * before any request reaches FastAPI. ExpoFile.upload reads the URI natively and
   * also exposes real byte progress. The web branch still uses standards-based
   * FormData after resolving the local blob.
   */
  private async uploadMultipart<T>(
    path: string,
    file: ReactNativeFile,
    fields: Record<string, string>,
    options: FileUploadOptions = {},
  ): Promise<T> {
    if (!this.baseUrl) {
      throw new SaanjhApiError('The Saanjh backend is not configured.', { code: 'api-not-configured' });
    }
    if (!file.uri.trim()) throw new SaanjhApiError('The selected audio file has no URI.', { code: 'invalid-file' });
    if (!file.name.trim()) throw new SaanjhApiError('The selected audio file has no name.', { code: 'invalid-file' });
    if (!file.type.trim()) throw new SaanjhApiError('The selected audio file has no MIME type.', { code: 'invalid-file' });

    if (Platform.OS === 'web') {
      options.onUploadProgress?.({ bytesSent: 0, totalBytes: 0, ratio: null, stage: 'reading' });
      let blob: Blob;
      try {
        const localResponse = await this.fetchImpl(file.uri);
        if (!localResponse.ok) throw new Error(`Local file read returned ${localResponse.status}`);
        blob = await localResponse.blob();
      } catch (error) {
        throw new SaanjhApiError('Saanjh could not read the selected sample in this browser. Choose the audio file again.', {
          code: 'local-file-unreadable',
          cause: error,
        });
      }
      if (!blob.size) {
        throw new SaanjhApiError('The selected audio sample is empty. Record or import it again.', { code: 'empty-file' });
      }
      const form = new FormData();
      form.append('file', blob.type ? blob : new Blob([blob], { type: file.type }), file.name);
      Object.entries(fields).forEach(([name, value]) => form.append(name, value));
      options.onUploadProgress?.({ bytesSent: 0, totalBytes: blob.size, ratio: 0, stage: 'uploading' });
      const payload = await this.request<T>(path, {
        ...options,
        method: 'POST',
        body: form,
      });
      options.onUploadProgress?.({ bytesSent: blob.size, totalBytes: blob.size, ratio: 1, stage: 'registering' });
      return payload;
    }

    let source: ExpoFile;
    try {
      source = new ExpoFile(file.uri);
      if (!source.exists) {
        throw new Error('The local file no longer exists.');
      }
      if ((source.size ?? 0) <= 0) {
        throw new SaanjhApiError('The saved audio sample is empty. Record or import it again.', { code: 'empty-file' });
      }
    } catch (error) {
      if (error instanceof SaanjhApiError) throw error;
      throw new SaanjhApiError('Saanjh could not read the saved sample on this phone. Record or import it again.', {
        code: 'local-file-unreadable',
        details: { uriScheme: file.uri.split(':', 1)[0] || 'unknown' },
        cause: error,
      });
    }

    const url = joinUrl(this.baseUrl, path);
    const method = 'POST';
    const controller = new AbortController();
    const relayAbort = () => controller.abort();
    if (options.signal?.aborted) controller.abort();
    else options.signal?.addEventListener('abort', relayAbort, { once: true });
    const timeoutMs = options.timeoutMs ?? DEFAULT_VOICE_TIMEOUT_MS;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const knownSize = source.size ?? 0;
    options.onUploadProgress?.({ bytesSent: 0, totalBytes: knownSize, ratio: knownSize ? 0 : null, stage: 'reading' });

    try {
      const result = await source.upload(url, {
        httpMethod: method,
        uploadType: UploadType.MULTIPART,
        fieldName: 'file',
        mimeType: file.type,
        parameters: fields,
        sessionType: 'foreground',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
        },
        onProgress: ({ bytesSent, totalBytes }) => {
          const ratio = uploadRatio(bytesSent, totalBytes);
          options.onUploadProgress?.({
            bytesSent,
            totalBytes,
            ratio,
            stage: ratio !== null && ratio >= 1 ? 'registering' : 'uploading',
          });
        },
      });
      const payload = parsePayload(result.body);
      if (result.status < 200 || result.status >= 300) {
        const description = describeError(payload, result.status);
        throw new SaanjhApiError(description.message, {
          status: result.status,
          code: description.code,
          service: description.service,
          upstreamStatus: description.upstreamStatus,
          validationIssues: description.validationIssues,
          details: payload,
          method,
          url,
        });
      }
      options.onUploadProgress?.({
        bytesSent: knownSize,
        totalBytes: knownSize,
        ratio: knownSize ? 1 : null,
        stage: 'registering',
      });
      return payload as T;
    } catch (error) {
      if (error instanceof SaanjhApiError) throw error;
      if (timedOut) {
        throw new SaanjhApiError(`The sample upload or Voicebox registration did not finish within ${Math.round(timeoutMs / 1000)} seconds.`, {
          code: 'upload-timeout',
          method,
          url,
          cause: error,
        });
      }
      if (options.signal?.aborted || controller.signal.aborted) {
        throw new SaanjhApiError('The sample upload was cancelled.', {
          code: 'aborted',
          method,
          url,
          cause: error,
        });
      }
      throw new SaanjhApiError(
        'This phone could not upload the sample to Saanjh. The service check can still appear online because it does not transfer a file. Check the public HTTPS server and try again.',
        {
          code: 'upload-network-error',
          method,
          url,
          details: { uriScheme: file.uri.split(':', 1)[0] || 'unknown' },
          cause: error,
        },
      );
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', relayAbort);
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

  localChat(input: LocalChatRequest, options?: ApiRequestOptions): Promise<LocalChatResponse> {
    return this.request('/api/v1/local/chat', {
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
    options?: FileUploadOptions,
  ): Promise<unknown> {
    return this.uploadMultipart(
      `/api/voicebox/profiles/${encodeURIComponent(profileId)}/samples`,
      file,
      { reference_text: referenceText },
      { ...options, timeoutMs: options?.timeoutMs ?? DEFAULT_VOICE_TIMEOUT_MS },
    );
  }

  async createVoiceboxProfileWithSample(
    input: VoiceboxProfileCreate,
    file: ReactNativeFile,
    referenceText: string,
    options?: FileUploadOptions,
  ): Promise<VoiceboxProfile> {
    const fields: Record<string, string> = {
      name: input.name,
      language: input.language ?? 'en',
      voice_type: input.voice_type ?? 'cloned',
      reference_text: referenceText,
    };
    if (input.description?.trim()) fields.description = input.description.trim();
    if (input.default_engine?.trim()) fields.default_engine = input.default_engine.trim();
    const payload = await this.uploadMultipart<unknown>(
      '/api/voicebox/profiles/with-sample',
      file,
      fields,
      { ...options, timeoutMs: options?.timeoutMs ?? DEFAULT_VOICE_TIMEOUT_MS },
    );
    const profile = unwrapObject(payload, ['profile', 'data']);
    if (!profile || !voiceboxProfileId(profile)) {
      throw new SaanjhApiError('Voicebox registered the sample but returned an invalid profile.', {
        status: 502,
        code: 'invalid-voicebox-response',
        service: 'Voicebox',
        details: payload,
      });
    }
    return profile as VoiceboxProfile;
  }

  async transcribe(
    file: ReactNativeFile,
    input: TranscriptionOptions = {},
    options?: FileUploadOptions,
  ): Promise<string> {
    const fields: Record<string, string> = {};
    if (input.language?.trim()) fields.language = input.language.trim();
    if (input.model?.trim()) fields.model = input.model.trim();
    const payload = await this.uploadMultipart<unknown>(
      '/api/voicebox/transcribe',
      file,
      fields,
      { ...options, timeoutMs: options?.timeoutMs ?? DEFAULT_VOICE_TIMEOUT_MS },
    );
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
    const { maxWaitMs = DEFAULT_VOICE_TIMEOUT_MS, pollIntervalMs = 1_000, onProgress, ...requestOptions } = options;
    let pollCount = 0;
    while (Date.now() - startedAt < maxWaitMs) {
      const generation = await this.getVoiceGeneration(id, requestOptions);
      const status = generation.status?.toLowerCase();
      pollCount += 1;
      onProgress?.({ generation, status: status || 'processing', elapsedMs: Date.now() - startedAt, pollCount });
      if (status === 'completed' || generation.audio_url) return generation;
      if (status === 'failed' || status === 'error' || status === 'cancelled') {
        throw new SaanjhApiError(generation.error ?? generation.detail ?? 'Voicebox could not generate this audio.', {
          status: 502,
          code: 'generation-failed',
          service: 'Voicebox',
          details: generation,
        });
      }
      await delay(pollIntervalMs, requestOptions.signal);
    }
    throw new SaanjhApiError('Voicebox did not finish generating audio in time.', {
      code: 'generation-timeout',
      service: 'Voicebox',
      details: { generationId: id, maxWaitMs },
    });
  }

  cancelVoiceGeneration(generationId: string, options?: ApiRequestOptions): Promise<unknown> {
    return this.request(`/api/voicebox/generate/${encodeURIComponent(generationId)}/cancel`, {
      ...options,
      method: 'POST',
    });
  }

  voiceAudioUrl(generationId: string): string {
    return mediaUrl(`/api/voicebox/audio/${encodeURIComponent(generationId)}`, this.baseUrl) as string;
  }


  voiceAudioBytes(generationId: string, options?: ApiRequestOptions): Promise<Uint8Array> {
    return this.requestBytes(`/api/voicebox/audio/${encodeURIComponent(generationId)}`, options);
  }
}

export const saanjhApi = new SaanjhApiClient();
export const api = saanjhApi;

export function configureSaanjhApi(options: { baseUrl?: string; accessToken?: string }): void {
  saanjhApi.configure(options);
}

export function displaySaanjhError(error: unknown): string {
  if (error instanceof SaanjhApiError) {
    if (error.code === 'sample_too_short' || /longer than\s*5\s*seconds|sample is too short|at least 6 seconds/i.test(error.message)) {
      return 'Record or import at least 6 seconds of clear speech, then clone again.';
    }
    if (error.code === 'authentication_required' || error.status === 401) {
      return 'Saanjh could not connect securely. Please update the app and try again.';
    }
    if (error.code === 'network-error' || error.code === 'upload-network-error' || error.code === 'unreachable') {
      return 'Saanjh could not connect. Check your internet connection and try again.';
    }
    if (error.code === 'timeout' || error.code === 'upload-timeout' || error.code === 'generation-timeout') {
      return 'This is taking longer than expected. Please try once more.';
    }
    if (error.service?.toLowerCase() === 'voicebox' || /voicebox/i.test(error.message)) {
      return 'The AI voice is temporarily unavailable. Your written reply and local data are safe.';
    }
    if (error.service?.toLowerCase() === 'groq' || /groq/i.test(error.message)) {
      return 'Saanjh could not prepare a reply just now. Please try again shortly.';
    }
    return error.message
      .replace(/the Saanjh backend/gi, 'Saanjh')
      .replace(/backend/gi, 'service')
      .replace(/public API address/gi, 'connection');
  }
  if (error instanceof Error && error.message) return error.message;
  return 'The request could not be completed.';
}
