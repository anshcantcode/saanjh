import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import {
  AudioLines,
  Check,
  Download,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react-native';

import { colors as C, font, radii, softShadow } from '../theme';

export type VoiceGenerationStage =
  | 'transcribing'
  | 'thinking'
  | 'preparing_voice'
  | 'downloading'
  | 'playing'
  | 'complete'
  | 'error';

export type VoiceGenerationStatusProps = {
  stage: VoiceGenerationStage;
  /** Supply either a live elapsed value or `startedAt`; no estimate is invented. */
  elapsedMs?: number;
  startedAt?: number;
  headline?: string;
  /** Friendly detail sourced from real backend/app state. */
  detail?: string;
  /** Only show this when the backend reports a real queue position. */
  queuePosition?: number;
  onCancel?: () => void;
  cancelDisabled?: boolean;
  reducedMotion?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

type ActiveStage = Exclude<VoiceGenerationStage, 'complete' | 'error'>;

const STAGES: Array<{
  id: ActiveStage;
  shortLabel: string;
  title: string;
  body: string;
  Icon: typeof Sparkles;
}> = [
  {
    id: 'transcribing',
    shortLabel: 'Listen',
    title: 'Listening to your words',
    body: 'Your recording is being transcribed privately.',
    Icon: AudioLines,
  },
  {
    id: 'thinking',
    shortLabel: 'Think',
    title: 'Thinking with care',
    body: 'Saanjh is composing a thoughtful reply.',
    Icon: Sparkles,
  },
  {
    id: 'preparing_voice',
    shortLabel: 'Voice',
    title: 'Preparing the familiar voice',
    body: 'The familiar AI voice is being created. This is usually the longest step.',
    Icon: AudioLines,
  },
  {
    id: 'downloading',
    shortLabel: 'Save',
    title: 'Bringing the voice to your phone',
    body: 'The finished audio is being saved locally for playback.',
    Icon: Download,
  },
  {
    id: 'playing',
    shortLabel: 'Play',
    title: 'Playing your response',
    body: 'The voice is ready and playing on this device.',
    Icon: Volume2,
  },
];

const formatElapsed = (milliseconds: number) => {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  if (seconds < 60) return `${seconds}s elapsed`;
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s elapsed`;
};

/**
 * Honest, stage-based progress for the reply-to-audio pipeline.
 *
 * It deliberately avoids a synthetic percentage or countdown. The only time
 * displayed is measured elapsed time; queue position is rendered only when a
 * real value is supplied by the backend.
 */
export function VoiceGenerationStatus({
  stage,
  elapsedMs,
  startedAt,
  headline,
  detail,
  queuePosition,
  onCancel,
  cancelDisabled = false,
  reducedMotion = false,
  style,
  testID,
}: VoiceGenerationStatusProps) {
  const mountedAt = useRef(startedAt ?? Date.now()).current;
  const shimmer = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const [measuredElapsed, setMeasuredElapsed] = useState(() =>
    elapsedMs ?? Math.max(0, Date.now() - mountedAt),
  );
  const isTerminal = stage === 'complete' || stage === 'error';

  useEffect(() => {
    if (elapsedMs !== undefined) {
      setMeasuredElapsed(Math.max(0, elapsedMs));
      return;
    }
    if (isTerminal) return;

    const update = () => setMeasuredElapsed(Math.max(0, Date.now() - mountedAt));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [elapsedMs, isTerminal, mountedAt]);

  useEffect(() => {
    shimmer.stopAnimation();
    pulse.stopAnimation();
    if (isTerminal || reducedMotion) {
      shimmer.setValue(0.5);
      pulse.setValue(0.45);
      return;
    }

    const shimmerAnimation = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1250,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    );
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    shimmerAnimation.start();
    pulseAnimation.start();
    return () => {
      shimmerAnimation.stop();
      pulseAnimation.stop();
    };
  }, [isTerminal, pulse, reducedMotion, shimmer, stage]);

  const activeIndex = useMemo(
    () => (stage === 'complete' ? STAGES.length : stage === 'error' ? -1 : STAGES.findIndex((item) => item.id === stage)),
    [stage],
  );
  const activeStage = activeIndex >= 0 && activeIndex < STAGES.length ? STAGES[activeIndex] : null;
  const ActiveIcon = activeStage?.Icon ?? (stage === 'complete' ? Check : X);
  const resolvedHeadline = headline
    ?? (stage === 'complete' ? 'Your response is ready' : stage === 'error' ? 'The voice could not be prepared' : activeStage?.title)
    ?? 'Preparing your response';
  const resolvedDetail = detail
    ?? (stage === 'complete'
      ? 'The audio is ready on this device.'
      : stage === 'error'
        ? 'Nothing was lost. You can try generating the voice again.'
        : activeStage?.body);
  const stageText = stage === 'complete'
    ? 'All stages complete'
    : stage === 'error'
      ? 'Voice generation stopped'
      : `Stage ${activeIndex + 1} of ${STAGES.length}`;

  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="progressbar"
      accessibilityValue={{ text: `${resolvedHeadline}. ${formatElapsed(measuredElapsed)}` }}
      style={[styles.card, stage === 'error' && styles.cardError, style]}
      testID={testID}
    >
      <View style={styles.header}>
        <Animated.View
          style={[
            styles.activeIcon,
            stage === 'complete' && styles.activeIconComplete,
            stage === 'error' && styles.activeIconError,
            {
              transform: [
                {
                  scale: pulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.07],
                  }),
                },
              ],
            },
          ]}
        >
          <ActiveIcon
            color={stage === 'error' ? C.danger : stage === 'complete' ? C.success : C.plum700}
            size={22}
            strokeWidth={1.8}
          />
        </Animated.View>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>AI VOICE RESPONSE</Text>
          <Text style={styles.headline}>{resolvedHeadline}</Text>
        </View>
        {onCancel && !isTerminal ? (
          <Pressable
            accessibilityLabel="Cancel voice response"
            accessibilityRole="button"
            accessibilityState={{ disabled: cancelDisabled }}
            android_ripple={{ color: 'rgba(79,104,79,.12)', borderless: true }}
            disabled={cancelDisabled}
            hitSlop={10}
            onPress={onCancel}
            style={({ pressed }) => [styles.cancelIcon, pressed && styles.pressed, cancelDisabled && styles.cancelDisabled]}
          >
            <X color={C.textSecondary} size={18} />
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.detail}>{resolvedDetail}</Text>
      {typeof queuePosition === 'number' && queuePosition >= 0 && !isTerminal ? (
        <View style={styles.queuePill}>
          <Text style={styles.queueText}>
            {queuePosition === 0 ? 'Your voice request is next' : `${queuePosition} request${queuePosition === 1 ? '' : 's'} ahead`}
          </Text>
        </View>
      ) : null}

      <View style={styles.stageGrid}>
        {STAGES.map(({ id, shortLabel, Icon }, index) => {
          const completed = stage === 'complete' || index < activeIndex;
          const current = !isTerminal && index === activeIndex;
          return (
            <View key={id} style={styles.stageCell}>
              <View style={[styles.stageIcon, completed && styles.stageIconComplete, current && styles.stageIconCurrent]}>
                {completed ? (
                  <Check color={C.inverse} size={13} strokeWidth={2.6} />
                ) : (
                  <Icon color={current ? C.plum700 : C.sage} size={13} strokeWidth={1.8} />
                )}
              </View>
              <Text style={[styles.stageLabel, completed && styles.stageLabelComplete, current && styles.stageLabelCurrent]}>
                {shortLabel}
              </Text>
              <View style={[styles.segment, completed && styles.segmentComplete, current && styles.segmentCurrent]}>
                {current ? (
                  <Animated.View
                    style={[
                      styles.shimmer,
                      {
                        transform: [
                          {
                            translateX: shimmer.interpolate({
                              inputRange: [0, 1],
                              outputRange: [-62, 105],
                            }),
                          },
                        ],
                      },
                    ]}
                  />
                ) : null}
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.stageText}>{stageText}</Text>
        <Text style={styles.elapsed}>{formatElapsed(measuredElapsed)}</Text>
      </View>

      {onCancel && !isTerminal ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: cancelDisabled }}
          disabled={cancelDisabled}
          onPress={onCancel}
          style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed, cancelDisabled && styles.cancelDisabled]}
        >
          <Text style={styles.cancelText}>Cancel response</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: 'rgba(243,238,229,.97)',
    padding: 16,
    ...softShadow,
  },
  cardError: {
    borderColor: 'rgba(162,79,69,.22)',
    backgroundColor: 'rgba(238,221,207,.92)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  activeIcon: {
    width: 45,
    height: 45,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.lavender100,
    borderWidth: 1,
    borderColor: 'rgba(79,104,79,.20)',
  },
  activeIconComplete: {
    backgroundColor: 'rgba(77,112,88,.12)',
  },
  activeIconError: {
    backgroundColor: 'rgba(162,79,69,.10)',
    borderColor: 'rgba(162,79,69,.20)',
  },
  headingCopy: {
    flex: 1,
  },
  eyebrow: {
    fontFamily: font.bold,
    fontSize: 8,
    letterSpacing: 1.25,
    color: C.plum500,
    marginBottom: 3,
  },
  headline: {
    fontFamily: font.displayMedium,
    fontSize: 20,
    lineHeight: 24,
    color: C.text,
  },
  cancelIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: 'rgba(247,241,231,.72)',
  },
  detail: {
    marginTop: 11,
    fontFamily: font.body,
    fontSize: 11,
    lineHeight: 17,
    color: C.textSecondary,
  },
  queuePill: {
    alignSelf: 'flex-start',
    marginTop: 9,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: C.lavender100,
    borderWidth: 1,
    borderColor: 'rgba(79,104,79,.16)',
  },
  queueText: {
    fontFamily: font.semibold,
    fontSize: 9,
    color: C.plum700,
  },
  stageGrid: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 16,
  },
  stageCell: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
  },
  stageIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(226,229,217,.52)',
    borderWidth: 1,
    borderColor: C.line,
  },
  stageIconComplete: {
    backgroundColor: C.plum500,
    borderColor: C.plum500,
  },
  stageIconCurrent: {
    backgroundColor: C.lavender100,
    borderColor: C.sage,
  },
  stageLabel: {
    marginTop: 5,
    marginBottom: 6,
    fontFamily: font.medium,
    fontSize: 8,
    color: C.sage,
  },
  stageLabelComplete: {
    color: C.plum500,
  },
  stageLabelCurrent: {
    color: C.plum700,
    fontFamily: font.semibold,
  },
  segment: {
    width: '100%',
    height: 5,
    overflow: 'hidden',
    borderRadius: 3,
    backgroundColor: 'rgba(124,143,120,.16)',
  },
  segmentComplete: {
    backgroundColor: C.plum500,
  },
  segmentCurrent: {
    backgroundColor: 'rgba(79,104,79,.23)',
  },
  shimmer: {
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: C.gold,
  },
  metaRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  stageText: {
    flexShrink: 1,
    fontFamily: font.medium,
    fontSize: 9,
    color: C.textSecondary,
  },
  elapsed: {
    fontFamily: font.semibold,
    fontSize: 9,
    color: C.plum700,
    fontVariant: ['tabular-nums'],
  },
  cancelButton: {
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 13,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: 'rgba(247,241,231,.74)',
  },
  cancelText: {
    fontFamily: font.semibold,
    fontSize: 10,
    color: C.textSecondary,
  },
  cancelDisabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.72,
  },
});
