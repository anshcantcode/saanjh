import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  ImageBackground,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAudioPlayer } from 'expo-audio';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Flame,
  Music2,
  RotateCcw,
  Sparkles,
  Star,
  Volume2,
  VolumeX,
} from 'lucide-react-native';
import Svg, { Circle as SvgCircle, Line as SvgLine } from 'react-native-svg';

import { colors as C, font, radii, shadow, softShadow } from '../theme';
import { DeepRitualGameModal, type DeepRitualGameId } from './DeepRitualGames';

const lanternArt = require('../../assets/games/breathing-lantern-v1.png');
const musicArt = require('../../assets/games/music-garden-v1.png');
const constellationArt = require('../../assets/games/constellation-sky-v1.png');
const fireflyArt = require('../../assets/games/firefly-glade-v1.png');
const floatingLeavesArt = require('../../assets/games/floating-leaves-v2.png');
const sandGardenArt = require('../../assets/games/sand-garden-v2.png');
const colourEveningArt = require('../../assets/games/colour-evening-v2.png');

const lanternInhale = require('../../assets/sounds/lantern-inhale.wav');
const lanternExhale = require('../../assets/sounds/lantern-exhale.wav');
const flowerNote1 = require('../../assets/sounds/flower-note-1.wav');
const flowerNote2 = require('../../assets/sounds/flower-note-2.wav');
const flowerNote3 = require('../../assets/sounds/flower-note-3.wav');
const flowerNote4 = require('../../assets/sounds/flower-note-4.wav');
const flowerNote5 = require('../../assets/sounds/flower-note-5.wav');
const fireflySparkle = require('../../assets/sounds/firefly-sparkle.wav');
const constellationStar = require('../../assets/sounds/constellation-star.wav');
const ritualComplete = require('../../assets/sounds/ritual-complete.wav');

const PROGRESS_KEY = '@saanjh/ritual-progress/v3';

type Ritual = 'home' | 'lantern' | 'music' | 'constellation' | 'fireflies';
type Progress = {
  lantern: number;
  music: number;
  constellation: number;
  fireflies: number;
  floatingLeaves: number;
  sandGarden: number;
  colourEvening: number;
};
const EMPTY_PROGRESS: Progress = {
  lantern: 0,
  music: 0,
  constellation: 0,
  fireflies: 0,
  floatingLeaves: 0,
  sandGarden: 0,
  colourEvening: 0,
};

type SceneProps = {
  reducedMotion: boolean;
  soundOn: boolean;
  onToggleSound: () => void;
  onBack: () => void;
  onComplete: () => void;
};

type AudioPlayer = ReturnType<typeof useAudioPlayer>;
type SoundGate = React.RefObject<boolean>;

const replayGeneration = new WeakMap<AudioPlayer, number>();

function stopPlayer(player: AudioPlayer) {
  replayGeneration.set(player, (replayGeneration.get(player) ?? 0) + 1);
  try {
    player.pause();
  } catch {
    // The owning screen may already be unmounting and releasing its native player.
  }
}

function restartPlayer(player: AudioPlayer, soundOn: SoundGate) {
  if (!soundOn.current) return;
  const generation = (replayGeneration.get(player) ?? 0) + 1;
  replayGeneration.set(player, generation);
  try {
    player.pause();
    void player.seekTo(0).then(() => {
      if (soundOn.current && replayGeneration.get(player) === generation) player.play();
    }).catch(() => undefined);
  } catch {
    // Audio is an enhancement; interaction should still succeed if playback cannot start.
  }
}

function useSoundGate(soundOn: boolean, players: AudioPlayer[]) {
  const soundOnRef = useRef(soundOn);
  soundOnRef.current = soundOn;
  useEffect(() => {
    if (!soundOn) players.forEach(stopPlayer);
  }, [players, soundOn]);
  return soundOnRef;
}

function useTimeoutRegistry() {
  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const clearAll = useCallback(() => {
    timers.current.forEach((timer) => clearTimeout(timer));
    timers.current.clear();
  }, []);
  const schedule = useCallback((callback: () => void, delay: number) => {
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      callback();
    }, delay);
    timers.current.add(timer);
  }, []);
  useEffect(() => clearAll, [clearAll]);
  return { clearAll, schedule };
}

