import React from 'react';
import {
  ImageBackground,
  type ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight } from 'lucide-react-native';

import { colors as C, font, radii, softShadow } from '../theme';

type BotanicalActionCardProps = {
  accessibilityLabel: string;
  art: ImageSourcePropType;
  icon: React.ReactNode;
  onPress: () => void;
  subtitle: string;
  title: string;
  tone?: 'sage' | 'clay';
};

/**
 * Compact art-backed action card for the Today screen.
 *
 * Android renders translucent elevated Pressables through an off-screen layer.
 * When that Pressable also has padding, some GPU/driver combinations expose the
 * layer's pale rectangular backing inside the rounded card. Keeping the opaque
 * shadow shell separate from the clipped artwork avoids that rendering path.
 */
export function BotanicalActionCard({
  accessibilityLabel,
  art,
  icon,
  onPress,
  subtitle,
  title,
  tone = 'sage',
}: BotanicalActionCardProps) {
  const gradient = tone === 'clay'
    ? (['rgba(247,241,231,.94)', 'rgba(238,221,207,.76)', 'rgba(180,123,90,.30)'] as const)
    : (['rgba(247,241,231,.94)', 'rgba(226,229,217,.76)', 'rgba(79,104,79,.24)'] as const);

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      android_ripple={{ color: 'rgba(79,104,79,.12)', borderless: false }}
      onPress={onPress}
      style={({ pressed }) => [styles.shadowShell, pressed && styles.pressed]}
    >
      <View style={styles.clip}>
        <ImageBackground
          imageStyle={styles.artImage}
          resizeMode="cover"
          source={art}
          style={styles.art}
        >
          <LinearGradient
            colors={gradient}
            end={{ x: 1, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <View pointerEvents="none" style={[styles.botanicalRing, tone === 'clay' && styles.botanicalRingClay]} />
          <View style={styles.content}>
            <View style={[styles.iconHalo, tone === 'clay' && styles.iconHaloClay]}>{icon}</View>
            <View style={styles.copy}>
              <Text style={styles.title}>{title}</Text>
              <Text numberOfLines={2} style={styles.subtitle}>{subtitle}</Text>
            </View>
            <ChevronRight color={C.textSecondary} size={18} style={styles.chevron} />
          </View>
        </ImageBackground>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shadowShell: {
    flex: 1,
    minWidth: 0,
    minHeight: 150,
    borderRadius: radii.lg,
    backgroundColor: C.ivory,
    ...softShadow,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.982 }],
  },
  clip: {
    flex: 1,
    minHeight: 150,
    overflow: 'hidden',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.ivory,
  },
  art: {
    flex: 1,
    minHeight: 148,
  },
  artImage: {
    borderRadius: radii.lg,
  },
  botanicalRing: {
    position: 'absolute',
    width: 102,
    height: 102,
    right: -34,
    top: -28,
    borderRadius: 51,
    borderWidth: 1,
    borderColor: 'rgba(79,104,79,.23)',
  },
  botanicalRingClay: {
    borderColor: 'rgba(163,103,73,.22)',
  },
  content: {
    flex: 1,
    minHeight: 148,
    padding: 15,
  },
  iconHalo: {
    width: 43,
    height: 43,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(47,74,59,.12)',
    backgroundColor: 'rgba(226,229,217,.88)',
  },
  iconHaloClay: {
    borderColor: 'rgba(163,103,73,.13)',
    backgroundColor: 'rgba(238,221,207,.90)',
  },
  copy: {
    marginTop: 'auto',
    paddingRight: 14,
  },
  title: {
    fontFamily: font.displayMedium,
    fontSize: 17,
    color: C.text,
  },
  subtitle: {
    marginTop: 3,
    fontFamily: font.body,
    fontSize: 11,
    lineHeight: 16,
    color: C.textSecondary,
  },
  chevron: {
    position: 'absolute',
    right: 12,
    bottom: 14,
  },
});
