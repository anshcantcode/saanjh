import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  ImageBackground,
  LayoutChangeEvent,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAudioPlayer } from 'expo-audio';
import { ArrowLeft, Check, Leaf, RotateCcw, Sparkles, Volume2, VolumeX, Wind } from 'lucide-react-native';
import Svg, { Circle, Defs, Image as SvgImage, Mask, Path, Rect } from 'react-native-svg';

import { colors as C, font } from '../theme';

const floatingLeavesArt = require('../../assets/games/floating-leaves-v2.png');
const sandGardenArt = require('../../assets/games/sand-garden-v2.png');
const colourEveningArt = require('../../assets/games/colour-evening-v2.png');
const colourEveningGrayArt = require('../../assets/games/colour-evening-gray-v2.png');

const streamCurrentSound = require('../../assets/sounds/stream-current.wav');
const leafCollectSound = require('../../assets/sounds/leaf-collect.wav');
const softRockBumpSound = require('../../assets/sounds/soft-rock-bump.wav');
const levelGateSound = require('../../assets/sounds/level-gate.wav');
const sandRakeSound = require('../../assets/sounds/sand-rake.wav');
const brushWarmthSound = require('../../assets/sounds/brush-warmth.wav');
const softWindSound = require('../../assets/sounds/soft-wind-ambience.wav');

export type DeepRitualGameId = 'floating-leaves' | 'sand-garden' | 'colour-evening';

type DeepRitualGameModalProps = {
  gameId: DeepRitualGameId | null;
  visible?: boolean;
  reducedMotion?: boolean;
  onClose: () => void;
  onComplete?: (gameId: DeepRitualGameId) => void;
};

type SoundPlayer = ReturnType<typeof useAudioPlayer>;
type Size = { width: number; height: number };
type Point = { x: number; y: number };

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function playSound(player: SoundPlayer, enabled: boolean) {
  if (!enabled) return;
  try {
    player.pause();
    void player.seekTo(0).then(() => player.play()).catch(() => undefined);
  } catch {
    // Rituals remain fully playable if a device temporarily refuses audio focus.
  }
}

