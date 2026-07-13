import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useFonts } from '@expo-google-fonts/inter/useFonts';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { PlayfairDisplay_500Medium } from '@expo-google-fonts/playfair-display/500Medium';
import { PlayfairDisplay_600SemiBold } from '@expo-google-fonts/playfair-display/600SemiBold';
import {
  ArrowLeft,
  ArrowRight,
  AudioLines,
  BookHeart,
  BookOpen,
  Check,
  ChevronRight,
  CircleAlert,
  FileAudio,
  Heart,
  Home,
  ImageIcon,
  Info,
  LifeBuoy,
  LockKeyhole,
  MessageCircle,
  Mic,
  Phone,
  PhoneOff,
  Play,
  Plus,
  RefreshCw,
  Send,
  Settings as SettingsIcon,
  ShieldCheck,
  Sparkles,
  Square,
  Trash2,
  Upload,
  UserRound,
  Volume2,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { colors as C, font, radii, shadow, softShadow } from './src/theme';
import {
  createEmptyAppData,
  type AppData,
  type AppSettings,
  type ChatMessage,
  type CompanionProfile,
  type CompanionRelationship,
  type ConsentStatus,
  type JournalEntry,
  type MoodEntry,
  type SessionEntry,
  type SessionKind,
} from './src/types';
import { clearAppData, loadAppData, saveAppData } from './src/services/storage';
import { clearAllPersistedMedia, clearGeneratedAudioCache, deletePersistedMedia, persistGeneratedAudio, persistMediaUri } from './src/services/mediaStorage';
import { clearApiAccessToken, loadApiAccessToken, saveApiAccessToken } from './src/services/secureSettings';
import { BotanicalSampleActionCard, RitualsScreen, VoiceGenerationStatus, type VoiceGenerationStage } from './src/components';
import { BotanicalActionCard } from './src/components/BotanicalActionCard';
import {
  SAANJH_API_BASE_URL,
  api,
  configureSaanjhApi,
  displaySaanjhError,
  type FileUploadProgress,
  type HealthResponse,
  type LocalCompanionContext,
  type ReactNativeFile,
  type VoiceGenerationProgress,
  type VoiceboxProfile,
} from './src/services/saanjhApi';

const welcomeArt = require('./web/public/assets/welcome-forest.webp');
const sessionArt = require('./web/public/assets/session-forest-night.webp');
const homeArt = require('./web/public/assets/home-forest-path.webp');
const consentIllustration = require('./web/public/assets/consent-botanical.webp');
const moodArt = require('./web/public/assets/mood-ripples.webp');
const journalArt = require('./web/public/assets/journal-stilllife.webp');
const emblemArt = require('./web/public/assets/botanical-emblem.webp');
const paperArt = require('./web/public/assets/paper-topography.webp');

type Route =
  | 'welcome'
  | 'onboarding'
  | 'today'
  | 'companion'
  | 'journal'
  | 'rituals'
  | 'settings'
  | 'mood'
  | 'precall'
  | 'session'
  | 'aftercare'
  | 'safety';

type TabRoute = 'today' | 'companion' | 'rituals' | 'journal' | 'settings';

const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const now = () => new Date().toISOString();
const displayError = (error: unknown) => displaySaanjhError(error) || 'Something went quiet. Please try again.';
const timeLabel = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
const isTemporaryBackendUrl = (value: string) => /(?:\.trycloudflare\.com|\.loca\.lt)(?:\/|$)/i.test(value.trim());

const RELATIONSHIPS: Array<{ id: CompanionRelationship; label: string }> = [
  { id: 'friend', label: 'Friend' },
  { id: 'parent', label: 'Parent' },
  { id: 'partner', label: 'Partner' },
  { id: 'sibling', label: 'Sibling' },
  { id: 'mentor', label: 'Mentor' },
  { id: 'other', label: 'Other' },
];

const TRAITS = ['Warm', 'Soft-spoken', 'Playful', 'Patient', 'Grounded', 'Direct', 'Motivating', 'Reflective'];
const MOODS = [
  { score: 1 as const, label: 'Very low' },
  { score: 2 as const, label: 'Low' },
  { score: 3 as const, label: 'In the middle' },
  { score: 4 as const, label: 'Good' },
  { score: 5 as const, label: 'Very good' },
];
const FEELINGS = ['Anxious', 'Overwhelmed', 'Lonely', 'Tired', 'Grateful', 'Hopeful'];

async function haptic(kind: 'soft' | 'success' = 'soft') {
  if (Platform.OS === 'web') return;
  if (kind === 'success') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  else await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

function notify(title: string, message: string) {
  if (Platform.OS === 'web') {
    const browser = globalThis as typeof globalThis & { alert?: (value?: string) => void };
    browser.alert?.(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}

function confirmAction(title: string, message: string, confirmLabel = 'Confirm'): Promise<boolean> {
  if (Platform.OS === 'web') {
    const browser = globalThis as typeof globalThis & { confirm?: (value?: string) => boolean };
    return Promise.resolve(browser.confirm?.(`${title}\n\n${message}`) ?? false);
  }
  return new Promise((resolve) => Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
    { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
  ], { cancelable: true, onDismiss: () => resolve(false) }));
}

function guessMime(name?: string) {
  const lower = name?.toLowerCase() ?? '';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.webm')) return 'audio/webm';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.ogg') || lower.endsWith('.opus')) return 'audio/ogg';
  return 'audio/mp4';
}

async function makeAudioFile(uri: string, name: string, mime?: string): Promise<ReactNativeFile> {
  return { uri, name, type: mime ?? guessMime(name) };
}

function fileTransferLabel(progress: FileUploadProgress, registeringLabel: string): string {
  if (progress.stage === 'reading') return 'Reading the saved sample on this phone…';
  if (progress.stage === 'registering') return registeringLabel;
  if (progress.ratio !== null) return `Uploading the sample securely… ${Math.round(progress.ratio * 100)}%`;
  return 'Uploading the sample securely…';
}

function sanitizedSettings(settings: AppSettings): AppSettings {
  return {
    apiBaseUrl: settings.apiBaseUrl.trim(),
    allowTranscripts: settings.allowTranscripts,
    reducedMotion: settings.reducedMotion,
  };
}

const DISTRESS_PATTERN = /\b(kill myself|suicid(?:e|al)|end my life|take my life|want to die|don['’]?t want to (?:live|be alive)|hurt myself|harm myself|self[- ]harm|not worth living|immediate danger|someone is hurting me)\b/i;

function remoteVoiceProfileId(profile: VoiceboxProfile): string {
  const value = profile.id ?? profile.profile_id;
  if (!value) throw new Error('The voice could not be prepared. Please try again.');
  return String(value);
}

type VoicePipelineProgress = {
  stage: 'generating' | 'downloading';
  status: string;
  elapsedMs: number;
  generationId?: string;
};

async function gatewayVoice(
  profileId: string,
  text: string,
  options: {
    signal?: AbortSignal;
    persistent?: boolean;
    onProgress?: (progress: VoicePipelineProgress) => void;
  } = {},
) {
  const startedAt = Date.now();
  options.onProgress?.({ stage: 'generating', status: 'queued', elapsedMs: 0 });
  const first = await api.generateVoice({ text, profile_id: profileId }, { signal: options.signal });
  const completed = first.audio_url
    ? first
    : await api.waitForVoiceGeneration(first.generation_id, {
      signal: options.signal,
      onProgress: (progress: VoiceGenerationProgress) => options.onProgress?.({
        stage: 'generating',
        status: progress.status,
        elapsedMs: progress.elapsedMs,
        generationId: progress.generation.generation_id,
      }),
    });
  options.onProgress?.({
    stage: 'downloading',
    status: 'saving securely on this device',
    elapsedMs: Date.now() - startedAt,
    generationId: completed.generation_id,
  });
  const bytes = await api.voiceAudioBytes(completed.generation_id, { signal: options.signal });
  const audioUrl = await persistGeneratedAudio(bytes, completed.generation_id, options.persistent ?? false);
  return { id: completed.generation_id, audioUrl };
}

function companionContext(profile: CompanionProfile): LocalCompanionContext {
  return {
    name: profile.name,
    relationship: profile.relationship,
    custom_relationship: profile.customRelationship || null,
    voice_status: profile.voiceStatus,
    consent_acknowledged: true,
    ai_disclosure_acknowledged: true,
    traits: profile.traits,
    memories: profile.memories,
    address_as: profile.addressAs || null,
    helpful_when: profile.helpfulWhen || null,
    avoid: profile.avoid || null,
  };
}

function serviceSummary(health?: HealthResponse, baseUrl = api.baseUrl): string {
  if (!baseUrl) return 'Add the public HTTPS address for your Saanjh backend.';
  if (!health) return 'Tap below to check the Saanjh backend and its AI voice services.';
  const groq = health.groq.status === 'ok' ? 'Groq online' : `Groq unavailable${health.groq.detail ? `: ${health.groq.detail}` : ''}`;
  const voicebox = health.voicebox.status === 'ok' ? 'Voicebox service reachable' : `Voicebox unavailable${health.voicebox.detail ? `: ${health.voicebox.detail}` : ''}`;
  return `${groq} · ${voicebox}`;
}

function Reveal({ children, delay = 0, distance = 18, disabled = false, style }: {
  children: React.ReactNode;
  delay?: number;
  distance?: number;
  disabled?: boolean;
  style?: React.ComponentProps<typeof View>['style'];
}) {
  const progress = useRef(new Animated.Value(disabled ? 1 : 0)).current;
  useEffect(() => {
    if (disabled) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 680,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start();
    return () => animation.stop();
  }, [delay, disabled, progress]);
  return (
    <Animated.View style={[style, {
      opacity: progress,
      transform: [
        { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) },
        { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [.985, 1] }) },
      ],
    }]}>
      {children}
    </Animated.View>
  );
}

function AmbientRings({ size = 180, active = true, dark = false }: { size?: number; active?: boolean; dark?: boolean }) {
  const breath = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) {
      breath.setValue(0);
      return;
    }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(breath, { toValue: 1, duration: 4200, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(breath, { toValue: 0, duration: 4200, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [active, breath]);
  return (
    <View style={[s.ambientRings, { width: size, height: size, pointerEvents: 'none' }]}>
      {[0, 1, 2].map((ring) => {
        const ringSize = size * (1 - ring * .2);
        return <Animated.View key={ring} style={[s.ambientRing, dark && s.ambientRingDark, {
          width: ringSize,
          height: ringSize,
          borderRadius: ringSize / 2,
          opacity: breath.interpolate({ inputRange: [0, 1], outputRange: [.16 + ring * .04, .42 - ring * .03] }),
          transform: [{ scale: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07 + ring * .02] }) }],
        }]} />;
      })}
      <View style={[s.ambientSeed, dark && s.ambientSeedDark]} />
    </View>
  );
}

function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <View style={s.brand} accessibilityLabel="Saanjh">
      <View style={[s.brandGlyph, inverse && s.brandGlyphInverse]}><Image source={emblemArt} style={s.brandEmblem} /></View>
      <Text style={[s.brandText, inverse && { color: C.inverse }]}>saanjh</Text>
    </View>
  );
}

function AIChip({ inverse = false, label = 'AI voice companion' }: { inverse?: boolean; label?: string }) {
  return (
    <View style={[s.aiChip, inverse && s.aiChipInverse]}>
      <Sparkles size={13} color={inverse ? C.peach300 : C.plum500} />
      <Text style={[s.aiChipText, inverse && { color: C.inverse }]}>{label}</Text>
    </View>
  );
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  danger?: boolean;
  icon?: React.ReactNode;
};

function Button({ label, onPress, disabled, secondary, danger, icon }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => { void haptic(); onPress(); }}
      style={({ pressed }) => [
        s.button,
        secondary && s.buttonSecondary,
        danger && s.buttonDanger,
        disabled && s.buttonDisabled,
        pressed && s.pressed,
      ]}
    >
      {icon}
      <Text style={[s.buttonText, secondary && s.buttonTextSecondary]}>{label}</Text>
    </Pressable>
  );
}

function IconButton({ label, onPress, children, dark = false }: { label: string; onPress: () => void; children: React.ReactNode; dark?: boolean }) {
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [s.iconButton, dark && s.iconButtonDark, pressed && s.pressed]}>
      {children}
    </Pressable>
  );
}

function PageHeader({ title, eyebrow, onBack, right }: { title: string; eyebrow?: string; onBack?: () => void; right?: React.ReactNode }) {
  return (
    <View style={s.pageHeader}>
      <View style={s.pageHeaderRow}>
        {onBack ? <IconButton label="Go back" onPress={onBack}><ArrowLeft size={22} color={C.text} /></IconButton> : <Brand />}
        {right ?? <View style={{ width: 48 }} />}
      </View>
      {eyebrow ? <Text style={s.eyebrow}>{eyebrow}</Text> : null}
      <Text style={s.pageTitle} numberOfLines={2} ellipsizeMode="tail">{title}</Text>
    </View>
  );
}

function Notice({ icon, title, body, tone = 'lavender' }: { icon?: React.ReactNode; title: string; body: string; tone?: 'lavender' | 'peach' | 'night' }) {
  return (
    <View style={[s.notice, tone === 'peach' && s.noticePeach, tone === 'night' && s.noticeNight]}>
      {icon ?? <Info size={20} color={tone === 'night' ? C.peach300 : C.plum500} />}
      <View style={{ flex: 1 }}>
        <Text style={[s.noticeTitle, tone === 'night' && { color: C.inverse }]}>{title}</Text>
        <Text style={[s.noticeBody, tone === 'night' && { color: C.inverseSecondary }]}>{body}</Text>
      </View>
    </View>
  );
}

function Field({ label, value, onChangeText, placeholder, multiline, secureTextEntry, autoCapitalize = 'sentences' }: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  return (
    <View style={s.fieldWrap}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.placeholder}
        multiline={multiline}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        style={[s.field, multiline && s.fieldMultiline]}
      />
    </View>
  );
}

