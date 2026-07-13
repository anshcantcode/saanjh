import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  ImageBackground,
  type ImageSourcePropType,
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { colors as C, font, radii, softShadow } from '../theme';

const RECORD_ART = require('../../web/public/assets/consent-botanical.webp');
const IMPORT_ART = require('../../web/public/assets/home-forest-path.webp');

export type BotanicalSampleActionCardVariant = 'record' | 'import';

export type BotanicalSampleActionCardProps = {
  /** Selects the bundled artwork and subtle colour treatment. */
  variant: BotanicalSampleActionCardVariant;
  title: string;
  subtitle?: string;
  eyebrow?: string;
  icon: React.ReactNode;
  onPress: () => void;
  /** Override the bundled art without changing the card layout. */
  imageSource?: ImageSourcePropType;
  active?: boolean;
  disabled?: boolean;
  reducedMotion?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Art-backed sample action used by the companion voice setup flow.
 *
 * The shadow and clipped image live on separate layers so Android can render
 * both reliably. In a two-card row, give the parent `flexWrap: 'wrap'` and a
 * 12px gap; each card can then fall to its own row on very narrow screens.
 */
export function BotanicalSampleActionCard({
  variant,
  title,
  subtitle,
  eyebrow,
  icon,
  onPress,
  imageSource,
  active = false,
  disabled = false,
  reducedMotion = false,
  accessibilityLabel,
  accessibilityHint,
  style,
  testID,
}: BotanicalSampleActionCardProps) {
  const pressScale = useRef(new Animated.Value(1)).current;
  const activePulse = useRef(new Animated.Value(0)).current;
  const source = useMemo(
    () => imageSource ?? (variant === 'record' ? RECORD_ART : IMPORT_ART),
    [imageSource, variant],
  );

  useEffect(() => {
    activePulse.stopAnimation();
    if (!active) {
      activePulse.setValue(0);
      return;
    }
    if (reducedMotion) {
      activePulse.setValue(0.55);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(activePulse, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(activePulse, {
          toValue: 0.15,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [active, activePulse, reducedMotion]);

  const animatePress = (toValue: number) => {
    if (disabled || reducedMotion) return;
    Animated.spring(pressScale, {
      toValue,
      damping: 18,
      stiffness: 280,
      mass: 0.55,
      useNativeDriver: true,
    }).start();
  };

  const isDark = active;
  const gradient = isDark
    ? (['rgba(23,56,50,.83)', 'rgba(12,41,39,.95)'] as const)
    : variant === 'record'
      ? (['rgba(247,241,231,.60)', 'rgba(243,238,229,.94)'] as const)
      : (['rgba(247,241,231,.76)', 'rgba(226,229,217,.94)'] as const);

  return (
    <Animated.View
      style={[
        styles.shadowShell,
        active && styles.shadowShellActive,
        disabled && styles.disabled,
        { transform: [{ scale: pressScale }] },
        style,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled, busy: active }}
        android_ripple={{ color: 'rgba(79,104,79,.14)', borderless: false }}
        disabled={disabled}
        onPress={onPress}
        onPressIn={() => animatePress(0.975)}
        onPressOut={() => animatePress(1)}
        style={styles.clip}
        testID={testID}
      >
        <ImageBackground
          imageStyle={styles.image}
          resizeMode="cover"
          source={source}
          style={styles.imageBackground}
        >
          <LinearGradient colors={gradient} style={StyleSheet.absoluteFill} />
          <View pointerEvents="none" style={styles.topographicLine} />
          {active ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.activeAura,
                {
                  opacity: activePulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.25, 0.7],
                  }),
                  transform: [
                    {
                      scale: activePulse.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.92, 1.14],
                      }),
                    },
                  ],
                },
              ]}
            />
          ) : null}

          <View style={styles.content}>
            {eyebrow ? (
              <Text style={[styles.eyebrow, isDark && styles.inverseMuted]}>{eyebrow}</Text>
            ) : null}
            <View style={[styles.iconHalo, isDark && styles.iconHaloActive]}>{icon}</View>
            <View style={styles.copy}>
              <Text numberOfLines={2} style={[styles.title, isDark && styles.inverse]}>
                {title}
              </Text>
              {subtitle ? (
                <Text numberOfLines={2} style={[styles.subtitle, isDark && styles.inverseMuted]}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
          </View>
        </ImageBackground>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shadowShell: {
    flexBasis: 146,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 132,
    minHeight: 144,
    borderRadius: radii.lg,
    backgroundColor: C.ivory,
    ...softShadow,
  },
  shadowShellActive: {
    shadowColor: C.night950,
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 6,
  },
  clip: {
    flex: 1,
    minHeight: 144,
    overflow: 'hidden',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.ivory,
  },
  imageBackground: {
    flex: 1,
    minHeight: 142,
  },
  image: {
    borderRadius: radii.lg,
  },
  disabled: {
    opacity: 0.48,
  },
  topographicLine: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    borderColor: 'rgba(181,151,93,.21)',
    right: -30,
    top: -38,
  },
  activeAura: {
    position: 'absolute',
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 1,
    borderColor: 'rgba(238,221,207,.58)',
    alignSelf: 'center',
    top: 15,
  },
  content: {
    flex: 1,
    minHeight: 142,
    paddingHorizontal: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    position: 'absolute',
    left: 13,
    top: 11,
    fontFamily: font.bold,
    fontSize: 8,
    letterSpacing: 1.2,
    color: C.plum500,
  },
  iconHalo: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(247,241,231,.86)',
    borderWidth: 1,
    borderColor: 'rgba(79,104,79,.20)',
    marginBottom: 10,
  },
  iconHaloActive: {
    backgroundColor: 'rgba(247,241,231,.15)',
    borderColor: 'rgba(247,241,231,.38)',
  },
  copy: {
    alignItems: 'center',
  },
  title: {
    fontFamily: font.semibold,
    fontSize: 13,
    lineHeight: 18,
    color: C.text,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 3,
    fontFamily: font.body,
    fontSize: 9,
    lineHeight: 13,
    color: C.textSecondary,
    textAlign: 'center',
  },
  inverse: {
    color: C.inverse,
  },
  inverseMuted: {
    color: C.inverseSecondary,
  },
});