function haptic(kind: 'soft' | 'bump' | 'success' = 'soft') {
  if (Platform.OS === 'web') return;
  if (kind === 'success') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  else void Haptics.impactAsync(kind === 'bump' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
}

function useAmbientMotion(reducedMotion: boolean) {
  const drift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reducedMotion) {
      drift.setValue(.5);
      return;
    }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(drift, { toValue: 1, duration: 6800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(drift, { toValue: 0, duration: 6800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [drift, reducedMotion]);
  return drift;
}

function GameHeader({ title, subtitle, soundOn, onToggleSound, onClose }: {
  title: string;
  subtitle: string;
  soundOn: boolean;
  onToggleSound: () => void;
  onClose: () => void;
}) {
  return <View style={s.header}>
    <Pressable accessibilityRole="button" accessibilityLabel="Close game" onPress={onClose} style={s.roundButton}><ArrowLeft size={22} color={C.inverse} /></Pressable>
    <View style={s.headerCopy}><Text style={s.headerTitle}>{title}</Text><Text style={s.headerSubtitle}>{subtitle}</Text></View>
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: soundOn }} accessibilityLabel="Soothing sounds" onPress={onToggleSound} style={s.roundButton}>
      {soundOn ? <Volume2 size={20} color={C.inverse} /> : <VolumeX size={20} color={C.inverseSecondary} />}
    </Pressable>
  </View>;
}

function ProgressHud({ label, progress, detail }: { label: string; progress: number; detail: string }) {
  return <View style={s.progressHud}>
    <View style={s.progressRow}><Text style={s.progressLabel}>{label}</Text><Text style={s.progressDetail}>{detail}</Text></View>
    <View style={s.progressTrack}><View style={[s.progressFill, { width: `${clamp(progress, 0, 1) * 100}%` }]} /></View>
  </View>;
}

const LEAF_ROCKS = [
  { x: .18, y: .27, radius: 28 }, { x: .74, y: .34, radius: 32 }, { x: .38, y: .56, radius: 30 },
  { x: .81, y: .68, radius: 28 }, { x: .19, y: .77, radius: 31 },
];
const LEAF_LIGHTS = [
  { x: .52, y: .18 }, { x: .31, y: .37 }, { x: .66, y: .49 }, { x: .22, y: .63 },
  { x: .56, y: .72 }, { x: .77, y: .63 }, { x: .41, y: .77 }, { x: .83, y: .22 },
];

function FloatingLeavesGame({ reducedMotion, soundOn, onToggleSound, onClose, onComplete }: {
  reducedMotion: boolean; soundOn: boolean; onToggleSound: () => void; onClose: () => void; onComplete: () => void;
}) {
  const [size, setSize] = useState<Size>({ width: 1, height: 1 });
  const [lights, setLights] = useState<number[]>([]);
  const [round, setRound] = useState(1);
  const [bumps, setBumps] = useState(0);
  const [complete, setComplete] = useState(false);
  const leaf = useRef<Point>({ x: .5, y: .86 });
  const velocity = useRef<Point>({ x: 0, y: -.00002 });
  const target = useRef<Point>({ x: .5, y: .82 });
  const steering = useRef(false);
  const collected = useRef(new Set<number>());
  const collisionCooldown = useRef(0);
  const frame = useRef<number | undefined>(undefined);
  const lastTime = useRef(Date.now());
  const leafXY = useRef(new Animated.ValueXY()).current;
  const leafTilt = useRef(new Animated.Value(0)).current;
  const ambience = useAmbientMotion(reducedMotion);
  const currentPlayer = useAudioPlayer(streamCurrentSound);
  const collectPlayer = useAudioPlayer(leafCollectSound);
  const bumpPlayer = useAudioPlayer(softRockBumpSound);
  const gatePlayer = useAudioPlayer(levelGateSound);
  const soundRef = useRef(soundOn);
  soundRef.current = soundOn;
  const roundRef = useRef(round);
  roundRef.current = round;
  const completeRef = useRef(false);
  const notifyComplete = useRef(false);

  const resetRound = useCallback((nextRound = 1) => {
    collected.current = new Set();
    setLights([]);
    setBumps(0);
    leaf.current = { x: .5, y: .86 };
    target.current = { x: .5, y: .82 };
    velocity.current = { x: 0, y: -.00002 };
    leafXY.setValue({ x: size.width * .5 - 24, y: size.height * .86 - 24 });
    completeRef.current = false;
    setComplete(false);
    setRound(nextRound);
  }, [leafXY, size.height, size.width]);

  const setDimensions = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout;
    setSize({ width: next.width, height: next.height });
    leafXY.setValue({ x: next.width * leaf.current.x - 24, y: next.height * leaf.current.y - 24 });
  };

  useEffect(() => {
    if (soundOn) playSound(currentPlayer, true);
    else currentPlayer.pause();
    return () => {
      try { currentPlayer.pause(); } catch { /* The player may already be released. */ }
    };
  }, [currentPlayer, soundOn]);

  useEffect(() => {
    let mounted = true;
    const tick = () => {
      if (!mounted) return;
      const now = Date.now();
      const dt = clamp(now - lastTime.current, 8, 34);
      lastTime.current = now;
      const current = leaf.current;
      const desired = target.current;
      const pull = steering.current ? .000035 : .000012;
      velocity.current.x += (desired.x - current.x) * pull * dt;
      velocity.current.y += (desired.y - current.y) * pull * dt;
      velocity.current.x += Math.sin(now / 1250 + current.y * 5) * .0000017 * dt;
      velocity.current.y -= .00000055 * dt * (1 + roundRef.current * .18);
      velocity.current.x *= .964;
      velocity.current.y *= .968;
      let next = {
        x: clamp(current.x + velocity.current.x * dt, .07, .93),
        y: clamp(current.y + velocity.current.y * dt, .1, .93),
      };
      if (next.x === .07 || next.x === .93) velocity.current.x *= -.72;
      if (next.y === .1 || next.y === .93) velocity.current.y *= -.72;
      const scaleX = Math.max(1, size.width);
      const scaleY = Math.max(1, size.height);
      if (now > collisionCooldown.current) {
        for (const rock of LEAF_ROCKS) {
          const shiftedX = clamp(rock.x + ((roundRef.current - 1) * .035 * (rock.y > .5 ? 1 : -1)), .12, .88);
          const d = Math.hypot((next.x - shiftedX) * scaleX, (next.y - rock.y) * scaleY);
          if (d < rock.radius + 19) {
            const angle = Math.atan2((next.y - rock.y) * scaleY, (next.x - shiftedX) * scaleX);
            velocity.current.x = Math.cos(angle) * .0015;
            velocity.current.y = Math.sin(angle) * .0015;
            next = current;
            collisionCooldown.current = now + 700;
            setBumps((value) => value + 1);
            haptic('bump');
            playSound(bumpPlayer, soundRef.current);
            break;
          }
        }
      }
      LEAF_LIGHTS.forEach((light, index) => {
        if (collected.current.has(index)) return;
        const shifted = { x: clamp(light.x + ((roundRef.current - 1) * .045 * (index % 2 ? 1 : -1)), .1, .9), y: light.y };
        if (Math.hypot((next.x - shifted.x) * scaleX, (next.y - shifted.y) * scaleY) < 32) {
          collected.current.add(index);
          setLights([...collected.current]);
          haptic();
          playSound(collectPlayer, soundRef.current);
          if (collected.current.size === LEAF_LIGHTS.length) {
            completeRef.current = true;
            setComplete(true);
            haptic('success');
            playSound(gatePlayer, soundRef.current);
            if (!notifyComplete.current) {
              notifyComplete.current = true;
              onComplete();
            }
          }
        }
      });
      leaf.current = next;
      leafXY.setValue({ x: next.x * scaleX - 24, y: next.y * scaleY - 24 });
      leafTilt.setValue(clamp(velocity.current.x * 3600, -1, 1));
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      mounted = false;
      if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    };
  }, [bumpPlayer, collectPlayer, gatePlayer, leafTilt, leafXY, onComplete, size.height, size.width]);

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: (event) => event.nativeEvent.locationY > 68 && event.nativeEvent.locationY < size.height - 134,
    onMoveShouldSetPanResponder: (event) => event.nativeEvent.locationY > 68 && event.nativeEvent.locationY < size.height - 134,
    onPanResponderGrant: (event) => {
      steering.current = true;
      target.current = { x: event.nativeEvent.locationX / size.width, y: event.nativeEvent.locationY / size.height };
    },
    onPanResponderMove: (event) => {
      target.current = { x: clamp(event.nativeEvent.locationX / size.width, .06, .94), y: clamp(event.nativeEvent.locationY / size.height, .08, .94) };
    },
    onPanResponderRelease: () => { steering.current = false; },
    onPanResponderTerminate: () => { steering.current = false; },
    onPanResponderTerminationRequest: () => false,
  }), [size.height, size.width]);

  const leafRotate = leafTilt.interpolate({ inputRange: [-1, 1], outputRange: ['-24deg', '24deg'] });
  return <ImageBackground source={floatingLeavesArt} resizeMode="cover" style={s.game} onLayout={setDimensions} {...pan.panHandlers}>
    <LinearGradient colors={['rgba(3,18,15,.65)', 'rgba(3,18,15,.05)', 'rgba(3,18,15,.72)']} locations={[0, .47, 1]} style={StyleSheet.absoluteFill} />
    <Animated.View pointerEvents="none" style={[s.parallaxMist, { transform: [{ translateX: ambience.interpolate({ inputRange: [0, 1], outputRange: [-30, 30] }) }] }]} />
    <GameHeader title="Floating Leaves" subtitle={`Current ${round} · guide, don't rush`} soundOn={soundOn} onToggleSound={onToggleSound} onClose={onClose} />
    <View pointerEvents="none" style={s.leafWorld}>
      {LEAF_ROCKS.map((rock, index) => <View key={index} style={[s.rock, { left: `${clamp(rock.x + ((round - 1) * .035 * (rock.y > .5 ? 1 : -1)), .12, .88) * 100}%`, top: `${rock.y * 100}%`, width: rock.radius * 2, height: rock.radius * 1.42, borderRadius: rock.radius }]} />)}
      {LEAF_LIGHTS.map((light, index) => lights.includes(index) ? null : <Animated.View key={index} style={[s.lightOrb, { left: `${clamp(light.x + ((round - 1) * .045 * (index % 2 ? 1 : -1)), .1, .9) * 100}%`, top: `${light.y * 100}%`, opacity: ambience.interpolate({ inputRange: [0, 1], outputRange: [.62, 1] }), transform: [{ scale: ambience.interpolate({ inputRange: [0, 1], outputRange: [.86, 1.15] }) }] }]} />)}
      <Animated.View style={[s.leafAvatar, { transform: [...leafXY.getTranslateTransform(), { perspective: 600 }, { rotateZ: leafRotate }, { rotateX: '15deg' }] }]}><Leaf size={34} color="#EACB73" fill="#88A35C" /></Animated.View>
      <Animated.View style={[s.currentRibbon, { transform: [{ translateY: ambience.interpolate({ inputRange: [0, 1], outputRange: [-16, 18] }) }, { rotateZ: '-8deg' }] }]} />
    </View>
    <View pointerEvents="box-none" style={s.bottomHud}>
      <ProgressHud label={complete ? 'The gate is open' : 'Gather river light'} progress={lights.length / LEAF_LIGHTS.length} detail={`${lights.length} / ${LEAF_LIGHTS.length}`} />
      <Text style={s.instruction}>{complete ? 'The stream remembers your path.' : 'Drag anywhere to steer · currents keep moving'}</Text>
      {bumps > 0 && !complete ? <Text style={s.gentleNote}>{bumps === 1 ? 'The stone nudged you. Keep floating.' : `${bumps} soft nudges · no lives lost`}</Text> : null}
      {complete ? <Pressable accessibilityRole="button" onPress={() => resetRound(round + 1)} style={s.continueButton}><Wind size={18} color={C.night950} /><Text style={s.continueText}>Enter a new current</Text></Pressable> : null}
    </View>
  </ImageBackground>;
}