function ChoiceCard({ selected, title, body, onPress, icon }: { selected: boolean; title: string; body?: string; onPress: () => void; icon?: React.ReactNode }) {
  return (
    <Pressable accessibilityRole="radio" accessibilityLabel={title} accessibilityState={{ checked: selected }} onPress={() => { void haptic(); onPress(); }} style={({ pressed }) => [s.choiceCard, selected && s.choiceCardSelected, pressed && s.pressed]}>
      {icon ? <View style={[s.choiceIcon, selected && s.choiceIconSelected]}>{icon}</View> : null}
      <View style={{ flex: 1 }}>
        <Text style={s.choiceTitle}>{title}</Text>
        {body ? <Text style={s.choiceBody}>{body}</Text> : null}
      </View>
      <View style={[s.radio, selected && s.radioSelected]}>{selected ? <Check size={14} color={C.inverse} strokeWidth={3} /> : null}</View>
    </Pressable>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => { void haptic(); onPress(); }} style={[s.chip, selected && s.chipSelected]} accessibilityState={{ selected }}>
      {selected ? <Check size={14} color={C.plum700} /> : null}
      <Text style={[s.chipText, selected && s.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function MoodOption({ mood, selected, onPress, reducedMotion = false }: { mood: (typeof MOODS)[number]; selected: boolean; onPress: () => void; reducedMotion?: boolean }) {
  const selection = useRef(new Animated.Value(selected ? 1 : 0)).current;
  useEffect(() => {
    if (reducedMotion) {
      selection.setValue(selected ? 1 : 0);
      return;
    }
    const animation = Animated.spring(selection, { toValue: selected ? 1 : 0, damping: 15, stiffness: 180, mass: .7, useNativeDriver: Platform.OS !== 'web' });
    animation.start();
    return () => animation.stop();
  }, [reducedMotion, selected, selection]);
  return (
    <Pressable accessibilityRole="radio" accessibilityLabel={`${mood.label}, ${mood.score} out of 5`} onPress={onPress} style={s.moodPressable} accessibilityState={{ checked: selected, selected }}>
      <Animated.View style={[s.moodItem, selected && s.moodItemSelected, {
        transform: [{ scale: selection.interpolate({ inputRange: [0, 1], outputRange: [1, 1.055] }) }],
      }]}>
        <View style={[s.moodFace, selected && s.moodFaceSelected]}><Text style={[s.moodNumber, selected && { color: C.inverse }]}>{mood.score}</Text></View>
        <Text style={[s.moodLabel, selected && s.moodLabelSelected]}>{mood.label}</Text>
      </Animated.View>
    </Pressable>
  );
}

function OnboardingProgress({ step, reducedMotion }: { step: number; reducedMotion: boolean }) {
  const progress = useRef(new Animated.Value((step + 1) / 6)).current;
  useEffect(() => {
    const next = (step + 1) / 6;
    if (reducedMotion) {
      progress.setValue(next);
      return;
    }
    const animation = Animated.timing(progress, { toValue: next, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    animation.start();
    return () => animation.stop();
  }, [progress, reducedMotion, step]);
  return <View style={s.progressTrack}><Animated.View style={[s.progressFill, { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} /></View>;
}

function ArtworkAvatar({ uri, size = 92 }: { uri?: string; size?: number }) {
  return <Image source={uri ? { uri } : emblemArt} style={[s.artAvatar, { width: size, height: size, borderRadius: size / 2 }]} />;
}

function LoadingScreen() {
  return <ImageBackground source={paperArt} style={s.loading} resizeMode="cover"><Image source={emblemArt} style={s.loadingArt} /><ActivityIndicator color={C.plum700} /><Text style={s.loadingText}>Opening your private space…</Text></ImageBackground>;
}

function WelcomeScreen({ onBegin }: { onBegin: () => void }) {
  return (
    <ImageBackground source={welcomeArt} style={s.welcome} resizeMode="cover">
      <StatusBar style="light" />
      <LinearGradient colors={['rgba(8,35,29,.44)', 'rgba(8,35,29,.06)', 'rgba(6,26,24,.94)']} locations={[0, .43, 1]} style={StyleSheet.absoluteFill} />
      <View style={s.welcomeAura}><AmbientRings size={250} dark /></View>
      <SafeAreaView style={s.welcomeSafe}>
        <Reveal delay={100}><View style={s.welcomeTop}><Brand inverse /><AIChip inverse /></View></Reveal>
        <Reveal delay={280} distance={26} style={s.welcomeCopy}>
          <Text style={s.welcomeKicker}>ROOTED IN VOICE · GUIDED BY CARE</Text>
          <Text style={s.welcomeTitle}>A familiar voice. Clearly AI.</Text>
          <Text style={s.welcomeBody}>A consent-first space for conversation, grounding, and reflection—without pretending to replace a person.</Text>
          <Button label="Begin privately" onPress={onBegin} icon={<ArrowRight size={20} color={C.inverse} />} />
          <View style={s.trustRow}>
            <ShieldCheck size={17} color={C.peach300} />
            <Text style={s.trustText}>Your setup begins empty. Nothing is pre-filled.</Text>
          </View>
        </Reveal>
      </SafeAreaView>
    </ImageBackground>
  );
}

type OnboardingDraft = {
  voiceStatus?: ConsentStatus;
  name: string;
  relationship?: CompanionRelationship;
  customRelationship: string;
  avatarUri?: string;
  consentAcknowledged: boolean;
  consentNote: string;
  sampleUri?: string;
  sampleName?: string;
  sampleMime?: string;
  sampleDurationMs?: number;
  transcript: string;
  traits: string[];
  addressAs: string;
  helpfulWhen: string;
  avoid: string;
};

function OnboardingScreen({ initialSettings, initialAccessToken, onSaveConnection, onComplete, onRemoteProfileOrphaned }: {
  initialSettings: AppSettings;
  initialAccessToken: string;
  onSaveConnection: (baseUrl: string, accessToken: string) => Promise<void>;
  onComplete: (profile: CompanionProfile, settings: AppSettings) => void;
  onRemoteProfileOrphaned: (profileId: string) => void;
}) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<OnboardingDraft>({ name: '', customRelationship: '', consentAcknowledged: false, consentNote: '', transcript: '', traits: [], addressAs: '', helpfulWhen: '', avoid: '' });
  const [settings, setSettings] = useState<AppSettings>(() => ({
    ...sanitizedSettings(initialSettings),
    apiBaseUrl: initialSettings.apiBaseUrl.trim() || SAANJH_API_BASE_URL,
  }));
  const [accessToken, setAccessToken] = useState(initialAccessToken);
  const [health, setHealth] = useState<HealthResponse>();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [allowLocalSave, setAllowLocalSave] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const samplePlayer = useAudioPlayer(draft.sampleUri ?? null);
  const recordingActiveRef = useRef(false);

  useEffect(() => () => {
    if (recordingActiveRef.current) void recorder.stop().catch(() => undefined);
    void setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
  }, [recorder]);

  const update = (patch: Partial<OnboardingDraft>) => setDraft((current) => ({ ...current, ...patch }));

  const applyConnection = async () => {
    const baseUrl = settings.apiBaseUrl.trim();
    if (!baseUrl) throw new Error('Add the public HTTPS address for your Saanjh backend first.');
    configureSaanjhApi({ baseUrl, accessToken });
    await onSaveConnection(baseUrl, accessToken);
    return baseUrl;
  };

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!result.canceled && result.assets[0]?.uri) update({ avatarUri: result.assets[0].uri });
  };

  const toggleRecord = async () => {
    setError('');
    if (recorderState.isRecording) {
      const durationMillis = recorderState.durationMillis;
      await recorder.stop();
      recordingActiveRef.current = false;
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (durationMillis < 5_500) {
        setError('Record at least 6 seconds of clear speech before cloning your voice.');
        return;
      }
      if (recorder.uri) update({ sampleUri: recorder.uri, sampleName: `saanjh-sample-${Date.now()}.${Platform.OS === 'web' ? 'webm' : 'm4a'}`, sampleMime: Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4', sampleDurationMs: durationMillis, transcript: '' });
      return;
    }
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) { setError('Microphone permission is needed only while you record a sample.'); return; }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    recordingActiveRef.current = true;
    void haptic();
  };

  useEffect(() => {
    if (recorderState.isRecording && recorderState.durationMillis >= 30_000) void toggleRecord();
  }, [recorderState.durationMillis, recorderState.isRecording]);

  const previousStep = async () => {
    if (recorderState.isRecording) await toggleRecord();
    setStep((current) => Math.max(0, current - 1));
  };

  const pickAudio = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      update({ sampleUri: asset.uri, sampleName: asset.name, sampleMime: asset.mimeType ?? guessMime(asset.name), sampleDurationMs: undefined, transcript: '' });
    }
  };

  const transcribe = async () => {
    if (!draft.sampleUri || !draft.sampleName) return;
    setBusy('Transcribing the real sample…'); setError('');
    try {
      await applyConnection();
      const file = await makeAudioFile(draft.sampleUri, draft.sampleName, draft.sampleMime);
      const transcript = await api.transcribe(file, {}, {
        onUploadProgress: (progress) => setBusy(fileTransferLabel(progress, 'Listening carefully to the sample…')),
      });
      update({ transcript });
      void haptic('success');
    } catch (e) { setError(displayError(e)); } finally { setBusy(''); }
  };

  const testServices = async () => {
    setBusy('Checking Saanjh services…'); setError('');
    try {
      const baseUrl = await applyConnection();
      const current = await api.health();
      setHealth(current);
      if (current.status !== 'ok') throw new Error(serviceSummary(current, baseUrl));
      void haptic('success');
    } catch (e) { setError(displayError(e)); } finally { setBusy(''); }
  };

  const validateStep = () => {
    if (step === 0 && !draft.voiceStatus) return 'Choose whose voice you have permission to use.';
    if (step === 1 && (!draft.name.trim() || !draft.relationship || (draft.relationship === 'other' && !draft.customRelationship.trim()))) return 'Add a name and relationship.';
    if (step === 2 && (!draft.consentAcknowledged || ((draft.voiceStatus === 'consented' || draft.voiceStatus === 'memorial') && !draft.consentNote.trim()))) return 'Complete the consent acknowledgement and authority note before continuing.';
    if (step === 3 && recorderState.isRecording) return 'Stop the recording before continuing.';
    if (step === 3 && draft.sampleDurationMs !== undefined && draft.sampleDurationMs < 5_500) return 'Record at least 6 seconds of clear speech before cloning your voice.';
    if (step === 3 && (!draft.sampleUri || !draft.sampleName || !draft.transcript.trim())) return 'Record or import a sample and confirm its exact words.';
    return '';
  };

  const next = () => {
    const issue = validateStep();
    if (issue) { setError(issue); return; }
    setError(''); setStep((current) => Math.min(5, current + 1));
  };

  const complete = async (syncVoice: boolean) => {
    if (!draft.voiceStatus || !draft.relationship || !draft.sampleUri || !draft.sampleName) return;
    setBusy(syncVoice ? 'Creating the consented voice…' : 'Creating your companion…'); setError('');
    let voiceboxProfileId: string | undefined;
    let savedSampleUri: string | undefined;
    let savedAvatarUri: string | undefined;
    try {
      if (syncVoice) {
        await applyConnection();
        const file = await makeAudioFile(draft.sampleUri, draft.sampleName, draft.sampleMime);
        const voiceProfile = await api.createVoiceboxProfileWithSample(
          { name: draft.name.trim(), language: 'en', voice_type: 'cloned' },
          file,
          draft.transcript.trim(),
          {
            onUploadProgress: (progress) => setBusy(fileTransferLabel(progress, 'Preparing the familiar AI voice…')),
          },
        );
        voiceboxProfileId = remoteVoiceProfileId(voiceProfile);
      }
      savedSampleUri = await persistMediaUri(draft.sampleUri, draft.sampleName, draft.sampleMime ?? guessMime(draft.sampleName));
      savedAvatarUri = draft.avatarUri ? await persistMediaUri(draft.avatarUri, 'companion-avatar.jpg', 'image/jpeg') : undefined;
      const consentAt = now();
      const profile: CompanionProfile = {
        id: uid('companion'),
        name: draft.name.trim(),
        relationship: draft.relationship,
        customRelationship: draft.customRelationship.trim() || undefined,
        voiceStatus: draft.voiceStatus,
        consentAcknowledged: true,
        consentAt,
        consentNote: draft.consentNote.trim() || undefined,
        voiceSampleUri: savedSampleUri,
        voiceSampleName: draft.sampleName,
        sampleTranscript: draft.transcript.trim(),
        voiceboxProfileId,
        avatarUri: savedAvatarUri,
        traits: draft.traits,
        memories: [],
        addressAs: draft.addressAs.trim() || undefined,
        helpfulWhen: draft.helpfulWhen.trim() || undefined,
        avoid: draft.avoid.trim() || undefined,
        createdAt: consentAt,
      };
      void haptic('success');
      onComplete(profile, settings);
    } catch (e) {
      deletePersistedMedia(savedSampleUri);
      deletePersistedMedia(savedAvatarUri);
      let cleanup = '';
      if (voiceboxProfileId) {
        try { await api.deleteVoiceboxProfile(voiceboxProfileId); }
        catch {
          onRemoteProfileOrphaned(voiceboxProfileId);
          cleanup = ' A private cleanup will be retried automatically from Settings.';
        }
      }
      setError(`${displayError(e)}${cleanup}`);
      setAllowLocalSave(true);
    } finally { setBusy(''); }
  };

  const title = ['Whose voice?', 'Create the profile', 'Consent comes first', 'Add the real sample', 'Shape the support', 'Ready to begin'][step] ?? '';

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.onboardingPage} keyboardShouldPersistTaps="handled">
          <View style={s.pageHeaderRow}>
            <IconButton label="Previous step" onPress={() => { void previousStep(); }}><ArrowLeft size={22} color={C.text} /></IconButton>
            <Text style={s.stepLabel}>{String(step + 1).padStart(2, '0')} / 06</Text>
          </View>
          <OnboardingProgress step={step} reducedMotion={initialSettings.reducedMotion} />
          <Text style={s.eyebrow}>CREATE YOUR COMPANION</Text>
          <Text style={s.onboardingTitle}>{title}</Text>

          <Reveal key={step} disabled={initialSettings.reducedMotion}>
          {step === 0 ? <View style={s.stack}>
            <Text style={s.lead}>Choose only a voice you are allowed to use. Saanjh will always label the result as AI.</Text>
            <ChoiceCard selected={draft.voiceStatus === 'self'} onPress={() => update({ voiceStatus: 'self', consentAcknowledged: false, consentNote: '' })} title="My own voice" body="Create an AI version of your own voice." icon={<UserRound size={22} color={C.plum700} />} />
            <ChoiceCard selected={draft.voiceStatus === 'consented'} onPress={() => update({ voiceStatus: 'consented', consentAcknowledged: false, consentNote: '' })} title="A living person's voice" body="Explicit, informed, revocable permission is required." icon={<ShieldCheck size={22} color={C.plum700} />} />
            <ChoiceCard selected={draft.voiceStatus === 'memorial'} onPress={() => update({ voiceStatus: 'memorial', consentAcknowledged: false, consentNote: '' })} title="A deceased person's voice" body="Requires legal and ethical authority; always labelled AI memorial." icon={<Heart size={22} color={C.plum700} />} />
          </View> : null}

          {step === 1 ? <View style={s.stack}>
            <View style={s.avatarPicker}><ArtworkAvatar uri={draft.avatarUri} size={108} /><Pressable accessibilityRole="button" accessibilityLabel="Choose companion photo" style={s.avatarAdd} onPress={pickAvatar}><ImageIcon size={18} color={C.inverse} /></Pressable></View>
            <Text style={s.helperCentered}>Optional photo. Otherwise, Saanjh uses its botanical emblem.</Text>
            <Field label="COMPANION NAME" value={draft.name} onChangeText={(name) => update({ name })} placeholder="Enter a name" />
            <Text style={s.fieldLabel}>RELATIONSHIP</Text>
            <View style={s.chipRow}>{RELATIONSHIPS.map((item) => <Chip key={item.id} label={item.label} selected={draft.relationship === item.id} onPress={() => update({ relationship: item.id })} />)}</View>
            {draft.relationship === 'other' ? <Field label="DESCRIBE THE RELATIONSHIP" value={draft.customRelationship} onChangeText={(customRelationship) => update({ customRelationship })} placeholder="For example, coach" /> : null}
          </View> : null}

          {step === 2 ? <View style={s.stack}>
            <Image source={consentIllustration} style={s.consentArt} />
            <Notice
              icon={<ShieldCheck size={22} color={C.plum500} />}
              title={draft.voiceStatus === 'memorial' ? 'AI memorial, never “actually them”' : 'Permission before imitation'}
              body={draft.voiceStatus === 'self' ? 'You confirm this is your own voice and you choose to clone it.' : draft.voiceStatus === 'consented' ? 'The living speaker must have explicitly agreed to this exact use.' : 'You accept responsibility for having the right to use this sample. The experience stays clearly labelled as AI memorial comfort.'}
            />
            {draft.voiceStatus === 'consented' ? <Field label="HOW WAS CONSENT GIVEN?" value={draft.consentNote} onChangeText={(consentNote) => update({ consentNote })} placeholder="Record when and how they agreed, including revocation" multiline /> : null}
            {draft.voiceStatus === 'memorial' ? <Field label="WHY ARE YOU AUTHORISED TO USE THIS RECORDING?" value={draft.consentNote} onChangeText={(consentNote) => update({ consentNote })} placeholder="Record your legal and ethical basis for this memorial use" multiline /> : null}
            <Pressable accessibilityRole="checkbox" accessibilityLabel="Confirm voice consent" accessibilityState={{ checked: draft.consentAcknowledged }} onPress={() => update({ consentAcknowledged: !draft.consentAcknowledged })} style={[s.consentCheck, draft.consentAcknowledged && s.consentCheckActive]}>
              <View style={[s.checkbox, draft.consentAcknowledged && s.checkboxActive]}>{draft.consentAcknowledged ? <Check size={16} color={C.inverse} strokeWidth={3} /> : null}</View>
              <Text style={s.consentCheckText}>{draft.voiceStatus === 'memorial' ? 'I understand this will be an AI memorial voice and accept responsibility for this use.' : 'I confirm the voice owner has knowingly agreed to cloning and playback in Saanjh.'}</Text>
            </Pressable>
          </View> : null}

          {step === 3 ? <View style={s.stack}>
            <Text style={s.lead}>Use 5–10 seconds of clear speech with no music or other voices. A shorter clean sample responds faster, and the transcript must match exactly.</Text>
            <View style={s.sampleGrid}>
              <BotanicalSampleActionCard
                variant="record"
                title={recorderState.isRecording ? `Stop · ${Math.round(recorderState.durationMillis / 1000)}s` : 'Record sample'}
                subtitle={recorderState.isRecording ? 'Tap when you are finished' : 'Use your microphone'}
                eyebrow="RECORD"
                icon={recorderState.isRecording ? <Square size={25} fill={C.inverse} color={C.inverse} /> : <Mic size={27} color={C.plum700} />}
                onPress={() => { void toggleRecord(); }}
                active={recorderState.isRecording}
                reducedMotion={initialSettings.reducedMotion}
              />
              <BotanicalSampleActionCard
                variant="import"
                title="Import audio"
                subtitle="Choose a saved recording"
                eyebrow="IMPORT"
                icon={<Upload size={27} color={C.plum700} />}
                onPress={() => { void pickAudio(); }}
                disabled={recorderState.isRecording}
                reducedMotion={initialSettings.reducedMotion}
              />
            </View>
            {draft.sampleUri ? <View style={s.sampleReady}>
              <FileAudio size={21} color={C.success} />
              <View style={{ flex: 1 }}><Text style={s.sampleReadyTitle}>Sample ready</Text><Text numberOfLines={1} style={s.sampleReadyName}>{draft.sampleName}</Text></View>
              <IconButton label="Play sample" onPress={() => { samplePlayer.seekTo(0); samplePlayer.play(); }}><Play size={19} color={C.plum700} fill={C.plum700} /></IconButton>
            </View> : null}
            <Field label="EXACT WORDS IN THE SAMPLE" value={draft.transcript} onChangeText={(transcript) => update({ transcript })} placeholder="Type or transcribe exactly what is spoken" multiline />
            {draft.sampleUri ? <Button secondary label="Transcribe sample" onPress={transcribe} icon={<AudioLines size={19} color={C.plum700} />} /> : null}
            <Text style={s.helper}>The sample is used only to create the AI voice you approved.</Text>
          </View> : null}

          {step === 4 ? <View style={s.stack}>
            <Text style={s.lead}>These notes guide the AI model. They do not invent memories or change the cloned voice itself.</Text>
            <Text style={s.fieldLabel}>HOW SHOULD THE COMPANION SPEAK?</Text>
            <View style={s.chipRow}>{TRAITS.map((trait) => <Chip key={trait} label={trait} selected={draft.traits.includes(trait)} onPress={() => update({ traits: draft.traits.includes(trait) ? draft.traits.filter((item) => item !== trait) : [...draft.traits, trait] })} />)}</View>
            <Field label="WHAT SHOULD THEY CALL YOU?" value={draft.addressAs} onChangeText={(addressAs) => update({ addressAs })} placeholder="Optional—such as bro or beta" />
            <Field label="HELPFUL WHEN…" value={draft.helpfulWhen} onChangeText={(helpfulWhen) => update({ helpfulWhen })} placeholder="What kind of support helps?" multiline />
            <Field label="PLEASE AVOID…" value={draft.avoid} onChangeText={(avoid) => update({ avoid })} placeholder="Topics, phrases, or styles to avoid" multiline />
            <Notice title="A companion, not a clinician" body="Saanjh should support reflection without diagnosing, replacing professional care, or encouraging dependency." />
          </View> : null}

          {step === 5 ? <View style={s.stack}>
            <Text style={s.lead}>Your companion is ready. Saanjh connects privately and automatically whenever an AI response is needed.</Text>
            <Image source={homeArt} style={s.readyArt} />
            <Notice icon={<ShieldCheck size={21} color={C.plum500} />} title="Private by design" body="Your journal, moods, and companion notes stay on this phone. Voice and AI processing happens only when you choose to use it." />
          </View> : null}
          </Reveal>

          {busy ? <View style={s.busyRow}><ActivityIndicator color={C.plum700} /><Text style={s.busyText}>{busy}</Text></View> : null}
          {error ? <View style={s.errorBox}><CircleAlert size={18} color={C.danger} /><Text style={s.errorText}>{error}</Text></View> : null}
          <View style={s.footerActions}>
            {step < 5 ? <Button label="Continue" onPress={next} icon={<ArrowRight size={19} color={C.inverse} />} /> : <>
              <Button label="Create and clone voice" onPress={() => { void complete(true); }} disabled={Boolean(busy)} icon={<Sparkles size={19} color={C.inverse} />} />
              <Button secondary label={allowLocalSave ? 'Create without voice cloning' : 'Create profile; clone later'} onPress={() => { void complete(false); }} disabled={Boolean(busy)} />
            </>}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function TabButton({ active, label, Icon, onPress, reducedMotion }: { active: boolean; label: string; Icon: typeof Home; onPress: () => void; reducedMotion: boolean }) {
  const focus = useRef(new Animated.Value(active ? 1 : 0)).current;
  useEffect(() => {
    if (reducedMotion) {
      focus.setValue(active ? 1 : 0);
      return;
    }
    const animation = Animated.spring(focus, { toValue: active ? 1 : 0, damping: 16, stiffness: 190, mass: .72, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [active, focus, reducedMotion]);
  return (
    <Pressable accessibilityRole="tab" accessibilityLabel={label} onPress={onPress} style={s.tabItem} accessibilityState={{ selected: active }}>
      <Animated.View style={[s.tabIconWrap, active && s.tabIconWrapActive, { transform: [{ scale: focus.interpolate({ inputRange: [0, 1], outputRange: [.92, 1] }) }] }]}>
        <Icon size={20} color={active ? C.inverse : C.textSecondary} strokeWidth={active ? 2.35 : 1.75} />
      </Animated.View>
      <Text style={[s.tabLabel, active && s.tabLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function TabBar({ active, onNavigate, reducedMotion }: { active: TabRoute; onNavigate: (route: TabRoute) => void; reducedMotion: boolean }) {
  const tabs: Array<{ id: TabRoute; label: string; icon: typeof Home }> = [
    { id: 'today', label: 'Today', icon: Home },
    { id: 'companion', label: 'Companion', icon: UserRound },
    { id: 'rituals', label: 'Rituals', icon: Sparkles },
    { id: 'journal', label: 'Journal', icon: BookOpen },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];
  return <View style={s.tabBar}>{tabs.map(({ id, label, icon: Icon }) => <TabButton key={id} active={active === id} label={label} Icon={Icon} reducedMotion={reducedMotion} onPress={() => onNavigate(id)} />)}</View>;
}

function Shell({ active, onNavigate, children, reducedMotion }: { active: TabRoute; onNavigate: (route: TabRoute) => void; children: React.ReactNode; reducedMotion: boolean }) {
  return <SafeAreaView style={s.safe}><StatusBar style="dark" /><View style={s.shellContent}>{children}</View><TabBar active={active} onNavigate={onNavigate} reducedMotion={reducedMotion} /></SafeAreaView>;
}

function TodayScreen({ data, go, start }: { data: AppData; go: (route: Route) => void; start: (kind: SessionKind) => void }) {
  const companion = data.companion!;
  const lastMood = data.moods[0];
  return <ScrollView contentContainerStyle={s.mainPage}>
    <Reveal disabled={data.settings.reducedMotion}>
      <View style={s.todayTop}><Brand /><AIChip /></View>
      <Text style={s.eyebrow}>A QUIET PLACE FOR TODAY</Text>
      <Text style={s.heroTitle}>How are you arriving?</Text>
      <Text style={s.lead}>{lastMood ? `Your latest check-in was “${lastMood.mood}.” You can begin wherever you are now.` : 'There is no right way to feel. Start with a check-in or a conversation.'}</Text>
    </Reveal>

    <Reveal delay={140} disabled={data.settings.reducedMotion}>
    <ImageBackground source={homeArt} style={s.heroCard} imageStyle={s.heroCardImage}>
      <LinearGradient colors={['rgba(243,238,229,.98)', 'rgba(243,238,229,.82)', 'rgba(243,238,229,.05)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      <View style={s.heroCardCopy}>
        <AIChip label={companion.voiceStatus === 'memorial' ? 'AI memorial voice' : 'AI-generated voice'} />
        <Text style={s.cardDisplay} numberOfLines={1} ellipsizeMode="tail">{companion.name}</Text>
        <Text style={s.cardBody}>{companion.voiceboxProfileId ? 'Ready for a mindful conversation.' : 'Finish the voice setup when you feel ready.'}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Start voice session" onPress={() => go('precall')} style={s.compactCall}><Phone size={19} color={C.inverse} fill={C.inverse} /><Text style={s.compactCallText}>Start voice session</Text></Pressable>
      </View>
    </ImageBackground>
    </Reveal>

    <Reveal delay={270} disabled={data.settings.reducedMotion}>
      <Text style={s.sectionTitle}>For right now</Text>
      <View style={s.actionGrid}>
        <BotanicalActionCard accessibilityLabel="Check in" art={moodArt} icon={<Heart size={21} color={C.plum700} />} onPress={() => go('mood')} subtitle="Name how you feel." title="Check in" />
        <BotanicalActionCard accessibilityLabel="Start text chat" art={journalArt} icon={<MessageCircle size={21} color={C.warning} />} onPress={() => start('text')} subtitle="Write, then hear the reply." title="Text chat" tone="clay" />
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Open journal" style={({ pressed }) => [s.journalBanner, pressed && s.pressed]} onPress={() => go('journal')}><BookHeart size={22} color={C.plum700} /><View style={{ flex: 1 }}><Text style={s.journalBannerTitle}>{data.journal.length ? 'Return to your journal' : 'Your journal is empty'}</Text><Text style={s.journalBannerBody}>{data.journal.length ? 'Only the notes you chose to save.' : 'Write something for yourself—nothing is auto-created.'}</Text></View><ChevronRight size={20} color={C.textSecondary} /></Pressable>
    </Reveal>
  </ScrollView>;
}

function MoodScreen({ onBack, onSave, reducedMotion }: { onBack: () => void; onSave: (entry?: MoodEntry) => void; reducedMotion: boolean }) {
  const [score, setScore] = useState<1 | 2 | 3 | 4 | 5>();
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const selected = MOODS.find((mood) => mood.score === score);
  return <SafeAreaView style={s.safe}><StatusBar style="dark" /><ScrollView contentContainerStyle={s.mainPage} keyboardShouldPersistTaps="handled">
    <PageHeader onBack={onBack} eyebrow="MOOD CHECK-IN" title="How are you feeling?" />
    <ImageBackground source={moodArt} style={s.moodVisual} imageStyle={s.moodVisualImage}>
      <LinearGradient colors={['rgba(243,238,229,.88)', 'rgba(243,238,229,.08)', 'rgba(243,238,229,.94)']} locations={[0, .52, 1]} style={StyleSheet.absoluteFill} />
      <Text style={s.moodVisualLead}>There is no right or wrong answer. You can also leave this blank.</Text>
      <View style={s.moodRow}>{MOODS.map((mood) => <MoodOption key={mood.score} mood={mood} selected={score === mood.score} reducedMotion={reducedMotion} onPress={() => { setScore(mood.score); void haptic(); }} />)}</View>
    </ImageBackground>
    <Text style={s.fieldLabel}>WHAT'S PRESENT?</Text>
    <View style={s.chipRow}>{FEELINGS.map((tag) => <Chip key={tag} label={tag} selected={tags.includes(tag)} onPress={() => setTags(tags.includes(tag) ? tags.filter((item) => item !== tag) : [...tags, tag])} />)}</View>
    <Field label="OPTIONAL NOTE" value={note} onChangeText={setNote} placeholder="A few private words, if you want" multiline />
    <Button label={selected || tags.length || note.trim() ? 'Save check-in' : 'Continue without answering'} onPress={() => onSave(selected || tags.length || note.trim() ? { id: uid('mood'), mood: selected?.label ?? 'Check-in', score, tags, note: note.trim() || undefined, context: 'check-in', createdAt: now() } : undefined)} />
  </ScrollView></SafeAreaView>;
}

function JournalScreen({ entries, onAdd, onDelete }: { entries: JournalEntry[]; onAdd: (entry: JournalEntry) => void; onDelete: (id: string) => void }) {
  const [open, setOpen] = useState(false); const [title, setTitle] = useState(''); const [body, setBody] = useState('');
  const save = () => { if (!body.trim()) return; const timestamp = now(); onAdd({ id: uid('journal'), title: title.trim() || undefined, body: body.trim(), createdAt: timestamp, updatedAt: timestamp }); setTitle(''); setBody(''); setOpen(false); };
  return <>
    <ScrollView contentContainerStyle={s.mainPage}>
      <PageHeader eyebrow="PRIVATE REFLECTIONS" title="Your journal" right={<IconButton label="New journal entry" onPress={() => setOpen(true)}><Plus size={22} color={C.text} /></IconButton>} />
      {entries.length === 0 ? <View style={s.emptyState}><Image source={journalArt} style={s.emptyArt} /><Text style={s.emptyTitle}>Your journal is empty.</Text><Text style={s.emptyBody}>Saanjh never fabricates reflections. Only notes you choose to save will appear here.</Text><Button label="Write the first note" onPress={() => setOpen(true)} icon={<Plus size={18} color={C.inverse} />} /></View> : <View style={s.entryList}>{entries.map((entry) => <View key={entry.id} style={s.entryCard}><View style={{ flex: 1 }}><Text style={s.entryDate}>{new Date(entry.createdAt).toLocaleDateString()}</Text><Text style={s.entryTitle}>{entry.title || 'Private note'}</Text><Text style={s.entryBody}>{entry.body}</Text></View><IconButton label="Delete note" onPress={() => { void confirmAction('Delete this note?', 'This removes it from this device.', 'Delete').then((confirmed) => { if (confirmed) onDelete(entry.id); }); }}><Trash2 size={18} color={C.danger} /></IconButton></View>)}</View>}
    </ScrollView>
    <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}><View style={s.modalBackdrop}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.sheet}><View style={s.sheetHeader}><Text style={s.sheetTitle}>A note for yourself</Text><IconButton label="Close" onPress={() => setOpen(false)}><X size={21} color={C.text} /></IconButton></View><Field label="TITLE · OPTIONAL" value={title} onChangeText={setTitle} placeholder="Name this moment" /><Field label="YOUR WORDS" value={body} onChangeText={setBody} placeholder="Write what is true for you" multiline /><Button label="Save private note" onPress={save} disabled={!body.trim()} /></KeyboardAvoidingView></View></Modal>
  </>;
}

function CompanionScreen({ data, updateProfile, go }: { data: AppData; updateProfile: (profile?: CompanionProfile) => void; go: (route: Route) => void; onRemoteProfileOrphaned: (profileId: string) => void }) {
  const profile = data.companion!;
  const [memory, setMemory] = useState(''); const [busy, setBusy] = useState(''); const [error, setError] = useState('');
  const player = useAudioPlayer(null);
  const syncVoice = async () => {
    if (!profile.voiceSampleUri || !profile.voiceSampleName || !profile.sampleTranscript) { setError('The saved sample and its exact transcript are required before syncing.'); return; }
    setBusy('Preparing the consented voice…'); setError('');
    try {
      const file = await makeAudioFile(profile.voiceSampleUri, profile.voiceSampleName);
      const voiceProfile = await api.createVoiceboxProfileWithSample(
        { name: profile.name, language: 'en', voice_type: 'cloned' },
        file,
        profile.sampleTranscript,
        {
          onUploadProgress: (progress) => setBusy(fileTransferLabel(progress, 'Preparing the familiar AI voice…')),
        },
      );
      const remoteId = remoteVoiceProfileId(voiceProfile);
      updateProfile({ ...profile, voiceboxProfileId: remoteId });
      void haptic('success');
    } catch (e) {
      setError(displayError(e));
    } finally { setBusy(''); }
  };
  const preview = async () => {
    if (!profile.voiceboxProfileId) { setError('Sync the companion voice first.'); return; }
    if (!profile.sampleTranscript?.trim()) { setError('The real sample transcript is required for a preview.'); return; }
    setBusy('Generating a real AI voice preview…'); setError('');
    try {
      const result = await gatewayVoice(profile.voiceboxProfileId, profile.sampleTranscript.trim(), { persistent: false });
      player.replace(result.audioUrl);
      player.play();
    } catch (e) {
      const message = displayError(e);
      if (/profile.+not found|voice profile.+missing/i.test(message)) updateProfile({ ...profile, voiceboxProfileId: undefined });
      setError(message);
    } finally { setBusy(''); }
  };
  const saveMemories = async (memories: string[]) => {
    setError('');
    updateProfile({ ...profile, memories });
    void haptic('success');
  };
  const addMemory = async () => { if (!memory.trim()) return; const next = [memory.trim(), ...profile.memories]; await saveMemories(next); setMemory(''); };
  return <ScrollView contentContainerStyle={s.mainPage} keyboardShouldPersistTaps="handled">
    <PageHeader eyebrow="YOUR COMPANION" title={profile.name} right={<AIChip label={profile.voiceStatus === 'memorial' ? 'AI memorial' : 'AI voice'} />} />
    <View style={s.profileHero}><ArtworkAvatar uri={profile.avatarUri} size={148} /><View style={s.profileStatus}><ShieldCheck size={15} color={C.success} /><Text style={s.profileStatusText}>{profile.voiceStatus === 'self' ? 'Your own voice' : profile.voiceStatus === 'consented' ? 'Consent recorded' : 'AI memorial voice'}</Text></View></View>
    <Notice title="Always AI-generated" body={profile.voiceStatus === 'memorial' ? `This is an AI memorial voice inspired by ${profile.name}, never the actual person.` : `Saanjh must never claim to literally be ${profile.name}.`} />
    <View style={s.voicePanel}><View style={{ flex: 1 }}><Text style={s.voicePanelTitle}>AI voice</Text><Text style={s.voicePanelBody}>{profile.voiceboxProfileId ? 'Your familiar AI voice is ready.' : 'Your sample is safe on this phone and ready to prepare.'}</Text></View><View style={[s.statusDot, !profile.voiceboxProfileId && s.statusDotOff]} /></View>
    {profile.voiceboxProfileId ? <Button label="Hear a voice preview" onPress={() => { void preview(); }} disabled={Boolean(busy)} icon={<Volume2 size={19} color={C.inverse} />} /> : <Button label="Prepare AI voice" onPress={() => { void syncVoice(); }} disabled={Boolean(busy)} icon={<Sparkles size={19} color={C.inverse} />} />}
    {busy ? <View style={s.busyRow}><ActivityIndicator color={C.plum700} /><Text style={s.busyText}>{busy}</Text></View> : null}
    {error ? <View style={s.errorBox}><CircleAlert size={18} color={C.danger} /><Text style={s.errorText}>{error}</Text></View> : null}
    <Text style={s.sectionTitle}>How they support you</Text>
    <View style={s.chipRow}>{profile.traits.length ? profile.traits.map((trait) => <View key={trait} style={[s.chip, s.chipSelected]}><Text style={s.chipTextSelected}>{trait}</Text></View>) : <Text style={s.emptyInline}>No style traits added yet.</Text>}</View>
    <Text style={s.sectionTitle}>Approved memories</Text>
    <Text style={s.helper}>Only details you enter here are allowed into the AI prompt.</Text>
    <View style={s.inlineInput}><TextInput value={memory} onChangeText={setMemory} placeholder="Add one real detail" placeholderTextColor={C.placeholder} style={s.inlineTextInput} /><Pressable accessibilityRole="button" accessibilityLabel="Add approved memory" onPress={() => { void addMemory(); }} style={s.inlineAdd}><Plus size={20} color={C.inverse} /></Pressable></View>
    {profile.memories.length ? profile.memories.map((item, index) => <View key={`${item}-${index}`} style={s.memoryRow}><BookHeart size={18} color={C.plum500} /><Text style={s.memoryText}>{item}</Text><IconButton label="Remove memory" onPress={() => { void saveMemories(profile.memories.filter((_, i) => i !== index)); }}><X size={17} color={C.textSecondary} /></IconButton></View>) : <Text style={s.emptyInline}>No memories saved.</Text>}
    <Button secondary label="App settings" onPress={() => go('settings')} icon={<SettingsIcon size={18} color={C.plum700} />} />
  </ScrollView>;
}

function SettingsScreen({ data, initialAccessToken, onSave, onSafety, onDeleteCompanion, onReset, onRetryRemoteCleanup }: {
  data: AppData;
  initialAccessToken: string;
  onSave: (settings: AppSettings, accessToken: string) => Promise<void>;
  onSafety: () => void;
  onDeleteCompanion: () => void;
  onReset: () => void;
  onRetryRemoteCleanup: () => Promise<string>;
}) {
  const [settings, setSettings] = useState<AppSettings>(() => sanitizedSettings(data.settings)); const [accessToken, setAccessToken] = useState(initialAccessToken); const [busy, setBusy] = useState(''); const [result, setResult] = useState(''); const [health, setHealth] = useState<HealthResponse>();
  const update = (patch: Partial<AppSettings>) => setSettings((current) => ({ ...current, ...patch }));
  const testServices = async () => { setBusy('Testing Saanjh services…'); setResult(''); try { configureSaanjhApi({ baseUrl: settings.apiBaseUrl, accessToken }); const current = await api.health(); setHealth(current); setResult(serviceSummary(current, settings.apiBaseUrl)); } catch (e) { setResult(displayError(e)); } finally { setBusy(''); } };
  const saveSettings = async () => { setBusy('Saving securely on this phone…'); setResult(''); try { await onSave(sanitizedSettings(settings), accessToken); setResult('Connection and privacy settings saved on this phone.'); void haptic('success'); } catch (e) { setResult(displayError(e)); } finally { setBusy(''); } };
  return <ScrollView contentContainerStyle={s.mainPage} keyboardShouldPersistTaps="handled">
    <PageHeader eyebrow="CONTROL & TRANSPARENCY" title="Settings" />
    <Text style={s.sectionTitle}>Privacy & accessibility</Text>
    <View style={s.switchRow}><View style={{ flex: 1 }}><Text style={s.switchTitle}>Keep session transcripts</Text><Text style={s.switchBody}>Off by default. When off, spoken and typed turns are discarded after the session.</Text></View><Switch value={settings.allowTranscripts} onValueChange={(allowTranscripts) => update({ allowTranscripts })} trackColor={{ false: C.fog, true: C.sage }} thumbColor={settings.allowTranscripts ? C.plum700 : C.ivory} /></View>
    <View style={s.switchRow}><View style={{ flex: 1 }}><Text style={s.switchTitle}>Reduce ambient motion</Text><Text style={s.switchBody}>Stops breathing and waveform animation where possible.</Text></View><Switch value={settings.reducedMotion} onValueChange={(reducedMotion) => update({ reducedMotion })} trackColor={{ false: C.fog, true: C.sage }} thumbColor={settings.reducedMotion ? C.plum700 : C.ivory} /></View>
    <Button label="Save settings" onPress={() => { void saveSettings(); }} disabled={Boolean(busy)} />
    <Text style={s.sectionTitle}>Safety & data</Text>
    {data.pendingVoiceboxProfileIds.length ? <><Notice tone="peach" title="Voice cleanup pending" body="An interrupted voice setup still needs to be removed securely." /><Button secondary label="Retry secure cleanup" onPress={() => { setBusy('Cleaning up securely…'); void onRetryRemoteCleanup().then(setResult).finally(() => setBusy('')); }} disabled={Boolean(busy)} /></> : null}
    <Pressable accessibilityRole="button" accessibilityLabel="Immediate support" style={s.settingsRow} onPress={onSafety}><LifeBuoy size={21} color={C.plum700} /><View style={{ flex: 1 }}><Text style={s.settingsRowTitle}>Immediate support</Text><Text style={s.settingsRowBody}>Emergency guidance and AI limitations.</Text></View><ChevronRight size={20} color={C.textSecondary} /></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Delete companion and AI voice" style={s.settingsRow} onPress={onDeleteCompanion}><Trash2 size={21} color={C.danger} /><View style={{ flex: 1 }}><Text style={s.settingsRowTitle}>Delete companion and AI voice</Text><Text style={s.settingsRowBody}>Securely removes the created voice, then clears its data from this phone.</Text></View><ChevronRight size={20} color={C.textSecondary} /></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Reset all local Saanjh data" style={s.settingsRow} onPress={onReset}><RefreshCw size={21} color={C.danger} /><View style={{ flex: 1 }}><Text style={s.settingsRowTitle}>Reset all local Saanjh data</Text><Text style={s.settingsRowBody}>Removes settings, moods, journal, and session history from this device.</Text></View><ChevronRight size={20} color={C.textSecondary} /></Pressable>
    <Notice icon={<LockKeyhole size={21} color={C.plum500} />} title="Stored on this phone" body="Companion notes, journals, moods, and session history stay in this app's private device storage." />
  </ScrollView>;
}

function PreCallScreen({ data, onBack, onStart }: { data: AppData; onBack: () => void; onStart: (intention: string, moodScore?: 1 | 2 | 3 | 4 | 5) => void }) {
  const [intention, setIntention] = useState(''); const [moodScore, setMoodScore] = useState<1 | 2 | 3 | 4 | 5>(); const profile = data.companion!;
  const ready = Boolean(profile.voiceboxProfileId && data.settings.apiBaseUrl);
  return <SafeAreaView style={s.safe}><StatusBar style="dark" /><ScrollView contentContainerStyle={s.mainPage} keyboardShouldPersistTaps="handled">
    <PageHeader onBack={onBack} eyebrow="BEFORE THE SESSION" title="You're in control." />
    <View style={s.preCallProfile}><View style={s.preCallAura}><AmbientRings size={136} active={!data.settings.reducedMotion} /></View><ArtworkAvatar uri={profile.avatarUri} size={104} /><View style={{ flex: 1 }}><Text style={s.preCallName} numberOfLines={1} ellipsizeMode="tail">{profile.name}</Text><AIChip label={profile.voiceStatus === 'memorial' ? 'AI memorial voice' : 'AI-generated voice'} /></View></View>
    <Text style={s.fieldLabel}>HOW ARE YOU ARRIVING? · OPTIONAL</Text>
    <View style={s.moodRow}>{MOODS.map((mood) => <MoodOption key={mood.score} mood={mood} selected={moodScore === mood.score} reducedMotion={data.settings.reducedMotion} onPress={() => setMoodScore(mood.score)} />)}</View>
    <Field label="WHAT WOULD HELP RIGHT NOW?" value={intention} onChangeText={setIntention} placeholder="Optional—such as “I need to talk it through”" multiline />
    <View style={s.readinessList}><View style={s.readinessRow}>{profile.voiceboxProfileId ? <Check size={20} color={C.success} /> : <CircleAlert size={20} color={C.warning} />}<Text style={s.readinessText}>{profile.voiceboxProfileId ? 'Your AI voice is ready' : 'Finish creating the AI voice first'}</Text></View></View>
    <Notice tone="night" icon={<ShieldCheck size={21} color={C.peach300} />} title="This is a turn-based AI session" body="Saanjh listens only after you tap, then prepares an AI reply in the familiar voice. It is not the person and not a live phone call." />
    <Button label="Start AI voice session" onPress={() => onStart(intention.trim(), moodScore)} disabled={!ready} icon={<Phone size={19} color={C.inverse} fill={C.inverse} />} />
    {!ready ? <Text style={s.helperCentered}>Finish the voice setup from Companion first.</Text> : null}
  </ScrollView></SafeAreaView>;
}

function Wave({ active, reducedMotion }: { active: boolean; reducedMotion: boolean }) {
  const values = useRef(Array.from({ length: 13 }, () => new Animated.Value(0.35))).current;
  useEffect(() => {
    if (!active || reducedMotion) { values.forEach((value) => value.setValue(0.35)); return; }
    const animations = values.map((value, index) => Animated.loop(Animated.sequence([
      Animated.delay(index * 45),
      Animated.timing(value, { toValue: 1, duration: 360 + (index % 4) * 70, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(value, { toValue: 0.3, duration: 420, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
    ])));
    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [active, reducedMotion, values]);
  return <View style={s.wave}>{values.map((value, index) => <Animated.View key={index} style={[s.waveBar, { height: 18 + ((index * 17) % 44), transform: [{ scaleY: value }] }]} />)}</View>;
}

type SessionPhase = 'ready' | 'recording' | 'transcribing' | 'thinking' | 'synthesizing' | 'downloading' | 'speaking' | 'error';

function SessionScreen({ data, session, onEnd, onCrisis }: { data: AppData; session: SessionEntry; onEnd: (messages: ChatMessage[]) => void; onCrisis: (messages: ChatMessage[]) => void }) {
  const profile = data.companion!; const [messages, setMessages] = useState<ChatMessage[]>(() => session.intention ? [{ id: uid('message'), role: 'user', content: `What would help in this session: ${session.intention}`, modality: 'text', createdAt: now() }] : []); const [typed, setTyped] = useState(''); const [phase, setPhase] = useState<SessionPhase>('ready'); const [progressStage, setProgressStage] = useState<VoiceGenerationStage>(); const [progressStartedAt, setProgressStartedAt] = useState<number>(); const [progressDetail, setProgressDetail] = useState(''); const [error, setError] = useState(''); const [seconds, setSeconds] = useState(0);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY); const rec = useAudioRecorderState(recorder); const player = useAudioPlayer(null); const playerStatus = useAudioPlayerStatus(player);
  const scrollRef = useRef<ScrollView>(null);
  const requestRef = useRef<AbortController | undefined>(undefined); const voiceGenerationIdRef = useRef<string | undefined>(undefined); const recordingActiveRef = useRef(false); const endingRef = useRef(false); const aliveRef = useRef(true);
  useEffect(() => { const timer = setInterval(() => setSeconds((value) => value + 1), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => { if (phase === 'speaking' && !playerStatus.playing && playerStatus.currentTime > 0) { setPhase('ready'); setProgressStage(undefined); setProgressStartedAt(undefined); setProgressDetail(''); } }, [phase, playerStatus.playing, playerStatus.currentTime]);
  useEffect(() => { const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80); return () => clearTimeout(timer); }, [messages]);
  useEffect(() => () => {
    aliveRef.current = false;
    requestRef.current?.abort();
    if (recordingActiveRef.current) void recorder.stop().catch(() => undefined);
    void setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
    player.pause();
  }, [player, recorder]);
  const append = (message: ChatMessage) => { setMessages((current) => [...current, message]); return message; };

  const processTurn = async (content: string, modality: 'text' | 'voice') => {
    // Do not gate this on the render-time `recording` phase. After recorder.stop()
    // the transcription promise completes inside the previous render's closure,
    // so `phase` can still be "recording" even though the recorder is stopped.
    const clean = content.trim(); if (!clean || endingRef.current || phase === 'thinking' || phase === 'synthesizing' || phase === 'downloading' || phase === 'speaking') return;
    setError('');
    const userMessage: ChatMessage = { id: uid('message'), role: 'user', content: clean, modality, createdAt: now() };
    const context = [...messages, userMessage]; append(userMessage); setTyped('');
    if (DISTRESS_PATTERN.test(clean)) { onCrisis(context); return; }
    const controller = new AbortController(); requestRef.current = controller;
    const startedAt = Date.now();
    setProgressStartedAt(startedAt);
    setProgressStage('thinking');
    setProgressDetail('Writing a short, thoughtful reply.');
    setPhase('thinking');
    try {
      const turn = await api.localChat({
        companion: companionContext(profile),
        history: messages.map((message) => ({ role: message.role, content: message.content })),
        message: clean,
      }, { signal: controller.signal });
      if (controller.signal.aborted || !aliveRef.current || endingRef.current) return;
      const assistant: ChatMessage = { id: uid('message'), role: 'assistant', content: turn.reply, modality: 'text', createdAt: now() };
      setMessages((current) => [...current, assistant]);
      if (profile.voiceboxProfileId) {
        setPhase('synthesizing');
        setProgressStage('preparing_voice');
        setProgressDetail('Preparing the familiar AI voice. The first response after startup can take longer.');
        try {
          const audio = await gatewayVoice(profile.voiceboxProfileId, assistant.content, {
            signal: controller.signal,
            persistent: data.settings.allowTranscripts,
            onProgress: (progress) => {
              voiceGenerationIdRef.current = progress.generationId;
              if (progress.stage === 'downloading') {
                setPhase('downloading');
                setProgressStage('downloading');
                setProgressDetail('The finished voice is being saved locally on this phone.');
              } else {
                setPhase('synthesizing');
                setProgressStage('preparing_voice');
                const status = progress.status.replace(/_/g, ' ');
                setProgressDetail(status === 'loading model' ? 'The voice is warming up for this first response.' : status === 'processing' ? 'The voice is taking shape.' : 'Preparing the voice…');
              }
            },
          });
          if (controller.signal.aborted || !aliveRef.current || endingRef.current) return;
          setMessages((current) => current.map((message) => message.id === assistant.id ? { ...message, audioUri: audio.audioUrl, voiceboxGenerationId: audio.id } : message));
          voiceGenerationIdRef.current = undefined;
          setProgressStage('playing');
          setProgressDetail('The generated reply is now playing from this phone.');
          setPhase('speaking');
          player.replace(audio.audioUrl);
          player.play();
        } catch (voiceError) {
          if (!controller.signal.aborted && aliveRef.current && !endingRef.current) {
            setError(`The written reply is ready, but its voice could not be prepared: ${displayError(voiceError)}`);
            setProgressStage('error');
            setProgressDetail(displayError(voiceError));
            setPhase('error');
          }
        }
      } else {
        setProgressStage(undefined);
        setProgressStartedAt(undefined);
        setPhase('ready');
      }
    } catch (e) {
      if (!controller.signal.aborted && aliveRef.current && !endingRef.current) {
        setError(displayError(e));
        setProgressStage('error');
        setProgressDetail(displayError(e));
        setPhase('error');
      }
    } finally {
      voiceGenerationIdRef.current = undefined;
      if (requestRef.current === controller) requestRef.current = undefined;
    }
  };

  const toggleRecord = async () => {
    if (rec.isRecording) {
      await recorder.stop(); recordingActiveRef.current = false; await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (!recorder.uri) { setError('The recording could not be read.'); setPhase('error'); return; }
      const controller = new AbortController(); requestRef.current = controller;
      setPhase('transcribing');
      setProgressStartedAt(Date.now());
      setProgressStage('transcribing');
      setProgressDetail('Preparing your recording for private transcription.');
      try { const file = await makeAudioFile(recorder.uri, `turn-${Date.now()}.${Platform.OS === 'web' ? 'webm' : 'm4a'}`, Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4'); const transcript = await api.transcribe(file, {}, { signal: controller.signal, onUploadProgress: (progress) => setProgressDetail(fileTransferLabel(progress, 'Listening carefully to your words…')) }); if (!controller.signal.aborted && aliveRef.current && !endingRef.current) { requestRef.current = undefined; await processTurn(transcript, 'voice'); } }
      catch (e) { if (!controller.signal.aborted && aliveRef.current && !endingRef.current) { setError(displayError(e)); setPhase('error'); } }
      finally { if (requestRef.current === controller) requestRef.current = undefined; }
      return;
    }
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) { setError('Microphone permission is needed only while you speak.'); return; }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true }); await recorder.prepareToRecordAsync(); recorder.record(); recordingActiveRef.current = true; setPhase('recording'); void haptic();
  };

  useEffect(() => { if (rec.isRecording && rec.durationMillis >= 60_000) void toggleRecord(); }, [rec.durationMillis, rec.isRecording]);

  const cancelResponse = () => {
    const generationId = voiceGenerationIdRef.current;
    if (generationId) void api.cancelVoiceGeneration(generationId).catch(() => undefined);
    voiceGenerationIdRef.current = undefined;
    requestRef.current?.abort();
    requestRef.current = undefined;
    setProgressStage(undefined);
    setProgressStartedAt(undefined);
    setProgressDetail('');
    setPhase('ready');
    setError('Response cancelled. You can continue whenever you are ready.');
  };

  const endSession = async () => {
    if (endingRef.current) return;
    endingRef.current = true;
    const generationId = voiceGenerationIdRef.current;
    if (generationId) void api.cancelVoiceGeneration(generationId).catch(() => undefined);
    requestRef.current?.abort();
    if (recordingActiveRef.current) { try { await recorder.stop(); } catch { /* recorder may already be closing */ } recordingActiveRef.current = false; }
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
    player.pause(); onEnd(messages);
  };

  const phaseText: Record<SessionPhase, string> = { ready: 'Ready when you are', recording: 'Listening · tap to stop', transcribing: 'Listening to your words', thinking: 'Preparing a reply', synthesizing: 'Preparing the familiar voice', downloading: 'Saving the voice on this phone', speaking: 'AI voice is speaking', error: 'Paused after an error' };
  const active = phase === 'recording' || phase === 'transcribing' || phase === 'thinking' || phase === 'synthesizing' || phase === 'downloading' || phase === 'speaking';
  return <ImageBackground source={sessionArt} style={s.session} resizeMode="cover"><StatusBar style="light" /><LinearGradient colors={['rgba(8,28,25,.20)', 'rgba(8,28,25,.48)', 'rgba(5,20,19,.88)']} style={StyleSheet.absoluteFill} /><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><SafeAreaView style={s.sessionSafe}>
    <View style={s.sessionAura}><AmbientRings size={238} active={!data.settings.reducedMotion} dark /></View>
    <View style={s.sessionTop}><AIChip inverse label={profile.voiceStatus === 'memorial' ? 'AI memorial session' : 'AI voice session'} /><Text style={s.sessionTimer}>{timeLabel(seconds)}</Text></View>
    <Reveal disabled={data.settings.reducedMotion} delay={100}><View style={s.sessionIdentity}><ArtworkAvatar uri={profile.avatarUri} size={82} /><Text style={s.sessionName} numberOfLines={1} ellipsizeMode="tail">{profile.name}</Text><Text style={s.sessionDisclosure}>AI-generated · not the real person</Text></View></Reveal>
    <Wave active={active} reducedMotion={data.settings.reducedMotion} />
    <Text accessibilityLiveRegion="polite" style={s.phaseText}>{phaseText[phase]}{phase === 'recording' ? ` · ${Math.round(rec.durationMillis / 1000)}s` : ''}</Text>
    {progressStage && progressStartedAt ? <VoiceGenerationStatus stage={progressStage} startedAt={progressStartedAt} detail={progressDetail} onCancel={progressStage === 'thinking' || progressStage === 'preparing_voice' || progressStage === 'downloading' ? cancelResponse : undefined} reducedMotion={data.settings.reducedMotion} style={s.sessionProgress} /> : null}
    <ScrollView ref={scrollRef} style={s.captionBox} contentContainerStyle={s.captionContent}>
      {messages.length === 0 ? <Text style={s.captionEmpty}>Captions will appear here during this session. They are {data.settings.allowTranscripts ? 'saved because you enabled transcript history.' : 'discarded when you leave.'}</Text> : messages.map((message) => <View key={message.id} style={[s.message, message.role === 'user' ? s.messageUser : s.messageAI]}><Text style={s.messageRole}>{message.role === 'user' ? 'YOU' : 'AI'}</Text><Text style={s.messageText}>{message.content}</Text>{message.audioUri ? <Pressable accessibilityRole="button" accessibilityLabel="Play this AI voice reply" onPress={() => { player.replace(message.audioUri!); player.play(); setPhase('speaking'); }} style={s.replay}><Volume2 size={15} color={C.peach300} /><Text style={s.replayText}>Play voice</Text></Pressable> : null}</View>)}
    </ScrollView>
    {error ? <View style={s.sessionError}><CircleAlert size={17} color={C.peach300} /><Text style={s.sessionErrorText}>{error}</Text></View> : null}
    <View style={s.composer}><TextInput value={typed} onChangeText={setTyped} placeholder="Type instead…" placeholderTextColor="rgba(252,248,246,.58)" style={s.composerInput} editable={!active} /><Pressable accessibilityRole="button" accessibilityLabel="Send message" onPress={() => { void processTurn(typed, 'text'); }} style={[s.sendButton, (!typed.trim() || active) && { opacity: .4 }]} disabled={!typed.trim() || active}><Send size={19} color={C.inverse} /></Pressable></View>
    <View style={s.sessionControls}><Pressable accessibilityRole="button" accessibilityLabel={rec.isRecording ? 'Stop recording' : 'Start recording'} accessibilityState={{ disabled: active && phase !== 'recording' }} onPress={toggleRecord} disabled={active && phase !== 'recording'} style={[s.micControl, rec.isRecording && s.micControlActive]}>{rec.isRecording ? <Square size={25} color={C.night950} fill={C.night950} /> : <Mic size={27} color={C.night950} />}</Pressable><Pressable accessibilityRole="button" accessibilityLabel="End session" onPress={() => { void endSession(); }} style={s.endControl}><PhoneOff size={26} color={C.inverse} /><Text style={s.endLabel}>End</Text></Pressable></View>
  </SafeAreaView></KeyboardAvoidingView></ImageBackground>;
}

function AftercareScreen({ onSave, onSkip, reducedMotion }: { onSave: (score?: 1 | 2 | 3 | 4 | 5, note?: string) => void; onSkip: () => void; reducedMotion: boolean }) {
  const [score, setScore] = useState<1 | 2 | 3 | 4 | 5>(); const [note, setNote] = useState('');
  return <SafeAreaView style={s.safe}><StatusBar style="dark" /><ScrollView contentContainerStyle={s.mainPage} keyboardShouldPersistTaps="handled">
    <PageHeader eyebrow="AFTER THE SESSION" title="You showed up for yourself." />
    <Text style={s.lead}>How do you feel now? This check-in is optional.</Text>
    <View style={s.moodRow}>{MOODS.map((mood) => <MoodOption key={mood.score} mood={mood} selected={score === mood.score} reducedMotion={reducedMotion} onPress={() => setScore(mood.score)} />)}</View>
    <Field label="PRIVATE AFTERCARE NOTE · OPTIONAL" value={note} onChangeText={setNote} placeholder="Only save what you choose" multiline />
    <Notice title="No pressure to continue" body="You can close the session now. Saanjh does not use streaks, guilt, or prompts that make it hard to leave." />
    <Button label="Save and finish" onPress={() => onSave(score, note.trim() || undefined)} />
    <Button secondary label="Finish without saving" onPress={onSkip} />
  </ScrollView></SafeAreaView>;
}

function SafetyScreen({ onBack }: { onBack: () => void }) {
  return <SafeAreaView style={[s.safe, { backgroundColor: C.peach100 }]}><StatusBar style="dark" /><ScrollView contentContainerStyle={s.mainPage}>
    <PageHeader onBack={onBack} eyebrow="IMMEDIATE SUPPORT" title="You deserve human help right now." />
    <Notice tone="peach" icon={<CircleAlert size={24} color={C.danger} />} title="If you may act now or are in immediate danger" body="Call emergency services or go to the nearest emergency department. If possible, move toward a trusted person and away from anything you could use to hurt yourself." />
    <Pressable accessibilityRole="button" accessibilityLabel="Call 112 in India" style={s.emergencyCard} onPress={() => { void Linking.openURL('tel:112'); }}><View style={s.emergencyIcon}><Phone size={26} color={C.inverse} fill={C.inverse} /></View><View style={{ flex: 1 }}><Text style={s.emergencyTitle}>Call 112 in India</Text><Text style={s.emergencyBody}>Pan-India emergency response for police, fire, and medical help.</Text></View><ChevronRight size={22} color={C.danger} /></Pressable>
    <Text style={s.sectionTitle}>A next step you can take</Text>
    <View style={s.safetySteps}><Text style={s.safetyStep}>1. Tell someone nearby: “I need you to stay with me.”</Text><Text style={s.safetyStep}>2. Put distance between you and anything dangerous.</Text><Text style={s.safetyStep}>3. Call local emergency services or a crisis line in your country.</Text></View>
    <Notice title="Saanjh is not emergency care" body="The AI may miss risk or misunderstand you. It cannot contact help, locate you, or keep you safe. Please involve a real person now." />
    <Button secondary label="Return to Saanjh" onPress={onBack} />
  </ScrollView></SafeAreaView>;
}

function AppContent() {
  const [fontsLoaded, fontError] = useFonts({ PlayfairDisplay_500Medium, PlayfairDisplay_600SemiBold, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  const [loaded, setLoaded] = useState(false); const [data, setData] = useState<AppData>(createEmptyAppData()); const [apiAccessToken, setApiAccessToken] = useState(''); const [route, setRoute] = useState<Route>('welcome'); const [activeSessionId, setActiveSessionId] = useState<string>(); const [afterSessionId, setAfterSessionId] = useState<string>();

  useEffect(() => {
    let alive = true;
    const open = async () => {
      let cached: AppData;
      try { cached = await loadAppData(); } catch { cached = createEmptyAppData(); }
      cached = { ...cached, settings: sanitizedSettings(cached.settings) };
      const accessToken = await loadApiAccessToken().catch(() => '');
      const savedBaseUrl = cached.settings.apiBaseUrl.trim();
      const baseUrl = (!savedBaseUrl || isTemporaryBackendUrl(savedBaseUrl)) && SAANJH_API_BASE_URL
        ? SAANJH_API_BASE_URL
        : savedBaseUrl;
      cached = { ...cached, settings: { ...cached.settings, apiBaseUrl: baseUrl } };
      configureSaanjhApi({ baseUrl, accessToken });
      if (!alive) return;
      setApiAccessToken(accessToken);
      setData(cached);
      setRoute(cached.companion ? 'today' : !cached.hasSeenWelcome ? 'welcome' : 'onboarding');
      void saveAppData(cached).catch(() => undefined);
      setLoaded(true);
    };
    void open();
    return () => { alive = false; };
  }, []);
  const commit = useCallback((update: (current: AppData) => AppData) => { setData((current) => { const next = update(current); void saveAppData(next).catch(() => notify('Local save failed', 'Saanjh could not save this change on the device.')); return next; }); }, []);
  const saveConnection = useCallback(async (baseUrl: string, accessToken: string) => {
    const cleanUrl = baseUrl.trim();
    configureSaanjhApi({ baseUrl: cleanUrl, accessToken });
    await saveApiAccessToken(accessToken);
    setApiAccessToken(accessToken.trim());
    commit((current) => ({ ...current, settings: { ...current.settings, apiBaseUrl: cleanUrl } }));
  }, [commit]);
  const go = (next: Route) => { setRoute(next); void haptic(); };
  const tab = (next: TabRoute) => go(next);

  const beginWelcome = () => { commit((current) => ({ ...current, hasSeenWelcome: true })); go('onboarding'); };
  const completeOnboarding = (companion: CompanionProfile, settings: AppSettings) => { commit((current) => ({ ...current, hasSeenWelcome: true, companion, settings: sanitizedSettings(settings) })); go('today'); };
  const updateProfile = (companion?: CompanionProfile) => commit((current) => ({ ...current, companion }));
  const markRemoteProfileOrphaned = (profileId: string) => commit((current) => ({ ...current, pendingVoiceboxProfileIds: current.pendingVoiceboxProfileIds.includes(profileId) ? current.pendingVoiceboxProfileIds : [...current.pendingVoiceboxProfileIds, profileId] }));
  const startSession = async (kind: SessionKind, intention?: string, moodScore?: 1 | 2 | 3 | 4 | 5) => {
    if (!data.companion) return;
    if (!data.settings.apiBaseUrl) { notify('Saanjh is unavailable', 'The app service is not configured in this build. Please install the latest Saanjh update.'); return; }
    if (kind === 'voice' && !data.companion.voiceboxProfileId) { notify('Voice setup needed', 'Sync the companion voice before starting a voice session.'); go('companion'); return; }
    if (kind === 'voice' && data.companion.voiceboxProfileId) {
      try {
        const profiles = await api.listVoiceboxProfiles();
        const linked = profiles.some((item) => String(item.id ?? item.profile_id ?? '') === data.companion?.voiceboxProfileId);
        if (!linked) {
          updateProfile({ ...data.companion, voiceboxProfileId: undefined });
          notify('Voice needs refreshing', 'Your saved voice needs to be prepared again. The original sample is still safely on this phone.');
          go('companion');
          return;
        }
      } catch (error) {
        notify('Voice is temporarily unavailable', displayError(error));
        return;
      }
    }
    const sessionId = uid('session');
    const mood: MoodEntry | undefined = moodScore ? { id: uid('mood'), mood: MOODS.find((item) => item.score === moodScore)?.label ?? String(moodScore), score: moodScore, context: 'before-session', createdAt: now(), sessionId } : undefined;
    const session: SessionEntry = { id: sessionId, companionId: data.companion.id, kind, status: 'active', startedAt: now(), messages: [], intention: intention?.trim() || undefined, moodBeforeId: mood?.id };
    commit((current) => ({ ...current, moods: mood ? [mood, ...current.moods] : current.moods, sessions: [session, ...current.sessions] })); setActiveSessionId(session.id); go('session');
  };
  const finishSession = async (messages: ChatMessage[], status: 'completed' | 'cancelled' = 'completed') => {
    if (!activeSessionId) { go('today'); return; }
    const id = activeSessionId; const endedAt = now();
    commit((current) => ({ ...current, sessions: current.sessions.map((session) => session.id === id ? { ...session, status, endedAt, messages: current.settings.allowTranscripts ? messages : [] } : session) })); setAfterSessionId(id); setActiveSessionId(undefined); go(status === 'completed' ? 'aftercare' : 'safety');
    if (!data.settings.allowTranscripts) clearGeneratedAudioCache();
  };
  const saveAftercare = (score?: 1 | 2 | 3 | 4 | 5, note?: string) => {
    commit((current) => { const sessionKind = current.sessions.find((item) => item.id === afterSessionId)?.kind ?? 'voice'; const moods = score ? [{ id: uid('mood'), mood: MOODS.find((item) => item.score === score)?.label ?? String(score), score, context: 'after-session' as const, sessionId: afterSessionId, createdAt: now() }, ...current.moods] : current.moods; const timestamp = now(); const journal = note ? [{ id: uid('journal'), title: `After a ${sessionKind} session`, body: note, sessionId: afterSessionId, createdAt: timestamp, updatedAt: timestamp }, ...current.journal] : current.journal; return { ...current, moods, journal }; }); setAfterSessionId(undefined); go('today');
  };
  const retryRemoteCleanup = async () => { const remaining: string[] = []; for (const profileId of data.pendingVoiceboxProfileIds) { try { await api.deleteVoiceboxProfile(profileId); } catch { remaining.push(profileId); } } commit((current) => ({ ...current, pendingVoiceboxProfileIds: remaining })); return remaining.length ? 'Secure cleanup could not finish yet. Please try again when your connection is stronger.' : 'Secure voice cleanup is complete.'; };
  const deleteCompanion = async () => { const confirmed = await confirmAction('Delete companion and voice?', 'This securely removes the created AI voice first, then clears the companion and sessions from this phone.', 'Delete'); if (!confirmed) return; const profile = data.companion; if (!profile) return; if (profile.voiceboxProfileId) { try { await api.deleteVoiceboxProfile(profile.voiceboxProfileId); } catch (e) { notify('Companion deletion paused', `${displayError(e)}\n\nYour local companion was kept so no voice data is left behind.`); return; } } clearAllPersistedMedia(); commit((current) => ({ ...current, companion: undefined, sessions: [] })); go('onboarding'); };
  const resetAll = async () => {
    const confirmed = await confirmAction('Reset all local data?', 'This removes settings, moods, journal entries, and session history from this device and cannot be undone.', 'Reset');
    if (!confirmed) return;
    if (data.companion?.voiceboxProfileId) {
      try { await api.deleteVoiceboxProfile(data.companion.voiceboxProfileId); }
      catch (error) {
        notify('Remote voice cleanup failed', `${displayError(error)}\n\nLocal data was kept so you can retry without orphaning the cloned voice.`);
        return;
      }
    }
    clearAllPersistedMedia();
    await clearAppData();
    await clearApiAccessToken();
    configureSaanjhApi({ baseUrl: '', accessToken: '' });
    setApiAccessToken('');
    const empty = createEmptyAppData();
    setData(empty);
    setRoute('welcome');
  };

  if (!loaded || (!fontsLoaded && !fontError)) return <LoadingScreen />;
  if (route === 'welcome') return <WelcomeScreen onBegin={beginWelcome} />;
  if (route === 'onboarding' || !data.companion) return <OnboardingScreen initialSettings={data.settings} initialAccessToken={apiAccessToken} onSaveConnection={saveConnection} onComplete={completeOnboarding} onRemoteProfileOrphaned={markRemoteProfileOrphaned} />;
  if (route === 'mood') return <MoodScreen reducedMotion={data.settings.reducedMotion} onBack={() => go('today')} onSave={(entry) => { if (entry) commit((current) => ({ ...current, moods: [entry, ...current.moods] })); go('today'); }} />;
  if (route === 'precall') return <PreCallScreen data={data} onBack={() => go('today')} onStart={(intention, moodScore) => startSession('voice', intention, moodScore)} />;
  if (route === 'session') { const session = data.sessions.find((item) => item.id === activeSessionId); return session ? <SessionScreen data={data} session={session} onEnd={(messages) => finishSession(messages)} onCrisis={(messages) => finishSession(messages, 'cancelled')} /> : <LoadingScreen />; }
  if (route === 'aftercare') return <AftercareScreen reducedMotion={data.settings.reducedMotion} onSave={saveAftercare} onSkip={() => saveAftercare()} />;
  if (route === 'safety') return <SafetyScreen onBack={() => go('today')} />;

  const active = route as TabRoute;
  return <Shell active={active} onNavigate={tab} reducedMotion={data.settings.reducedMotion}>
    {route === 'today' ? <TodayScreen data={data} go={go} start={startSession} /> : null}
    {route === 'companion' ? <CompanionScreen data={data} updateProfile={updateProfile} go={go} onRemoteProfileOrphaned={markRemoteProfileOrphaned} /> : null}
    {route === 'rituals' ? <RitualsScreen reducedMotion={data.settings.reducedMotion} /> : null}
    {route === 'journal' ? <JournalScreen entries={data.journal} onAdd={(entry) => commit((current) => ({ ...current, journal: [entry, ...current.journal] }))} onDelete={(id) => commit((current) => ({ ...current, journal: current.journal.filter((entry) => entry.id !== id) }))} /> : null}
    {route === 'settings' ? <SettingsScreen data={data} initialAccessToken={apiAccessToken} onSave={async (settings, accessToken) => { await saveConnection(settings.apiBaseUrl, accessToken); commit((current) => ({ ...current, settings })); }} onSafety={() => go('safety')} onDeleteCompanion={() => { void deleteCompanion(); }} onReset={() => { void resetAll(); }} onRetryRemoteCleanup={retryRemoteCleanup} /> : null}
  </Shell>;
}

export default function App() { return <SafeAreaProvider><View style={s.appBackdrop}><ImageBackground source={paperArt} style={s.appSurface} imageStyle={s.appPaper}><AppContent /></ImageBackground></View></SafeAreaProvider>; }

const s = StyleSheet.create({
  appBackdrop: { flex: 1, backgroundColor: C.night950, alignItems: 'center' },
  appSurface: { flex: 1, width: '100%', maxWidth: 560, backgroundColor: C.ivory, overflow: 'hidden', ...shadow },
  appPaper: { opacity: .18 },
  safe: { flex: 1, backgroundColor: 'rgba(243,238,229,.92)' },
  shellContent: { flex: 1 },

  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.ivory, gap: 14 },
  loadingArt: { width: 138, height: 138, borderRadius: 40, borderWidth: 1, borderColor: C.line, ...softShadow },
  loadingText: { fontFamily: font.medium, color: C.textSecondary, fontSize: 12, letterSpacing: .25 },

  ambientRings: { alignItems: 'center', justifyContent: 'center' },
  ambientRing: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(47,74,59,.34)' },
  ambientRingDark: { borderColor: 'rgba(210,161,126,.48)' },
  ambientSeed: { width: 18, height: 18, borderRadius: 9, backgroundColor: C.gold, ...softShadow },
  ambientSeedDark: { backgroundColor: C.peach300 },

  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandGlyph: { width: 34, height: 38, borderRadius: 13, overflow: 'hidden', borderWidth: 1, borderColor: C.line, backgroundColor: C.ivory },
  brandGlyphInverse: { borderColor: 'rgba(247,241,231,.45)' },
  brandEmblem: { width: '100%', height: '100%' },
  brandText: { fontFamily: font.display, fontSize: 30, lineHeight: 34, color: C.text, letterSpacing: -.4 },

  aiChip: { alignSelf: 'flex-start', flexDirection: 'row', gap: 6, alignItems: 'center', borderRadius: radii.pill, paddingVertical: 7, paddingHorizontal: 11, backgroundColor: 'rgba(226,229,217,.86)', borderWidth: 1, borderColor: 'rgba(47,74,59,.10)' },
  aiChipInverse: { backgroundColor: 'rgba(12,41,39,.36)', borderColor: 'rgba(247,241,231,.24)' },
  aiChipText: { fontFamily: font.semibold, fontSize: 10, color: C.plum700, letterSpacing: .35 },

  button: { minHeight: 57, borderRadius: 19, paddingHorizontal: 20, marginTop: 14, backgroundColor: C.plum700, borderWidth: 1, borderColor: 'rgba(181,151,93,.35)', flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center', ...shadow },
  buttonSecondary: { backgroundColor: 'rgba(243,238,229,.66)', borderColor: C.line, ...(Platform.OS === 'web' ? { boxShadow: 'none' } : { shadowOpacity: 0, elevation: 0 }) },
  buttonDanger: { backgroundColor: C.danger, borderColor: 'rgba(162,79,69,.28)' },
  buttonDisabled: { opacity: .42 },
  buttonText: { fontFamily: font.semibold, color: C.inverse, fontSize: 14, letterSpacing: .1 },
  buttonTextSecondary: { color: C.plum700 },
  pressed: { transform: [{ scale: .982 }], opacity: .88 },

  iconButton: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(234,227,215,.84)', borderWidth: 1, borderColor: C.line },
  iconButtonDark: { backgroundColor: C.white08, borderColor: C.white20 },
  pageHeader: { marginBottom: 18 },
  pageHeaderRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 },
  eyebrow: { fontFamily: font.bold, fontSize: 10, color: C.plum500, letterSpacing: 1.7, marginBottom: 8 },
  pageTitle: { fontFamily: font.display, color: C.text, fontSize: 40, lineHeight: 43, letterSpacing: -.55 },

  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: 'rgba(226,229,217,.82)', borderWidth: 1, borderColor: 'rgba(47,74,59,.10)', borderRadius: radii.md, padding: 16, marginTop: 16 },
  noticePeach: { backgroundColor: 'rgba(238,221,207,.86)', borderColor: 'rgba(180,123,90,.16)' },
  noticeNight: { backgroundColor: C.night850, borderColor: 'rgba(181,151,93,.28)' },
  noticeTitle: { fontFamily: font.semibold, fontSize: 13, color: C.text, marginBottom: 3 },
  noticeBody: { fontFamily: font.body, fontSize: 12, lineHeight: 18, color: C.textSecondary },

  fieldWrap: { marginTop: 18 },
  fieldLabel: { fontFamily: font.bold, fontSize: 10, letterSpacing: 1.15, color: C.textSecondary, marginTop: 17, marginBottom: 8 },
  field: { minHeight: 57, borderRadius: radii.md, borderWidth: 1, borderColor: C.line, paddingHorizontal: 16, backgroundColor: 'rgba(247,241,231,.78)', fontFamily: font.medium, fontSize: 14, color: C.text },
  fieldMultiline: { minHeight: 108, textAlignVertical: 'top', paddingTop: 15, paddingBottom: 15, lineHeight: 21 },

  choiceCard: { minHeight: 94, flexDirection: 'row', alignItems: 'center', gap: 13, padding: 15, borderRadius: radii.lg, borderWidth: 1, borderColor: C.line, backgroundColor: C.ivory, ...softShadow },
  choiceCardSelected: { borderColor: C.plum500, backgroundColor: 'rgba(226,229,217,.93)' },
  choiceIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: C.paper, borderWidth: 1, borderColor: C.line },
  choiceIconSelected: { backgroundColor: C.ivory },
  choiceTitle: { fontFamily: font.semibold, fontSize: 14, color: C.text },
  choiceBody: { fontFamily: font.body, fontSize: 11, lineHeight: 17, color: C.textSecondary, marginTop: 4 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: C.sage, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { backgroundColor: C.plum700, borderColor: C.plum700 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 40, paddingHorizontal: 13, borderRadius: radii.pill, borderWidth: 1, borderColor: C.line, backgroundColor: 'rgba(247,241,231,.74)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  chipSelected: { backgroundColor: C.lavender100, borderColor: C.sage },
  chipText: { fontFamily: font.medium, fontSize: 11, color: C.textSecondary },
  chipTextSelected: { fontFamily: font.semibold, fontSize: 11, color: C.plum700 },
  artAvatar: { borderWidth: 4, borderColor: C.ivory, backgroundColor: C.paper, ...shadow },

  welcome: { flex: 1, backgroundColor: C.night950 },
  welcomeSafe: { flex: 1, paddingHorizontal: 22, paddingTop: 8, paddingBottom: 22, justifyContent: 'space-between' },
  welcomeTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  welcomeAura: { position: 'absolute', right: -72, bottom: 188, opacity: .72 },
  welcomeCopy: { paddingBottom: 8 },
  welcomeKicker: { fontFamily: font.bold, fontSize: 9, letterSpacing: 1.9, color: C.peach300, marginBottom: 11 },
  welcomeTitle: { fontFamily: font.display, color: C.inverse, fontSize: 47, lineHeight: 48, maxWidth: 430, letterSpacing: -.7 },
  welcomeBody: { fontFamily: font.body, color: C.inverseSecondary, fontSize: 14, lineHeight: 22, marginTop: 13, maxWidth: 410 },
  trustRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 16, justifyContent: 'center' },
  trustText: { flexShrink: 1, fontFamily: font.medium, fontSize: 10, color: C.inverseSecondary, textAlign: 'center' },

  onboardingPage: { paddingHorizontal: 22, paddingTop: 15, paddingBottom: 50 },
  stepLabel: { fontFamily: font.bold, fontSize: 10, letterSpacing: 1.25, color: C.textSecondary },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: 'rgba(124,143,120,.20)', overflow: 'hidden', marginBottom: 27 },
  progressFill: { height: '100%', borderRadius: 2, backgroundColor: C.plum700 },
  onboardingTitle: { fontFamily: font.display, color: C.text, fontSize: 42, lineHeight: 43, letterSpacing: -.65, marginBottom: 13 },
  stack: { gap: 12 },
  lead: { fontFamily: font.body, fontSize: 14, lineHeight: 22, color: C.textSecondary, marginBottom: 6 },
  helper: { fontFamily: font.body, fontSize: 11, lineHeight: 17, color: C.textSecondary, marginTop: 8 },
  helperCentered: { fontFamily: font.body, fontSize: 11, lineHeight: 17, color: C.textSecondary, textAlign: 'center', marginTop: 8 },

  avatarPicker: { alignSelf: 'center', position: 'relative', marginTop: 8 },
  avatarAdd: { position: 'absolute', right: -2, bottom: 3, width: 38, height: 38, borderRadius: 19, backgroundColor: C.plum700, borderWidth: 3, borderColor: C.ivory, alignItems: 'center', justifyContent: 'center' },
  consentArt: { width: '100%', height: 198, borderRadius: radii.lg, borderWidth: 1, borderColor: C.line },
  readyArt: { width: '100%', height: 220, borderRadius: radii.lg, borderWidth: 1, borderColor: C.line },
  consentCheck: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', borderWidth: 1, borderColor: C.line, backgroundColor: 'rgba(247,241,231,.64)', borderRadius: radii.md, padding: 16, marginTop: 4 },
  consentCheckActive: { backgroundColor: C.lavender100, borderColor: C.sage },
  checkbox: { width: 25, height: 25, borderRadius: 8, borderWidth: 1.5, borderColor: C.sage, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: C.plum700, borderColor: C.plum700 },
  consentCheckText: { flex: 1, fontFamily: font.medium, fontSize: 12, lineHeight: 18, color: C.text },

  sampleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  sampleAction: { flex: 1, minHeight: 130, borderWidth: 1, borderColor: C.line, backgroundColor: C.ivory, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center', gap: 10, ...softShadow },
  sampleActionRecording: { backgroundColor: C.plum700, borderColor: C.gold },
  sampleActionTitle: { fontFamily: font.semibold, fontSize: 12, color: C.text },
  sampleReady: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, backgroundColor: C.lavender100, borderWidth: 1, borderColor: C.line, borderRadius: radii.md },
  sampleReadyTitle: { fontFamily: font.semibold, fontSize: 12, color: C.success },
  sampleReadyName: { fontFamily: font.body, fontSize: 10, color: C.textSecondary, marginTop: 2 },
  serviceCard: { borderWidth: 1, borderColor: C.line, backgroundColor: 'rgba(234,227,215,.80)', borderRadius: radii.lg, padding: 16, marginTop: 4, ...softShadow },
  serviceTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  serviceTitle: { fontFamily: font.displayMedium, fontSize: 19, color: C.text },
  busyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 16 },
  busyText: { fontFamily: font.medium, fontSize: 11, color: C.textSecondary },
  errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, marginTop: 14, borderRadius: radii.sm, backgroundColor: 'rgba(238,221,207,.88)', borderWidth: 1, borderColor: 'rgba(162,79,69,.16)' },
  errorText: { flex: 1, fontFamily: font.medium, fontSize: 11, lineHeight: 17, color: C.danger },
  footerActions: { marginTop: 16 },

  tabBar: { height: 82, flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.line, backgroundColor: 'rgba(243,238,229,.98)', paddingHorizontal: 8, paddingTop: 5, paddingBottom: 6 },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  tabIconWrap: { width: 36, height: 34, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  tabIconWrapActive: { backgroundColor: C.plum700, borderWidth: 1, borderColor: 'rgba(181,151,93,.35)' },
  tabLabel: { fontFamily: font.medium, fontSize: 10, color: C.textSecondary },
  tabLabelActive: { color: C.plum700, fontFamily: font.semibold },

  mainPage: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 44 },
  todayTop: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 21 },
  heroTitle: { fontFamily: font.display, fontSize: 43, lineHeight: 44, color: C.text, letterSpacing: -.7 },
  heroCard: { height: 266, borderRadius: radii.lg, overflow: 'hidden', marginTop: 20, justifyContent: 'center', borderWidth: 1, borderColor: C.line, ...shadow },
  heroCardImage: { borderRadius: radii.lg },
  heroCardCopy: { padding: 19, width: '64%' },
  cardDisplay: { fontFamily: font.display, color: C.text, fontSize: 34, marginTop: 13, maxWidth: '100%' },
  cardBody: { fontFamily: font.body, color: C.textSecondary, fontSize: 11, lineHeight: 17, marginTop: 2 },
  compactCall: { marginTop: 16, minHeight: 46, borderRadius: 15, backgroundColor: C.plum700, borderWidth: 1, borderColor: 'rgba(181,151,93,.28)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12 },
  compactCallText: { fontFamily: font.semibold, color: C.inverse, fontSize: 11 },
  sectionTitle: { fontFamily: font.display, color: C.text, fontSize: 28, lineHeight: 31, marginTop: 27, marginBottom: 12 },
  actionGrid: { flexDirection: 'row', gap: 12 },
  journalBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radii.lg, borderWidth: 1, borderColor: C.line, padding: 16, marginTop: 13, backgroundColor: 'rgba(226,229,217,.72)' },
  journalBannerTitle: { fontFamily: font.semibold, fontSize: 12, color: C.text },
  journalBannerBody: { fontFamily: font.body, fontSize: 11, lineHeight: 16, color: C.textSecondary, marginTop: 3 },

  moodVisual: { minHeight: 322, justifyContent: 'space-between', borderRadius: radii.lg, overflow: 'hidden', borderWidth: 1, borderColor: C.line, paddingHorizontal: 10, paddingTop: 16, paddingBottom: 12, ...shadow },
  moodVisualImage: { borderRadius: radii.lg },
  moodVisualLead: { maxWidth: 260, alignSelf: 'center', fontFamily: font.body, fontSize: 12, lineHeight: 18, color: C.textSecondary, textAlign: 'center' },
  moodRow: { flexDirection: 'row', gap: 4, marginVertical: 22 },
  moodPressable: { flex: 1 },
  moodItem: { width: '100%', alignItems: 'center', gap: 7, paddingVertical: 9, paddingHorizontal: 2, borderRadius: radii.md },
  moodItemSelected: { backgroundColor: 'rgba(247,241,231,.92)', borderWidth: 1, borderColor: 'rgba(47,74,59,.18)', ...softShadow },
  moodFace: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(234,227,215,.90)', borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  moodFaceSelected: { backgroundColor: C.plum700, borderColor: C.plum700 },
  moodNumber: { fontFamily: font.bold, color: C.textSecondary, fontSize: 13 },
  moodLabel: { fontFamily: font.medium, color: C.textSecondary, fontSize: 9.5, textAlign: 'center', lineHeight: 12 },
  moodLabelSelected: { color: C.plum700, fontFamily: font.semibold },

  emptyState: { alignItems: 'center', paddingTop: 8 },
  emptyArt: { width: '100%', height: 192, borderRadius: radii.lg, borderWidth: 1, borderColor: C.line },
  emptyTitle: { fontFamily: font.display, fontSize: 30, color: C.text, marginTop: 18 },
  emptyBody: { fontFamily: font.body, fontSize: 12, lineHeight: 19, color: C.textSecondary, textAlign: 'center', maxWidth: 340, marginTop: 7 },
  entryList: { gap: 12 },
  entryCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderWidth: 1, borderColor: C.line, backgroundColor: C.ivory, borderRadius: radii.lg, padding: 17, ...softShadow },
  entryDate: { fontFamily: font.bold, fontSize: 9, letterSpacing: .9, color: C.plum500 },
  entryTitle: { fontFamily: font.display, fontSize: 23, color: C.text, marginTop: 4 },
  entryBody: { fontFamily: font.body, fontSize: 12, lineHeight: 19, color: C.textSecondary, marginTop: 6 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(12,41,39,.48)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.ivory, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, padding: 24, paddingBottom: 38, borderTopWidth: 1, borderColor: C.line },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontFamily: font.display, fontSize: 29, color: C.text },

  profileHero: { alignItems: 'center', marginVertical: 10, paddingVertical: 8 },
  profileStatus: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.lavender100, borderWidth: 1, borderColor: C.line, borderRadius: radii.pill, paddingHorizontal: 11, paddingVertical: 6, marginTop: -4 },
  profileStatusText: { fontFamily: font.semibold, color: C.success, fontSize: 10 },
  voicePanel: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: C.line, backgroundColor: C.ivory, borderRadius: radii.lg, padding: 16, marginTop: 18, ...softShadow },
  voicePanelTitle: { fontFamily: font.displayMedium, fontSize: 17, color: C.text },
  voicePanelBody: { fontFamily: font.body, fontSize: 11, lineHeight: 17, color: C.textSecondary, marginTop: 3 },
  statusDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: C.success, borderWidth: 2, borderColor: C.lavender100 },
  statusDotOff: { backgroundColor: C.warning, borderColor: C.peach100 },
  emptyInline: { fontFamily: font.body, color: C.textSecondary, fontSize: 11 },
  inlineInput: { height: 57, borderRadius: radii.md, borderWidth: 1, borderColor: C.line, backgroundColor: 'rgba(247,241,231,.70)', flexDirection: 'row', alignItems: 'center', paddingLeft: 15 },
  inlineTextInput: { flex: 1, fontFamily: font.medium, color: C.text, fontSize: 13 },
  inlineAdd: { width: 44, height: 44, borderRadius: 15, backgroundColor: C.plum700, alignItems: 'center', justifyContent: 'center', marginRight: 5 },
  memoryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 10 },
  memoryText: { flex: 1, fontFamily: font.body, fontSize: 12, lineHeight: 18, color: C.text },

  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: C.line, backgroundColor: 'rgba(247,241,231,.68)', borderRadius: radii.md, padding: 15, marginBottom: 10 },
  switchTitle: { fontFamily: font.semibold, fontSize: 13, color: C.text },
  switchBody: { fontFamily: font.body, fontSize: 11, lineHeight: 16, color: C.textSecondary, marginTop: 3 },
  settingsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: C.line, backgroundColor: 'rgba(247,241,231,.64)', borderRadius: radii.md, padding: 15, marginBottom: 9 },
  settingsRowTitle: { fontFamily: font.semibold, fontSize: 12, color: C.text },
  settingsRowBody: { fontFamily: font.body, fontSize: 11, lineHeight: 16, color: C.textSecondary, marginTop: 3 },

  preCallProfile: { position: 'relative', flexDirection: 'row', alignItems: 'center', gap: 17, marginVertical: 10, borderWidth: 1, borderColor: C.line, borderRadius: radii.lg, backgroundColor: 'rgba(226,229,217,.58)', padding: 17, overflow: 'hidden' },
  preCallAura: { position: 'absolute', left: -14, top: -16, opacity: .5 },
  preCallName: { fontFamily: font.display, fontSize: 32, color: C.text, marginBottom: 5, maxWidth: '100%' },
  readinessList: { gap: 9, marginTop: 20, borderWidth: 1, borderColor: C.line, backgroundColor: 'rgba(247,241,231,.62)', borderRadius: radii.md, padding: 14 },
  readinessRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  readinessText: { flex: 1, fontFamily: font.medium, fontSize: 11, color: C.textSecondary },

  session: { flex: 1, backgroundColor: C.night950 },
  sessionSafe: { flex: 1, paddingHorizontal: 18, paddingBottom: 18 },
  sessionAura: { position: 'absolute', top: 58, left: 0, right: 0, alignItems: 'center', opacity: .58 },
  sessionTop: { zIndex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 7 },
  sessionTimer: { fontFamily: font.semibold, color: C.inverseSecondary, fontSize: 11, letterSpacing: .6 },
  sessionIdentity: { zIndex: 2, alignItems: 'center', marginTop: 12 },
  sessionName: { maxWidth: '82%', fontFamily: font.display, color: C.inverse, fontSize: 31, marginTop: 4, textAlign: 'center' },
  sessionDisclosure: { fontFamily: font.medium, color: C.inverseSecondary, fontSize: 9, letterSpacing: .2 },
  wave: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 6 },
  waveBar: { width: 3, borderRadius: 3, backgroundColor: C.gold },
  phaseText: { fontFamily: font.semibold, color: C.inverse, fontSize: 11, textAlign: 'center', marginBottom: 9 },
  sessionProgress: { marginBottom: 10 },
  captionBox: { flex: 1, minHeight: 84, maxHeight: 245, borderRadius: radii.lg, backgroundColor: 'rgba(8,31,29,.58)', borderWidth: 1, borderColor: 'rgba(181,151,93,.25)' },
  captionContent: { padding: 13, gap: 9 },
  captionEmpty: { fontFamily: font.body, fontSize: 11, lineHeight: 17, color: C.inverseSecondary, textAlign: 'center', padding: 14 },
  message: { maxWidth: '88%', padding: 11, borderRadius: 15, borderWidth: 1, borderColor: C.white08 },
  messageUser: { alignSelf: 'flex-end', backgroundColor: 'rgba(180,123,90,.23)' },
  messageAI: { alignSelf: 'flex-start', backgroundColor: 'rgba(94,118,90,.28)' },
  messageRole: { fontFamily: font.bold, fontSize: 8, letterSpacing: .9, color: C.peach300, marginBottom: 4 },
  messageText: { fontFamily: font.body, color: C.inverse, fontSize: 12, lineHeight: 18 },
  replay: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  replayText: { fontFamily: font.semibold, fontSize: 9, color: C.peach300 },
  sessionError: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, backgroundColor: 'rgba(162,79,69,.34)', borderRadius: radii.sm, padding: 10, marginTop: 8 },
  sessionErrorText: { flex: 1, fontFamily: font.medium, color: C.inverse, fontSize: 10, lineHeight: 15 },
  composer: { flexDirection: 'row', alignItems: 'center', marginTop: 9, minHeight: 50, borderRadius: 17, backgroundColor: 'rgba(247,241,231,.10)', borderWidth: 1, borderColor: 'rgba(181,151,93,.22)', paddingLeft: 14, paddingRight: 4 },
  composerInput: { flex: 1, fontFamily: font.medium, color: C.inverse, fontSize: 12 },
  sendButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: C.plum500, alignItems: 'center', justifyContent: 'center' },
  sessionControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, marginTop: 10 },
  micControl: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.inverse, borderWidth: 2, borderColor: C.gold, alignItems: 'center', justifyContent: 'center', ...shadow },
  micControlActive: { backgroundColor: C.peach300 },
  endControl: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.clay, borderWidth: 1, borderColor: 'rgba(247,241,231,.22)', alignItems: 'center', justifyContent: 'center' },
  endLabel: { position: 'absolute', bottom: -17, fontFamily: font.semibold, fontSize: 9, color: C.inverseSecondary },

  emergencyCard: { flexDirection: 'row', alignItems: 'center', gap: 13, borderWidth: 1, borderColor: 'rgba(162,79,69,.22)', backgroundColor: C.ivory, borderRadius: radii.lg, padding: 16, marginTop: 16, ...softShadow },
  emergencyIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center' },
  emergencyTitle: { fontFamily: font.semibold, fontSize: 15, color: C.danger },
  emergencyBody: { fontFamily: font.body, fontSize: 10, lineHeight: 15, color: C.textSecondary, marginTop: 3 },
  safetySteps: { gap: 10 },
  safetyStep: { fontFamily: font.medium, fontSize: 13, lineHeight: 20, color: C.text, borderLeftWidth: 3, borderLeftColor: C.clay, paddingLeft: 12 },
});
