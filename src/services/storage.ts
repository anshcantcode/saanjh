import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  APP_DATA_VERSION,
  createEmptyAppData,
} from '../types';
import type { AppData, AppSettings } from '../types';

export const APP_STORAGE_KEY = '@saanjh/app-data/v1';

export type StorageErrorCode = 'read' | 'write' | 'clear' | 'invalid-data' | 'unsupported-version';

export class AppStorageError extends Error {
  readonly code: StorageErrorCode;
  readonly cause?: unknown;

  constructor(message: string, code: StorageErrorCode, cause?: unknown) {
    super(message);
    this.name = 'AppStorageError';
    this.code = code;
    this.cause = cause;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeSettings(value: unknown): AppSettings {
  const empty = createEmptyAppData().settings;
  if (!isObject(value)) return empty;
  return {
    allowTranscripts:
      typeof value.allowTranscripts === 'boolean' ? value.allowTranscripts : empty.allowTranscripts,
    reducedMotion: typeof value.reducedMotion === 'boolean' ? value.reducedMotion : empty.reducedMotion,
  };
}

function decodeAppData(value: unknown): AppData {
  if (!isObject(value)) {
    throw new AppStorageError('Saved app data is not a JSON object.', 'invalid-data');
  }
  if (value.version !== APP_DATA_VERSION) {
    throw new AppStorageError(
      `Saved app data version ${String(value.version)} is not supported.`,
      'unsupported-version',
    );
  }
  if (!Array.isArray(value.moods) || !Array.isArray(value.journal) || !Array.isArray(value.sessions)) {
    throw new AppStorageError('Saved app data is missing one or more entry collections.', 'invalid-data');
  }

  return {
    version: APP_DATA_VERSION,
    hasSeenWelcome: value.hasSeenWelcome === true,
    companion: isObject(value.companion) ? (value.companion as unknown as AppData['companion']) : undefined,
    moods: value.moods as AppData['moods'],
    journal: value.journal as AppData['journal'],
    sessions: value.sessions as AppData['sessions'],
    pendingVoiceboxProfileIds: Array.isArray(value.pendingVoiceboxProfileIds)
      ? value.pendingVoiceboxProfileIds.filter((item): item is string => typeof item === 'string')
      : [],
    settings: normalizeSettings(value.settings),
  };
}

export async function loadAppData(): Promise<AppData> {
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(APP_STORAGE_KEY);
  } catch (error) {
    throw new AppStorageError('Could not read local Saanjh data.', 'read', error);
  }

  if (raw === null) return createEmptyAppData();
  try {
    return decodeAppData(JSON.parse(raw) as unknown);
  } catch (error) {
    if (error instanceof AppStorageError) throw error;
    throw new AppStorageError('Saved Saanjh data is not valid JSON.', 'invalid-data', error);
  }
}

let writeQueue: Promise<void> = Promise.resolve();

function serializeWrite<T>(operation: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(operation, operation);
  writeQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function writeAppData(data: AppData): Promise<AppData> {
  const normalized = decodeAppData({ ...data, version: APP_DATA_VERSION });
  try {
    await AsyncStorage.setItem(APP_STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  } catch (error) {
    throw new AppStorageError('Could not save local Saanjh data.', 'write', error);
  }
}

export function saveAppData(data: AppData): Promise<AppData> {
  return serializeWrite(() => writeAppData(data));
}

export function updateAppData(
  update: (current: AppData) => AppData | Promise<AppData>,
): Promise<AppData> {
  return serializeWrite(async () => {
    const current = await loadAppData();
    const next = await update(current);
    return writeAppData(next);
  });
}

export function clearAppData(): Promise<void> {
  return serializeWrite(async () => {
    try {
      await AsyncStorage.removeItem(APP_STORAGE_KEY);
    } catch (error) {
      throw new AppStorageError('Could not clear local Saanjh data.', 'clear', error);
    }
  });
}

export function resetAppData(): Promise<AppData> {
  return serializeWrite(() => writeAppData(createEmptyAppData()));
}

export const appStorage = {
  load: loadAppData,
  save: saveAppData,
  update: updateAppData,
  clear: clearAppData,
  reset: resetAppData,
};
