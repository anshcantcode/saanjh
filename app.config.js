const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim() || '';
const privateApiToken = process.env.SAANJH_API_ACCESS_TOKEN?.trim() || '';
const easProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim() || '';
const allowCleartext = process.env.EXPO_PUBLIC_ALLOW_CLEARTEXT === 'true';

module.exports = ({ config }) => {
  const extra = { ...(config.extra ?? {}) };

  if (easProjectId) {
    extra.eas = { ...(config.extra?.eas ?? {}), projectId: easProjectId };
  }

  // A compiled URL is optional. Android can securely save a public backend
  // URL at runtime, so builds never fall back to a dead tunnel or local IP.
  if (apiUrl) extra.apiUrl = apiUrl;
  // Private demo builds may opt into a bootstrap credential through an ignored
  // local .env or EAS secret. Never commit it: compiled app values are readable.
  if (privateApiToken) extra.privateApiToken = privateApiToken;

  return {
    ...config,
    android: {
      ...config.android,
      package: 'com.saanjh.companion',
      versionCode: 11,
      permissions: ['CAMERA', 'RECORD_AUDIO', 'READ_MEDIA_IMAGES'],
    },
    extra,
    plugins: [
      ...(config.plugins ?? []).map((plugin) => {
        if (!Array.isArray(plugin) || plugin[0] !== 'expo-build-properties') return plugin;
        return [plugin[0], {
          ...(plugin[1] ?? {}),
          android: { ...(plugin[1]?.android ?? {}), usesCleartextTraffic: allowCleartext },
        }];
      }),
      'expo-secure-store',
    ],
  };
};