async function haptic(kind: 'soft' | 'select' | 'complete' = 'soft') {
  if (Platform.OS === 'web') return;
  if (kind === 'complete') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  else await Haptics.impactAsync(kind === 'select' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
}

function Header({ title, eyebrow, onBack, soundOn, onToggleSound }: {
  title: string;
  eyebrow: string;
  onBack?: () => void;
  soundOn: boolean;
  onToggleSound: () => void;
}) {
  return <View style={s.header}>
    {onBack ? <Pressable accessibilityRole="button" accessibilityLabel="Back to rituals" hitSlop={4} onPress={onBack} style={s.roundButton}><ArrowLeft size={21} color={C.text} /></Pressable> : null}
    <View style={s.headerCopy}><Text style={s.eyebrow}>{eyebrow}</Text><Text style={s.title}>{title}</Text></View>
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: soundOn }} accessibilityLabel="Ritual sounds" accessibilityHint={soundOn ? 'Turns ritual sounds off' : 'Turns ritual sounds on'} hitSlop={4} onPress={onToggleSound} style={s.roundButton}>{soundOn ? <Volume2 size={20} color={C.text} /> : <VolumeX size={20} color={C.textSecondary} />}</Pressable>
  </View>;
}

function GameCard({ title, body, meta, art, onPress }: { title: string; body: string; meta: string; art: number; onPress: () => void }) {
  return <View style={s.cardShadow}>
    <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityHint={body} onPress={() => { void haptic(); onPress(); }} style={({ pressed }) => [s.cardClip, pressed && s.pressed]}>
      <ImageBackground source={art} style={s.cardImage} imageStyle={s.cardImageRadius} resizeMode="cover">
        <LinearGradient colors={['rgba(7,25,23,.05)', 'rgba(7,25,23,.18)', 'rgba(7,25,23,.94)']} locations={[0, .44, 1]} style={StyleSheet.absoluteFill} />
        <View style={s.cardCopy}>
          <Text style={s.cardMeta}>{meta}</Text>
          <Text style={s.cardTitle}>{title}</Text>
          <View style={s.cardBottom}><Text style={s.cardBody}>{body}</Text><ChevronRight size={21} color={C.peach300} /></View>
        </View>
      </ImageBackground>
    </Pressable>
  </View>;
}

function SceneFrame({ art, children }: { art: number; children: React.ReactNode }) {
  return <View style={s.sceneShadow}><ImageBackground source={art} resizeMode="cover" style={s.scene} imageStyle={s.sceneRadius}>{children}</ImageBackground></View>;
}

function CompletionPill({ complete, label }: { complete: boolean; label: string }) {
  return <View accessible accessibilityLabel={label} accessibilityLiveRegion="polite" style={[s.completionPill, complete && s.completionPillDone]}>{complete ? <Check size={15} color={C.inverse} /> : <Sparkles size={15} color={C.peach300} />}<Text style={[s.completionPillText, complete && s.completionPillTextDone]}>{label}</Text></View>;
}

