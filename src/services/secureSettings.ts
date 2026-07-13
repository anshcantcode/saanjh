import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const API_TOKEN_KEY = 'saanjh.api-access-token.v1';

function getRuntimePrivateApiToken(): string {
  const runtimeExtra = (
    (Constants.expoConfig?.extra as { privateApiToken?: string } | undefined)
    ?? (Constants.manifest2?.extra as { privateApiToken?: string } | undefined)
    ?? (Constants.manifest?.extra as { privateApiToken?: string } | undefined)
  );
  return runtimeExtra?.privateApiToken?.trim() ?? '';
}

export async function loadApiAccessToken(): Promise<string> {
  if (Platform.OS === 'web') return '';
  // Release builds carry a prototype bootstrap credential so pairing is
  // automatic. Prefer it over stale values saved by older manual-pairing builds.
  const bundled = getRuntimePrivateApiToken();
  if (bundled) return bundled;
  const stored = (await SecureStore.getItemAsync(API_TOKEN_KEY))?.trim();
  return stored || '';
}

export async function saveApiAccessToken(value: string): Promise<void> {
  if (Platform.OS === 'web') return;
  const token = value.trim();
  if (token) await SecureStore.setItemAsync(API_TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(API_TOKEN_KEY);
}

export async function clearApiAccessToken(): Promise<void> {
  if (Platform.OS !== 'web') await SecureStore.deleteItemAsync(API_TOKEN_KEY);
}
