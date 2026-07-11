import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

const WEB_MEDIA_LIMIT_BYTES = 10 * 1024 * 1024;

function safeName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned || `media-${Date.now()}`;
}

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('The selected media could not be stored on this device.'));
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('The selected media could not be stored on this device.'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Moves prototype media out of picker/recorder caches before it is referenced by saved app data.
 * Web uses a data URI because expo-file-system intentionally has no web implementation.
 */
export async function persistMediaUri(uri: string, name: string, mimeType: string): Promise<string> {
  if (!uri.trim()) throw new Error('The selected media file is missing.');
  if (uri.startsWith('data:')) return uri;

  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    if (!response.ok) throw new Error('The selected media could not be read in this browser.');
    const blob = await response.blob();
    if (blob.size > WEB_MEDIA_LIMIT_BYTES) {
      throw new Error('For reliable browser storage, use a sample under 10 MB or finish setup in the native app.');
    }
    return blobToDataUri(blob.type ? blob : new Blob([blob], { type: mimeType }));
  }

  const mediaDirectory = new Directory(Paths.document, 'saanjh-media');
  await mediaDirectory.create({ idempotent: true, intermediates: true });
  if (uri.startsWith(mediaDirectory.uri)) return uri;

  const extension = safeName(name).includes('.') ? '' : mimeType.startsWith('image/') ? '.jpg' : '.m4a';
  const destination = new File(mediaDirectory, `${Date.now()}-${safeName(name)}${extension}`);

  try {
    await new File(uri).copy(destination, { overwrite: false });
    return destination.uri;
  } catch (error) {
    if (error instanceof Error && /Missing read permissions|EACCES|PERMISSION_DENIED|permission/i.test(error.message)) {
      try {
        const response = await fetch(uri);
        if (!response.ok) {
          throw new Error(`Unable to read source media URI (${response.status})`);
        }
        const bytes = new Uint8Array(await response.arrayBuffer());
        destination.create();
        destination.write(bytes);
        return destination.uri;
      } catch (fallbackError) {
        throw new Error(`${error.message} and fallback copy failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
      }
    }
    throw error;
  }
}

export function deletePersistedMedia(uri?: string): void {
  if (!uri || Platform.OS === 'web' || uri.startsWith('data:')) return;
  const mediaDirectory = new Directory(Paths.document, 'saanjh-media');
  if (!uri.startsWith(mediaDirectory.uri)) return;
  const file = new File(uri);
  if (file.exists) file.delete();
}