function BreathingLantern({ reducedMotion, soundOn, onToggleSound, onBack, onComplete }: SceneProps) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [completed, setCompleted] = useState(false);
  const elapsedRef = useRef(0);
  const completedRef = useRef(false);
  const glow = useRef(new Animated.Value(.42)).current;
  const inhalePlayer = useAudioPlayer(lanternInhale);
  const exhalePlayer = useAudioPlayer(lanternExhale);
  const completePlayer = useAudioPlayer(ritualComplete);
  const players = useMemo(() => [inhalePlayer, exhalePlayer, completePlayer], [completePlayer, exhalePlayer, inhalePlayer]);
  const soundEnabled = useSoundGate(soundOn, players);
  const phases = useMemo(() => [{ name: 'Breathe in', seconds: 4 }, { name: 'Rest', seconds: 4 }, { name: 'Breathe out', seconds: 6 }], []);
  const cycleLength = 14;
  const totalSeconds = cycleLength * 3;
  const second = Math.min(totalSeconds, Math.floor(elapsed / 1000));
  const inCycle = second % cycleLength;
  const phaseIndex = inCycle < 4 ? 0 : inCycle < 8 ? 1 : 2;
  const currentPhase = phases[phaseIndex] ?? phases[0]!;
  const phaseStart = phaseIndex === 0 ? 0 : phaseIndex === 1 ? 4 : 8;
  const remaining = Math.max(1, currentPhase.seconds - (inCycle - phaseStart));
  const lastPhase = useRef(-1);

  const finish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    setCompleted(true); setRunning(false); void haptic('complete'); restartPlayer(completePlayer, soundEnabled); onComplete();
  }, [completePlayer, onComplete, soundEnabled]);

  useEffect(() => {
    if (!running) return;
    const startedAt = Date.now() - elapsedRef.current;
    const timer = setInterval(() => {
      const next = Date.now() - startedAt;
      if (next >= totalSeconds * 1000) {
        elapsedRef.current = totalSeconds * 1000;
        setElapsed(totalSeconds * 1000);
        finish();
      } else {
        elapsedRef.current = next;
        setElapsed(next);
      }
    }, 100);
    return () => clearInterval(timer);
  }, [finish, running]);

  useEffect(() => {
    if (!running) {
      glow.stopAnimation();
      return;
    }
    if (lastPhase.current !== phaseIndex) {
      lastPhase.current = phaseIndex;
      void haptic();
      if (phaseIndex === 0) restartPlayer(inhalePlayer, soundEnabled);
      if (phaseIndex === 2) restartPlayer(exhalePlayer, soundEnabled);
    }
    if (reducedMotion) {
      glow.stopAnimation();
      glow.setValue(.58);
      return;
    }
    const phaseElapsed = Math.max(0, (elapsedRef.current % (cycleLength * 1000)) - (phaseStart * 1000));
    const animation = Animated.timing(glow, {
      toValue: phaseIndex === 0 || phaseIndex === 1 ? 1 : .38,
      duration: Math.max(100, (currentPhase.seconds * 1000) - phaseElapsed),
      easing: Easing.inOut(Easing.sin),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [currentPhase.seconds, exhalePlayer, glow, inhalePlayer, phaseIndex, phaseStart, reducedMotion, running, soundEnabled]);

  const reset = () => {
    setRunning(false);
    elapsedRef.current = 0;
    completedRef.current = false;
    setElapsed(0);
    setCompleted(false);
    lastPhase.current = -1;
    glow.stopAnimation();
    glow.setValue(.42);
  };
  return <ScrollView contentContainerStyle={s.page}>
    <Header eyebrow="BREATHING LANTERN" title="Follow the glow." onBack={onBack} soundOn={soundOn} onToggleSound={onToggleSound} />
    <SceneFrame art={lanternArt}>
      <LinearGradient colors={['rgba(4,18,17,.02)', 'rgba(4,18,17,.38)']} style={StyleSheet.absoluteFill} />
      <View style={s.sceneTop}><CompletionPill complete={completed} label={completed ? 'Three rounds complete' : 'Three gentle rounds'} /></View>
      <View pointerEvents="none" style={s.lanternCenter}>
        <Animated.View style={[s.lanternAura, { opacity: glow, transform: [{ scale: glow.interpolate({ inputRange: [.38, 1], outputRange: [.74, 1.25] }) }] }]} />
        <Animated.View style={[s.lanternRing, { transform: [{ scale: glow.interpolate({ inputRange: [.38, 1], outputRange: [.82, 1.34] }) }] }]} />
      </View>
      <View style={s.sceneFooter}><Text accessibilityLiveRegion="polite" style={s.scenePrompt}>{completed ? 'The lantern is steady.' : running ? currentPhase.name : 'Breathe with the lantern'}</Text><Text style={s.sceneCount}>{running ? remaining : '4 · 4 · 6'}</Text><View style={s.track}><View style={[s.trackFill, { width: `${Math.min(100, elapsed / (totalSeconds * 10))}%` }]} /></View></View>
    </SceneFrame>
    <Text style={s.guidance}>The glow expands as you breathe in and softens as you breathe out. Pause whenever your body asks you to.</Text>
    <Pressable accessibilityRole="button" onPress={() => completed ? reset() : setRunning((value) => !value)} style={s.primaryButton}><Flame size={18} color={C.inverse} /><Text style={s.primaryText}>{completed ? 'Light it again' : running ? 'Pause' : elapsed ? 'Continue' : 'Begin'}</Text></Pressable>
  </ScrollView>;
}

const FLOWERS = [
  { left: '8%' as const, top: '53%' as const, label: 'Ding' },
  { left: '27%' as const, top: '45%' as const, label: 'Chime' },
  { left: '46%' as const, top: '50%' as const, label: 'Hum' },
  { left: '65%' as const, top: '45%' as const, label: 'Lull' },
  { left: '83%' as const, top: '53%' as const, label: 'Tinkle' },
];

function MusicGarden({ soundOn, onToggleSound, onBack, onComplete }: SceneProps) {
  const [taps, setTaps] = useState(0);
  const [active, setActive] = useState<number>();
  const tapsRef = useRef(0);
  const completedRef = useRef(false);
  const note1 = useAudioPlayer(flowerNote1); const note2 = useAudioPlayer(flowerNote2); const note3 = useAudioPlayer(flowerNote3); const note4 = useAudioPlayer(flowerNote4); const note5 = useAudioPlayer(flowerNote5);
  const completePlayer = useAudioPlayer(ritualComplete);
  const players = useMemo(() => [note1, note2, note3, note4, note5], [note1, note2, note3, note4, note5]);
  const allPlayers = useMemo(() => [...players, completePlayer], [completePlayer, players]);
  const soundEnabled = useSoundGate(soundOn, allPlayers);
  const { clearAll: clearTimers, schedule } = useTimeoutRegistry();
  const play = (index: number) => {
    restartPlayer(players[index]!, soundEnabled); void haptic(index === 2 ? 'select' : 'soft'); setActive(index);
    clearTimers();
    schedule(() => setActive((value) => value === index ? undefined : value), 520);
    const next = Math.min(12, tapsRef.current + 1);
    tapsRef.current = next;
    setTaps(next);
    if (next === 12 && !completedRef.current) {
      completedRef.current = true;
      void haptic('complete');
      restartPlayer(completePlayer, soundEnabled);
      onComplete();
    }
  };
  const reset = () => {
    clearTimers();
    tapsRef.current = 0;
    setTaps(0);
    setActive(undefined);
    completedRef.current = false;
  };
  return <ScrollView contentContainerStyle={s.page}>
    <Header eyebrow="MUSIC GARDEN" title="Wake the blooms." onBack={onBack} soundOn={soundOn} onToggleSound={onToggleSound} />
    <SceneFrame art={musicArt}>
      <LinearGradient colors={['rgba(4,18,17,.04)', 'rgba(4,18,17,.18)', 'rgba(4,18,17,.42)']} style={StyleSheet.absoluteFill} />
      <View style={s.sceneTop}><CompletionPill complete={taps >= 12} label={taps >= 12 ? 'Your garden is singing' : 'Create a twelve-note moment'} /></View>
      {FLOWERS.map((flower, index) => <Pressable key={flower.label} accessibilityRole="button" accessibilityLabel={`Play ${flower.label} flower`} accessibilityHint="Plays one soft garden note" accessibilityState={{ selected: active === index }} onPress={() => play(index)} style={[s.flowerTarget, { left: flower.left, top: flower.top }, active === index && s.flowerTargetActive]}><View style={[s.flowerPulse, active === index && s.flowerPulseActive]}><Music2 size={17} color={active === index ? C.night950 : C.peach300} /></View><Text style={s.flowerLabel}>{flower.label}</Text></Pressable>)}
      <View style={s.sceneFooter}><Text style={s.scenePrompt}>{taps >= 12 ? 'Let the final chord settle.' : 'Tap blooms · feel the notes'}</Text><View style={s.dotProgress}>{Array.from({ length: 12 }, (_, index) => <View key={index} style={[s.progressDot, index < taps && s.progressDotOn]} />)}</View></View>
    </SceneFrame>
    <Text style={s.guidance}>Each bloom has its own quiet pentatonic note, so every combination remains gentle. There is no wrong melody.</Text>
    {taps >= 12 ? <Pressable accessibilityRole="button" onPress={reset} style={s.secondaryButton}><RotateCcw size={17} color={C.text} /><Text style={s.secondaryText}>Start a new melody</Text></Pressable> : null}
  </ScrollView>;
}

const STARS = [
  { x: 18, y: 49 }, { x: 37, y: 34 }, { x: 51, y: 49 }, { x: 66, y: 29 }, { x: 78, y: 48 }, { x: 62, y: 66 }, { x: 39, y: 68 },
];
const SCENE_ASPECT_RATIO = 1.55;

function ConstellationGame({ soundOn, onToggleSound, onBack, onComplete }: SceneProps) {
  const [connected, setConnected] = useState(0);
  const connectedRef = useRef(0);
  const completedRef = useRef(false);
  const starPlayer = useAudioPlayer(constellationStar);
  const completePlayer = useAudioPlayer(ritualComplete);
  const players = useMemo(() => [starPlayer, completePlayer], [completePlayer, starPlayer]);
  const soundEnabled = useSoundGate(soundOn, players);
  const { clearAll: clearTimers, schedule } = useTimeoutRegistry();
  const choose = (index: number) => {
    if (index !== connectedRef.current) { void haptic(); return; }
    restartPlayer(starPlayer, soundEnabled); void haptic(index % 2 ? 'select' : 'soft');
    const next = connectedRef.current + 1;
    connectedRef.current = next;
    setConnected(next);
    if (next === STARS.length && !completedRef.current) {
      completedRef.current = true;
      schedule(() => restartPlayer(completePlayer, soundEnabled), 230);
      void haptic('complete');
      onComplete();
    }
  };
  const reset = () => {
    clearTimers();
    connectedRef.current = 0;
    setConnected(0);
    completedRef.current = false;
  };
  return <ScrollView contentContainerStyle={s.page}>
    <Header eyebrow="TRACE THE CONSTELLATION" title="Connect the quiet stars." onBack={onBack} soundOn={soundOn} onToggleSound={onToggleSound} />
    <SceneFrame art={constellationArt}>
      <LinearGradient colors={['rgba(4,18,17,.02)', 'rgba(4,18,17,.28)']} style={StyleSheet.absoluteFill} />
      <View style={s.sceneTop}><CompletionPill complete={connected === STARS.length} label={connected === STARS.length ? 'Constellation complete' : `Find star ${connected + 1} of ${STARS.length}`} /></View>
      <Svg pointerEvents="none" viewBox={`0 0 ${SCENE_ASPECT_RATIO * 100} 100`} preserveAspectRatio="xMidYMid meet" style={StyleSheet.absoluteFill}>
        {STARS.slice(1, connected).map((star, index) => { const previous = STARS[index]!; return <SvgLine key={index} x1={previous.x * SCENE_ASPECT_RATIO} y1={previous.y} x2={star.x * SCENE_ASPECT_RATIO} y2={star.y} stroke="rgba(238,198,122,.92)" strokeWidth=".55" />; })}
        {STARS.map((star, index) => <SvgCircle key={index} cx={star.x * SCENE_ASPECT_RATIO} cy={star.y} r={index < connected ? 1.25 : index === connected ? 1.55 : .52} fill={index < connected ? '#F6D68F' : index === connected ? '#FFF4C9' : 'rgba(255,244,201,.32)'} />)}
      </Svg>
      {STARS.map((star, index) => <Pressable key={index} accessible={index === connected} importantForAccessibility={index === connected ? 'yes' : 'no-hide-descendants'} accessibilityRole="button" accessibilityLabel={`Connect star ${index + 1}`} accessibilityHint={`Star ${index + 1} of ${STARS.length}`} hitSlop={2} onPress={() => choose(index)} style={[s.starTarget, { left: `${star.x}%`, top: `${star.y}%` }, index === connected && s.starTargetNext]}>{index === connected ? <Star size={18} color="#FFF1B8" fill="#FFF1B8" /> : null}</Pressable>)}
      <View style={s.sceneFooter}><Text style={s.scenePrompt}>{connected === STARS.length ? 'A little sky, held together.' : 'Follow the brightest star'}</Text><Text style={s.sceneCount}>{connected} / {STARS.length}</Text></View>
    </SceneFrame>
    <Text style={s.guidance}>Touch the glowing star, then follow the next light. Each connection adds one soft bell to the sky.</Text>
    {connected > 0 ? <Pressable accessibilityRole="button" onPress={reset} style={s.secondaryButton}><RotateCcw size={17} color={C.text} /><Text style={s.secondaryText}>Trace again</Text></Pressable> : null}
  </ScrollView>;
}

const FIREFLIES = [
  { left: '14%' as const, top: '28%' as const }, { left: '28%' as const, top: '39%' as const }, { left: '45%' as const, top: '24%' as const }, { left: '63%' as const, top: '36%' as const },
  { left: '80%' as const, top: '25%' as const }, { left: '18%' as const, top: '56%' as const }, { left: '36%' as const, top: '49%' as const }, { left: '70%' as const, top: '53%' as const },
  { left: '84%' as const, top: '61%' as const }, { left: '27%' as const, top: '70%' as const }, { left: '58%' as const, top: '68%' as const }, { left: '75%' as const, top: '75%' as const },
];

function FireflyJar({ reducedMotion, soundOn, onToggleSound, onBack, onComplete }: SceneProps) {
  const [caught, setCaught] = useState<number[]>([]);
  const caughtRef = useRef<Set<number>>(new Set());
  const completedRef = useRef(false);
  const pulse = useRef(new Animated.Value(.35)).current;
  const sparklePlayer = useAudioPlayer(fireflySparkle);
  const completePlayer = useAudioPlayer(ritualComplete);
  const players = useMemo(() => [sparklePlayer, completePlayer], [completePlayer, sparklePlayer]);
  const soundEnabled = useSoundGate(soundOn, players);
  const { clearAll: clearTimers, schedule } = useTimeoutRegistry();
  useEffect(() => {
    if (reducedMotion) {
      pulse.stopAnimation();
      pulse.setValue(.82);
      return;
    }
    const loop = Animated.loop(Animated.sequence([Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }), Animated.timing(pulse, { toValue: .32, duration: 1000, useNativeDriver: true })]));
    loop.start();
    return () => {
      loop.stop();
      pulse.stopAnimation();
    };
  }, [pulse, reducedMotion]);
  const collect = (index: number) => {
    if (caughtRef.current.has(index)) return;
    const nextSet = new Set(caughtRef.current);
    nextSet.add(index);
    caughtRef.current = nextSet;
    const next = [...nextSet];
    setCaught(next);
    restartPlayer(sparklePlayer, soundEnabled); void haptic(index % 3 === 0 ? 'select' : 'soft');
    if (next.length === FIREFLIES.length && !completedRef.current) {
      completedRef.current = true;
      schedule(() => restartPlayer(completePlayer, soundEnabled), 260);
      void haptic('complete');
      onComplete();
    }
  };
  const reset = () => {
    clearTimers();
    caughtRef.current = new Set();
    setCaught([]);
    completedRef.current = false;
  };
  return <ScrollView contentContainerStyle={s.page}>
    <Header eyebrow="FIREFLY JAR" title="Gather the soft lights." onBack={onBack} soundOn={soundOn} onToggleSound={onToggleSound} />
    <SceneFrame art={fireflyArt}>
      <LinearGradient colors={['rgba(4,18,17,.02)', 'rgba(4,18,17,.18)']} style={StyleSheet.absoluteFill} />
      <View style={s.sceneTop}><CompletionPill complete={caught.length === FIREFLIES.length} label={caught.length === FIREFLIES.length ? 'The jar is glowing' : `Collect ${FIREFLIES.length - caught.length} soft light${FIREFLIES.length - caught.length === 1 ? '' : 's'}`} /></View>
      {FIREFLIES.map((position, index) => caught.includes(index) ? null : <Pressable key={index} accessibilityRole="button" accessibilityLabel={`Collect firefly ${index + 1}`} accessibilityHint={`${caught.length} of ${FIREFLIES.length} collected`} onPress={() => collect(index)} style={[s.fireflyTarget, position]}><Animated.View style={[s.fireflyHalo, { opacity: reducedMotion ? .82 : pulse }]}><View style={s.fireflyCore} /></Animated.View></Pressable>)}
      <View pointerEvents="none" style={s.jarGlow}>{caught.map((index) => <View key={index} style={[s.jarLight, { left: `${19 + ((index * 23) % 62)}%`, top: `${18 + ((index * 31) % 61)}%` }]} />)}</View>
      <View style={s.sceneFooter}><Text style={s.scenePrompt}>{caught.length === FIREFLIES.length ? 'The dusk feels a little warmer.' : 'Tap each wandering light'}</Text><Text style={s.sceneCount}>{caught.length} / {FIREFLIES.length}</Text></View>
    </SceneFrame>
    <Text style={s.guidance}>Every firefly answers with a tiny sparkle and a gentle pulse. Collect slowly—there is nothing to race.</Text>
    {caught.length === FIREFLIES.length ? <Pressable accessibilityRole="button" onPress={reset} style={s.secondaryButton}><RotateCcw size={17} color={C.text} /><Text style={s.secondaryText}>Release the lights</Text></Pressable> : null}
  </ScrollView>;
}