type SandPattern = { title: string; points: Point[] };
const SAND_PATTERNS: SandPattern[] = [
  { title: 'Follow the river', points: Array.from({ length: 20 }, (_, i) => ({ x: .12 + i * .04, y: .3 + Math.sin(i * .65) * .12 })) },
  { title: 'Turn into a spiral', points: Array.from({ length: 28 }, (_, i) => { const a = i * .48; const r = .032 + i * .009; return { x: .5 + Math.cos(a) * r, y: .5 + Math.sin(a) * r * .72 }; }) },
  { title: 'Trace a quiet leaf', points: [...Array.from({ length: 14 }, (_, i) => ({ x: .5, y: .18 + i * .045 })), ...Array.from({ length: 16 }, (_, i) => { const t = i / 15; return { x: .5 + Math.sin(t * Math.PI) * .25, y: .2 + t * .54 }; }), ...Array.from({ length: 16 }, (_, i) => { const t = i / 15; return { x: .5 - Math.sin(t * Math.PI) * .25, y: .2 + t * .54 }; })] },
];

function pointsToPath(points: Point[]) {
  if (!points.length) return '';
  return points.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
}

function SandGardenGame({ reducedMotion, soundOn, onToggleSound, onClose, onComplete }: {
  reducedMotion: boolean; soundOn: boolean; onToggleSound: () => void; onClose: () => void; onComplete: () => void;
}) {
  const [size, setSize] = useState<Size>({ width: 1, height: 1 });
  const [level, setLevel] = useState(0);
  const [paths, setPaths] = useState<Point[][]>([]);
  const [head, setHead] = useState<Point>({ x: 0, y: 0 });
  const [reached, setReached] = useState(0);
  const [complete, setComplete] = useState(false);
  const activePath = useRef<Point[]>([]);
  const pathsRef = useRef<Point[][]>([]);
  const reachedRef = useRef(0);
  const soundAt = useRef(0);
  const notified = useRef(false);
  const sandPlayer = useAudioPlayer(sandRakeSound);
  const gatePlayer = useAudioPlayer(levelGateSound);
  const windPlayer = useAudioPlayer(softWindSound);
  const pattern = SAND_PATTERNS[level % SAND_PATTERNS.length]!;
  const targetPoints = pattern.points.map((point) => ({ x: point.x * size.width, y: point.y * size.height }));
  const ambience = useAmbientMotion(reducedMotion);

  const updatePath = (point: Point) => {
    setHead(point);
    const last = activePath.current.at(-1);
    if (!last || distance(last, point) > 5) {
      if (last && activePath.current.length >= 180) {
        activePath.current = [last, point];
        pathsRef.current = [...pathsRef.current, activePath.current];
      } else activePath.current = [...activePath.current, point];
    }
    pathsRef.current = [...pathsRef.current.slice(0, -1), activePath.current].slice(-18);
    setPaths(pathsRef.current);
    const now = Date.now();
    if (now - soundAt.current > 190) {
      soundAt.current = now;
      playSound(sandPlayer, soundOn);
      haptic();
    }
    let nextReached = reachedRef.current;
    while (nextReached < targetPoints.length && distance(point, targetPoints[nextReached]!) < 34) nextReached += 1;
    if (nextReached !== reachedRef.current) {
      reachedRef.current = nextReached;
      setReached(nextReached);
      if (nextReached === targetPoints.length) {
        setComplete(true);
        haptic('success');
        playSound(gatePlayer, soundOn);
        if (!notified.current) { notified.current = true; onComplete(); }
      }
    }
  };

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: (event) => event.nativeEvent.locationY > 68 && event.nativeEvent.locationY < size.height - 142,
    onMoveShouldSetPanResponder: (event) => event.nativeEvent.locationY > 68 && event.nativeEvent.locationY < size.height - 142,
    onPanResponderGrant: (event) => {
      const point = { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY };
      activePath.current = [point];
      pathsRef.current = [...pathsRef.current, activePath.current];
      updatePath(point);
    },
    onPanResponderMove: (event) => updatePath({ x: event.nativeEvent.locationX, y: event.nativeEvent.locationY }),
    onPanResponderRelease: () => { activePath.current = []; playSound(windPlayer, soundOn); },
    onPanResponderTerminate: () => { activePath.current = []; playSound(windPlayer, soundOn); },
    onPanResponderTerminationRequest: () => false,
  // PanResponder intentionally refreshes when the level or sound preference changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [level, size.height, size.width, soundOn]);

  const reset = useCallback((nextLevel = level) => {
    pathsRef.current = [];
    activePath.current = [];
    reachedRef.current = 0;
    setPaths([]);
    setReached(0);
    setComplete(false);
    notified.current = false;
    setLevel(nextLevel);
  }, [level]);

  const width = Math.max(1, size.width);
  const height = Math.max(1, size.height);
  return <ImageBackground source={sandGardenArt} resizeMode="cover" style={s.game} onLayout={(event) => setSize(event.nativeEvent.layout)} {...pan.panHandlers}>
    <LinearGradient colors={['rgba(6,23,18,.67)', 'rgba(34,30,18,.08)', 'rgba(5,20,16,.75)']} locations={[0, .5, 1]} style={StyleSheet.absoluteFill} />
    <Animated.View pointerEvents="none" style={[s.sandGlow, { opacity: ambience.interpolate({ inputRange: [0, 1], outputRange: [.18, .42] }), transform: [{ scale: ambience.interpolate({ inputRange: [0, 1], outputRange: [.92, 1.06] }) }] }]} />
    <GameHeader title="Sand Garden" subtitle={`Pattern ${level + 1} · ${pattern.title}`} soundOn={soundOn} onToggleSound={onToggleSound} onClose={onClose} />
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Path d={pointsToPath(targetPoints)} fill="none" stroke="rgba(247,225,166,.20)" strokeWidth={22} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2 13" />
      <Path d={pointsToPath(targetPoints.slice(0, Math.max(1, reached)))} fill="none" stroke="rgba(244,208,128,.72)" strokeWidth={3} strokeLinecap="round" />
      {paths.map((path, index) => <React.Fragment key={index}>
        <Path d={pointsToPath(path)} fill="none" stroke="rgba(35,25,13,.30)" strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" />
        <Path d={pointsToPath(path)} fill="none" stroke="rgba(250,225,169,.64)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        <Path d={pointsToPath(path)} fill="none" stroke="rgba(250,225,169,.42)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" transform="translate(0 5)" />
        <Path d={pointsToPath(path)} fill="none" stroke="rgba(250,225,169,.34)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" transform="translate(0 -5)" />
      </React.Fragment>)}
      {targetPoints.slice(reached, reached + 1).map((point, index) => <Circle key={index} cx={point.x} cy={point.y} r={11} fill="rgba(255,225,144,.34)" stroke="#F5D889" strokeWidth={1.5} />)}
    </Svg>
    {head.x ? <View pointerEvents="none" style={[s.rakeHead, { left: head.x - 34, top: head.y - 14, transform: [{ perspective: 500 }, { rotateZ: '-18deg' }, { rotateX: '18deg' }] }]}><View style={s.rakeBar} />{Array.from({ length: 5 }, (_, i) => <View key={i} style={[s.rakeTooth, { left: 6 + i * 12 }]} />)}</View> : null}
    <View pointerEvents="box-none" style={s.bottomHud}>
      <ProgressHud label={complete ? 'Pattern settled' : 'Guide the rake through each light'} progress={reached / Math.max(1, targetPoints.length)} detail={`${Math.round(reached / Math.max(1, targetPoints.length) * 100)}%`} />
      <Text style={s.instruction}>{complete ? 'Keep drawing freely, or begin a new pattern.' : 'Press and drag · slow strokes feel best'}</Text>
      <View style={s.actionRow}>
        <Pressable accessibilityRole="button" onPress={() => reset()} style={s.smallButton}><RotateCcw size={17} color={C.inverse} /><Text style={s.smallButtonText}>Clear</Text></Pressable>
        {complete ? <Pressable accessibilityRole="button" onPress={() => reset((level + 1) % SAND_PATTERNS.length)} style={s.continueButton}><Leaf size={17} color={C.night950} /><Text style={s.continueText}>Next pattern</Text></Pressable> : null}
      </View>
    </View>
  </ImageBackground>;
}

