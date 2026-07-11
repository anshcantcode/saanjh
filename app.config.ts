import type { ConfigContext, ExpoConfig } from 'expo/config';

const ANDROID_PACKAGE = 'com.saanjh.companion';

export default ({ config }: ConfigContext): ExpoConfig => {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim() ?? '';
  const allowCleartext = /^http:\/\//i.test(apiUrl);
  const inheritedPlugins = (config.plugins ?? []).filter((plugin) => {
    const name = Array.isArray(plugin) ? plugin[0] : plugin;
    return name !== 'expo-build-properties';
  });

  return {
    ...config,
    name: 'Saanjh',
    slug: 'saanjh',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/botanical-emblem.png',
    scheme: 'saanjh',
    userInterfaceStyle: 'automatic',
    android: {
      ...config.android,
      package: ANDROID_PACKAGE,
      versionCode: 1,
      adaptiveIcon: {
        foregroundImage: './assets/botanical-emblem.png',
        backgroundColor: '#F3EEE5',
      },
    },
    plugins: [
      ...inheritedPlugins,
      ['expo-build-properties', { android: { usesCleartextTraffic: allowCleartext } }],
    ],
  };
};