export function RitualsScreen({ reducedMotion }: { reducedMotion: boolean }) {
  const [activeGame, setActiveGame] = useState<DeepRitualGameId | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [progress, setProgress] = useState<Progress>(EMPTY_PROGRESS);
  useEffect(() => { void AsyncStorage.getItem(PROGRESS_KEY).then((value) => { if (value) setProgress({ ...EMPTY_PROGRESS, ...JSON.parse(value) as Partial<Progress> }); }).catch(() => undefined); }, []);
  const complete = useCallback((key: keyof Progress) => {
    setProgress((current) => { const next = { ...current, [key]: current[key] + 1 }; void AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(next)); return next; });
  }, []);
  const toggleSound = () => { setSoundOn((value) => !value); void haptic(); };
  const total = progress.floatingLeaves + progress.sandGarden + progress.colourEvening;
  const handleDeepComplete = (gameId: DeepRitualGameId) => {
    if (gameId === 'floating-leaves') complete('floatingLeaves');
    if (gameId === 'sand-garden') complete('sandGarden');
    if (gameId === 'colour-evening') complete('colourEvening');
  };
  return <>
    <ScrollView contentContainerStyle={s.page}>
      <Header eyebrow="IMMERSIVE RITUALS" title="Small worlds you can stay in." soundOn={soundOn} onToggleSound={toggleSound} />
      <Text style={s.intro}>Full-screen, gesture-led play with no scores or pressure. Steer, trace, and paint at your own pace; each world responds with depth, sound, and gentle haptics.</Text>
      <GameCard art={floatingLeavesArt} title="Floating Leaves" body="Steer through living currents, avoid stones, and gather river light." meta="PHYSICS · REPLAYABLE CURRENTS" onPress={() => setActiveGame('floating-leaves')} />
      <GameCard art={sandGardenArt} title="Sand Garden" body="Rake continuous patterns with real tracing accuracy and free play." meta="GESTURE · THREE PATTERNS" onPress={() => setActiveGame('sand-garden')} />
      <GameCard art={colourEveningArt} title="Colour the Evening" body="Brush warmth back into a quiet forest, one region at a time." meta="PAINT · PROGRESSIVE REVEAL" onPress={() => setActiveGame('colour-evening')} />
      <View style={s.localNote}><Sparkles size={19} color={C.plum500} /><View style={s.localNoteCopy}><Text style={s.localTitle}>{total ? `${total} world${total === 1 ? '' : 's'} gently completed` : 'No timer. No lives. No pressure.'}</Text><Text style={s.localBody}>Your ritual progress stays only on this phone. Replay any world for as long as it feels helpful.</Text></View></View>
    </ScrollView>
    <DeepRitualGameModal gameId={activeGame} reducedMotion={reducedMotion} onClose={() => setActiveGame(null)} onComplete={handleDeepComplete} />
  </>;
}