const GRID_COLS = 12;
const GRID_ROWS = 18;
const BRUSH_GOAL = 112;

function ColourEveningGame({ reducedMotion, soundOn, onToggleSound, onClose, onComplete }: {
  reducedMotion: boolean; soundOn: boolean; onToggleSound: () => void; onClose: () => void; onComplete: () => void;
}) {
  const [size, setSize] = useState<Size>({ width: 1, height: 1 });
  const [paths, setPaths] = useState<Point[][]>([]);
  const [painted, setPainted] = useState(0);
  const [brushSize, setBrushSize] = useState(52);
  const [complete, setComplete] = useState(false);
  const current = useRef<Point[]>([]);
  const pathsRef = useRef<Point[][]>([]);
  const cells = useRef(new Set<string>());
  const lastPoint = useRef<Point | undefined>(undefined);
  const soundAt = useRef(0);
  const notified = useRef(false);
  const brushPlayer = useAudioPlayer(brushWarmthSound);
  const windPlayer = useAudioPlayer(softWindSound);
  const gatePlayer = useAudioPlayer(levelGateSound);
  const ambience = useAmbientMotion(reducedMotion);

  const markCells = (from: Point | undefined, to: Point) => {
    const length = from ? distance(from, to) : 0;
    const steps = Math.max(1, Math.ceil(length / 8));
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const point = from ? { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t } : to;
      const radiusX = Math.max(1, Math.ceil((brushSize / size.width) * GRID_COLS * .46));
      const radiusY = Math.max(1, Math.ceil((brushSize / size.height) * GRID_ROWS * .46));
      const cx = Math.floor(point.x / size.width * GRID_COLS);
      const cy = Math.floor(point.y / size.height * GRID_ROWS);
      for (let dx = -radiusX; dx <= radiusX; dx += 1) for (let dy = -radiusY; dy <= radiusY; dy += 1) {
        const x = cx + dx; const y = cy + dy;
        if (x >= 0 && x < GRID_COLS && y >= 0 && y < GRID_ROWS && (dx * dx) / (radiusX * radiusX) + (dy * dy) / (radiusY * radiusY) <= 1) cells.current.add(`${x}:${y}`);
      }
    }
    const next = Math.min(BRUSH_GOAL, cells.current.size);
    setPainted(next);
    if (next >= BRUSH_GOAL && !notified.current) {
      notified.current = true;
      setComplete(true);
      haptic('success');
      playSound(gatePlayer, soundOn);
      onComplete();
    }
  };

  const paint = (point: Point) => {
    const before = lastPoint.current;
    if (!before || distance(before, point) > 5) {
      if (before && current.current.length >= 180) {
        current.current = [before, point];
        pathsRef.current = [...pathsRef.current, current.current];
      } else current.current = [...current.current, point];
    }
    pathsRef.current = [...pathsRef.current.slice(0, -1), current.current].slice(-28);
    setPaths(pathsRef.current);
    markCells(before, point);
    lastPoint.current = point;
    const now = Date.now();
    if (now - soundAt.current > 230) { soundAt.current = now; playSound(brushPlayer, soundOn); haptic(); }
  };

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: (event) => event.nativeEvent.locationY > 68 && event.nativeEvent.locationY < size.height - 142,
    onMoveShouldSetPanResponder: (event) => event.nativeEvent.locationY > 68 && event.nativeEvent.locationY < size.height - 142,
    onPanResponderGrant: (event) => {
      const point = { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY };
      current.current = [point];
      pathsRef.current = [...pathsRef.current, current.current];
      lastPoint.current = undefined;
      paint(point);
    },
    onPanResponderMove: (event) => paint({ x: event.nativeEvent.locationX, y: event.nativeEvent.locationY }),
    onPanResponderRelease: () => { current.current = []; lastPoint.current = undefined; playSound(windPlayer, soundOn); },
    onPanResponderTerminate: () => { current.current = []; lastPoint.current = undefined; playSound(windPlayer, soundOn); },
    onPanResponderTerminationRequest: () => false,
  // The responder needs the latest brush radius, canvas size, and sound preference.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [brushSize, size.height, size.width, soundOn]);

  const reset = () => {
    current.current = [];
    pathsRef.current = [];
    cells.current = new Set();
    lastPoint.current = undefined;
    notified.current = false;
    setPaths([]);
    setPainted(0);
    setComplete(false);
  };
  const width = Math.max(1, size.width);
  const height = Math.max(1, size.height);
  return <View style={s.game} onLayout={(event) => setSize(event.nativeEvent.layout)} {...pan.panHandlers}>
    <ImageBackground source={colourEveningArt} resizeMode="cover" style={StyleSheet.absoluteFill} />
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs><Mask id="warmth-reveal"><Rect width={width} height={height} fill="white" />{paths.map((path, index) => <Path key={index} d={pointsToPath(path)} fill="none" stroke="black" strokeWidth={brushSize} strokeLinecap="round" strokeLinejoin="round" />)}</Mask></Defs>
      <SvgImage href={colourEveningGrayArt} width={width} height={height} preserveAspectRatio="xMidYMid slice" mask="url(#warmth-reveal)" />
    </Svg>
    <LinearGradient pointerEvents="none" colors={['rgba(4,18,15,.66)', 'rgba(4,18,15,0)', 'rgba(4,18,15,.72)']} locations={[0, .43, 1]} style={StyleSheet.absoluteFill} />
    <Animated.View pointerEvents="none" style={[s.warmLight, { opacity: ambience.interpolate({ inputRange: [0, 1], outputRange: [.22, .5] }), transform: [{ translateX: ambience.interpolate({ inputRange: [0, 1], outputRange: [-26, 26] }) }, { scale: ambience.interpolate({ inputRange: [0, 1], outputRange: [.92, 1.12] }) }] }]} />
    <GameHeader title="Colour the Evening" subtitle="Brush warmth back into the forest" soundOn={soundOn} onToggleSound={onToggleSound} onClose={onClose} />
    <View pointerEvents="box-none" style={s.brushTools}>
      {[38, 52, 70].map((value) => <Pressable key={value} accessibilityRole="button" accessibilityLabel={`${value === 38 ? 'Small' : value === 52 ? 'Medium' : 'Large'} brush`} accessibilityState={{ selected: brushSize === value }} onPress={() => { setBrushSize(value); haptic(); }} style={[s.brushChoice, brushSize === value && s.brushChoiceActive]}><View style={[s.brushDot, { width: value / 3, height: value / 3, borderRadius: value / 6 }]} /></Pressable>)}
    </View>
    <View pointerEvents="box-none" style={s.bottomHud}>
      <ProgressHud label={complete ? 'The evening is glowing' : 'Reveal the warm forest'} progress={painted / BRUSH_GOAL} detail={`${Math.round(painted / BRUSH_GOAL * 100)}%`} />
      <Text style={s.instruction}>{complete ? 'Keep painting, or begin with a quiet sky again.' : 'Sweep slowly across the scene · choose your brush'}</Text>
      <View style={s.actionRow}><Pressable accessibilityRole="button" onPress={reset} style={s.smallButton}><RotateCcw size={17} color={C.inverse} /><Text style={s.smallButtonText}>{complete ? 'Paint again' : 'Reset'}</Text></Pressable>{complete ? <View style={s.completeBadge}><Check size={16} color={C.night950} /><Text style={s.completeBadgeText}>Warmth restored</Text></View> : null}</View>
    </View>
  </View>;
}