const s = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 48, backgroundColor: 'rgba(243,238,229,.94)', flexGrow: 1 },
  header: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: 17 },
  headerCopy: { flex: 1, paddingTop: 2 },
  roundButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: C.paper, borderWidth: 1, borderColor: C.line },
  eyebrow: { fontFamily: font.bold, color: C.plum500, fontSize: 9, letterSpacing: 1.65, marginBottom: 6 },
  title: { fontFamily: font.display, color: C.text, fontSize: 36, lineHeight: 41, letterSpacing: -.5 },
  intro: { fontFamily: font.body, color: C.textSecondary, fontSize: 14, lineHeight: 22, marginBottom: 20 },
  cardShadow: { borderRadius: radii.lg, backgroundColor: C.night950, marginBottom: 15, ...shadow },
  cardClip: { height: 226, borderRadius: radii.lg, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(181,151,93,.36)', backgroundColor: C.night950 },
  cardImage: { flex: 1, justifyContent: 'flex-end' }, cardImageRadius: { borderRadius: radii.lg },
  cardCopy: { padding: 17 }, cardMeta: { fontFamily: font.bold, fontSize: 8, letterSpacing: 1.35, color: C.peach300 },
  cardTitle: { fontFamily: font.display, fontSize: 26, lineHeight: 31, color: C.inverse, marginTop: 3 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }, cardBody: { flex: 1, fontFamily: font.body, color: C.inverseSecondary, fontSize: 12, lineHeight: 18 },
  pressed: { opacity: .9, transform: [{ scale: .99 }] },
  sceneShadow: { borderRadius: radii.xl, backgroundColor: C.night950, ...shadow },
  scene: { width: '100%', aspectRatio: 1.55, borderRadius: radii.xl, overflow: 'hidden' }, sceneRadius: { borderRadius: radii.xl },
  sceneTop: { position: 'absolute', top: 17, left: 17, right: 17, alignItems: 'center', zIndex: 8 },
  sceneFooter: { position: 'absolute', left: 20, right: 20, bottom: 20, alignItems: 'center', zIndex: 8 },
  completionPill: { minHeight: 34, paddingHorizontal: 13, borderRadius: 17, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(7,25,23,.68)', borderWidth: 1, borderColor: 'rgba(210,161,126,.42)' },
  completionPillDone: { backgroundColor: 'rgba(47,74,59,.92)', borderColor: 'rgba(247,241,231,.35)' },
  completionPillText: { fontFamily: font.medium, color: C.inverseSecondary, fontSize: 10 }, completionPillTextDone: { color: C.inverse },
  scenePrompt: { fontFamily: font.displayMedium, color: C.inverse, fontSize: 20, lineHeight: 25, textAlign: 'center' },
  sceneCount: { fontFamily: font.medium, color: C.inverseSecondary, fontSize: 11, letterSpacing: 1.1, marginTop: 5 },
  track: { width: '76%', height: 4, backgroundColor: 'rgba(247,241,231,.22)', borderRadius: 2, marginTop: 13, overflow: 'hidden' }, trackFill: { height: '100%', borderRadius: 2, backgroundColor: C.peach300 },
  guidance: { fontFamily: font.body, color: C.textSecondary, fontSize: 13, lineHeight: 20, textAlign: 'center', paddingHorizontal: 9, marginTop: 19 },
  primaryButton: { minHeight: 58, borderRadius: 20, backgroundColor: C.plum700, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center', marginTop: 17, ...shadow }, primaryText: { fontFamily: font.semibold, color: C.inverse, fontSize: 14 },
  secondaryButton: { minHeight: 54, borderRadius: 19, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 16 }, secondaryText: { fontFamily: font.semibold, color: C.text, fontSize: 13 },
  lanternCenter: { position: 'absolute', top: '29%', left: '27%', width: '46%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  lanternAura: { position: 'absolute', width: '78%', height: '78%', borderRadius: 999, backgroundColor: 'rgba(255,204,111,.30)' },
  lanternRing: { position: 'absolute', width: '92%', height: '92%', borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,224,163,.65)' },
  flowerTarget: { position: 'absolute', width: 54, height: 72, marginLeft: -27, marginTop: -30, alignItems: 'center', justifyContent: 'center', zIndex: 7 },
  flowerTargetActive: { transform: [{ scale: 1.12 }] }, flowerPulse: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(7,25,23,.56)', borderWidth: 1, borderColor: 'rgba(247,222,168,.64)' }, flowerPulseActive: { backgroundColor: 'rgba(255,229,166,.90)', borderColor: C.inverse }, flowerLabel: { fontFamily: font.medium, color: C.inverse, fontSize: 9, marginTop: 3, textShadowColor: C.night950, textShadowRadius: 4 },
  dotProgress: { flexDirection: 'row', gap: 5, marginTop: 11 }, progressDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(247,241,231,.28)' }, progressDotOn: { backgroundColor: C.peach300 },
  starTarget: { position: 'absolute', width: 46, height: 46, marginLeft: -23, marginTop: -23, alignItems: 'center', justifyContent: 'center', borderRadius: 23, zIndex: 7 }, starTargetNext: { backgroundColor: 'rgba(255,224,151,.13)', borderWidth: 1, borderColor: 'rgba(255,236,184,.42)' },
  fireflyTarget: { position: 'absolute', width: 48, height: 48, marginLeft: -24, marginTop: -24, alignItems: 'center', justifyContent: 'center', zIndex: 7 }, fireflyHalo: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,198,75,.20)', borderWidth: 1, borderColor: 'rgba(255,225,154,.50)' }, fireflyCore: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#FFE08B', shadowColor: '#FFD36B', shadowOpacity: 1, shadowRadius: 9, elevation: 4 },
  jarGlow: { position: 'absolute', left: '39%', top: '59%', width: '22%', height: '22%', borderRadius: 24, overflow: 'hidden', backgroundColor: 'rgba(255,194,79,.08)' }, jarLight: { position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFD56D' },
  localNote: { flexDirection: 'row', gap: 12, padding: 16, marginTop: 3, borderRadius: radii.md, backgroundColor: C.lavender100, borderWidth: 1, borderColor: C.line, ...softShadow }, localNoteCopy: { flex: 1 }, localTitle: { fontFamily: font.semibold, color: C.text, fontSize: 13 }, localBody: { fontFamily: font.body, color: C.textSecondary, fontSize: 11, lineHeight: 17, marginTop: 3 },
});