export function DeepRitualGameModal({ gameId, visible, reducedMotion = false, onClose, onComplete }: DeepRitualGameModalProps) {
  const [soundOn, setSoundOn] = useState(true);
  const isVisible = visible ?? gameId !== null;
  const toggleSound = () => { setSoundOn((value) => !value); haptic(); };
  const finish = (id: DeepRitualGameId) => onComplete?.(id);
  return <Modal visible={isVisible && gameId !== null} statusBarTranslucent animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
    <StatusBar style="light" />
    <SafeAreaView edges={['top', 'bottom']} style={s.modalSafe}>
      {gameId === 'floating-leaves' ? <FloatingLeavesGame reducedMotion={reducedMotion} soundOn={soundOn} onToggleSound={toggleSound} onClose={onClose} onComplete={() => finish('floating-leaves')} /> : null}
      {gameId === 'sand-garden' ? <SandGardenGame reducedMotion={reducedMotion} soundOn={soundOn} onToggleSound={toggleSound} onClose={onClose} onComplete={() => finish('sand-garden')} /> : null}
      {gameId === 'colour-evening' ? <ColourEveningGame reducedMotion={reducedMotion} soundOn={soundOn} onToggleSound={toggleSound} onClose={onClose} onComplete={() => finish('colour-evening')} /> : null}
    </SafeAreaView>
  </Modal>;
}

const s = StyleSheet.create({
  modalSafe: { flex: 1, backgroundColor: '#061B18' },
  game: { flex: 1, backgroundColor: '#071F1C', overflow: 'hidden' },
  header: { position: 'absolute', top: 9, left: 14, right: 14, zIndex: 40, flexDirection: 'row', alignItems: 'center', gap: 11 },
  headerCopy: { flex: 1, alignItems: 'center' },
  headerTitle: { fontFamily: font.display, color: C.inverse, fontSize: 23, lineHeight: 28, textAlign: 'center', textShadowColor: '#071A16', textShadowRadius: 10 },
  headerSubtitle: { fontFamily: font.medium, color: 'rgba(247,241,231,.74)', fontSize: 9, letterSpacing: .7, marginTop: 2, textAlign: 'center' },
  roundButton: { width: 43, height: 43, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(6,28,23,.72)', borderWidth: 1, borderColor: 'rgba(235,210,150,.32)' },
  progressHud: { width: '100%', padding: 13, borderRadius: 18, backgroundColor: 'rgba(5,25,21,.76)', borderWidth: 1, borderColor: 'rgba(239,214,155,.28)' },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  progressLabel: { flex: 1, fontFamily: font.semibold, color: C.inverse, fontSize: 12 },
  progressDetail: { fontFamily: font.bold, color: '#F1D58E', fontSize: 10, letterSpacing: .8 },
  progressTrack: { marginTop: 9, height: 4, backgroundColor: 'rgba(247,241,231,.17)', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: '#E8C879' },
  bottomHud: { position: 'absolute', zIndex: 30, left: 16, right: 16, bottom: 14, alignItems: 'center' },
  instruction: { marginTop: 9, fontFamily: font.medium, color: 'rgba(247,241,231,.85)', fontSize: 10, textAlign: 'center', textShadowColor: '#071A16', textShadowRadius: 8 },
  gentleNote: { marginTop: 4, fontFamily: font.body, color: 'rgba(244,214,148,.74)', fontSize: 9, textAlign: 'center' },
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 10 },
  smallButton: { height: 42, paddingHorizontal: 16, borderRadius: 21, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(5,25,21,.78)', borderWidth: 1, borderColor: 'rgba(239,214,155,.30)' },
  smallButtonText: { fontFamily: font.semibold, color: C.inverse, fontSize: 11 },
  continueButton: { height: 44, paddingHorizontal: 18, borderRadius: 22, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8D59D', borderWidth: 1, borderColor: 'rgba(255,255,255,.36)', marginTop: 11 },
  continueText: { fontFamily: font.semibold, color: C.night950, fontSize: 11 },
  leafWorld: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 8 },
  parallaxMist: { position: 'absolute', left: -60, right: -60, top: '39%', height: 140, borderRadius: 80, backgroundColor: 'rgba(206,225,198,.10)', transform: [{ rotateZ: '-8deg' }] },
  currentRibbon: { position: 'absolute', left: '16%', top: '18%', width: '62%', height: '78%', borderRadius: 999, borderWidth: 2, borderColor: 'rgba(220,235,205,.15)' },
  rock: { position: 'absolute', marginLeft: -27, marginTop: -20, backgroundColor: 'rgba(25,37,25,.86)', borderWidth: 2, borderColor: 'rgba(171,157,111,.36)', shadowColor: '#020A08', shadowOpacity: .9, shadowRadius: 12, elevation: 10, transform: [{ perspective: 600 }, { rotateX: '52deg' }, { rotateZ: '-9deg' }] },
  lightOrb: { position: 'absolute', zIndex: 10, width: 18, height: 18, marginLeft: -9, marginTop: -9, borderRadius: 9, backgroundColor: '#FFE194', borderWidth: 2, borderColor: 'rgba(255,248,209,.84)', shadowColor: '#FFD56A', shadowOpacity: 1, shadowRadius: 16, elevation: 10 },
  leafAvatar: { position: 'absolute', left: 0, top: 0, zIndex: 20, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(10,38,30,.42)', borderWidth: 1, borderColor: 'rgba(246,220,156,.62)', shadowColor: '#E5C46F', shadowOpacity: .6, shadowRadius: 12, elevation: 12 },
  sandGlow: { position: 'absolute', left: '15%', top: '22%', width: '70%', aspectRatio: 1, borderRadius: 999, backgroundColor: 'rgba(251,213,133,.19)' },
  rakeHead: { position: 'absolute', zIndex: 22, width: 68, height: 42, borderRadius: 8 },
  rakeBar: { position: 'absolute', left: 4, right: 4, bottom: 8, height: 8, borderRadius: 4, backgroundColor: '#B47B45', borderWidth: 1, borderColor: '#E0B376' },
  rakeTooth: { position: 'absolute', bottom: 0, width: 4, height: 13, borderRadius: 2, backgroundColor: '#D09A5F' },
  brushTools: { position: 'absolute', zIndex: 35, right: 15, top: 77, gap: 8 },
  brushChoice: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(5,25,21,.68)', borderWidth: 1, borderColor: 'rgba(239,214,155,.24)' },
  brushChoiceActive: { backgroundColor: 'rgba(229,200,121,.84)', borderColor: '#FFF1BE' },
  brushDot: { backgroundColor: '#F2D88F', borderWidth: 1, borderColor: 'rgba(255,255,255,.7)' },
  warmLight: { position: 'absolute', zIndex: 10, left: '38%', top: '24%', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,194,90,.24)' },
  completeBadge: { height: 42, borderRadius: 21, paddingHorizontal: 15, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8D59D' },
  completeBadgeText: { fontFamily: font.semibold, color: C.night950, fontSize: 10 },
});
