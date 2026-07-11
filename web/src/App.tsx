import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from 'react';
import { API_BASE_URL, api, displayError, mediaUrl } from './api';
import {
  Badge,
  Brand,
  Busy,
  Button,
  EmptyState,
  ErrorBanner,
  Field,
  IconButton,
  Notice,
  PageHeader,
  ServicePill,
  TextArea,
  formatDate,
} from './components';
import { Icon, type IconName } from './Icon';
import type {
  ChatMessage,
  Companion,
  CompanionDraft,
  ConsentStatus,
  HealthResponse,
  JournalEntry,
  MoodEntry,
  Session,
  SessionKind,
  VoiceGeneration,
} from './types';

type Route = 'today' | 'setup' | 'companion' | 'chat' | 'precall' | 'voice' | 'mood' | 'aftercare' | 'journal' | 'settings' | 'safety';

const MOODS = [
  { score: 1, label: 'Very low', icon: 'cloud' as const },
  { score: 2, label: 'Low', icon: 'moon' as const },
  { score: 3, label: 'In between', icon: 'leaf' as const },
  { score: 4, label: 'Good', icon: 'sun' as const },
  { score: 5, label: 'Very good', icon: 'sparkles' as const },
];

const FEELINGS = ['Anxious', 'Overwhelmed', 'Lonely', 'Tired', 'Grateful', 'Hopeful'];
const TRAITS = ['Warm', 'Soft-spoken', 'Playful', 'Patient', 'Grounded', 'Direct', 'Motivating', 'Reflective'];
const RELATIONSHIPS = ['Friend', 'Parent', 'Partner', 'Sibling', 'Mentor', 'Other'];
const STANDARD_RELATIONSHIPS = new Set(RELATIONSHIPS.slice(0, -1).map((item) => item.toLowerCase()));

function relationshipFields(value: string, explicitCustom: string): Pick<CompanionDraft, 'relationship' | 'custom_relationship'> {
  const entered = value.trim();
  const normalized = entered.toLowerCase();
  if (STANDARD_RELATIONSHIPS.has(normalized)) return { relationship: normalized };
  const custom = normalized === 'other' ? explicitCustom.trim() : entered;
  return { relationship: 'other', custom_relationship: custom || undefined };
}

function initialRelationship(companion?: Companion | null): string {
  if (!companion) return '';
  if (companion.relationship === 'other') return companion.custom_relationship || 'Other';
  return companion.relationship.charAt(0).toUpperCase() + companion.relationship.slice(1);
}
const DISTRESS_PATTERN = /\b(kill myself|suicid(?:e|al)|end my life|take my life|want to die|don['’]?t want to (?:live|be alive)|hurt myself|harm myself|self[- ]harm|not worth living|immediate danger|someone is hurting me)\b/i;

function localMessage(content: string, role: 'user' | 'assistant', modality: 'text' | 'voice'): ChatMessage {
  return {
    id: globalThis.crypto?.randomUUID?.() || `${role}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    role,
    content,
    modality,
    created_at: new Date().toISOString(),
  };
}

function normalizeMessage(value: ChatMessage | undefined, fallback?: ChatMessage): ChatMessage | undefined {
  if (!value || typeof value !== 'object') return fallback;
  const content = typeof value.content === 'string' ? value.content.trim() : '';
  if (!content) return fallback;
  return {
    ...value,
    id: value.id || fallback?.id || localMessage(content, value.role || 'assistant', value.modality || 'text').id,
    role: value.role || fallback?.role || 'assistant',
    content,
    audio_url: mediaUrl(value.audio_url || value.audio_uri || fallback?.audio_url || fallback?.audio_uri),
    created_at: value.created_at || fallback?.created_at || new Date().toISOString(),
  };
}

async function resolveVoiceGeneration(initial: VoiceGeneration): Promise<VoiceGeneration> {
  let current = initial;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (current.audio_url) return current;
    const status = current.status?.toLowerCase();
    if (status === 'failed') throw new Error(current.detail || 'Voicebox could not generate this audio.');
    if (!current.id) return current;
    await new Promise((resolve) => window.setTimeout(resolve, 1000));
    current = await api.voiceGeneration(current.id);
  }
  throw new Error('Voicebox generation took longer than two minutes. Please try again.');
}

function useMicrophoneRecorder(prefix: string) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [file, setFile] = useState<File>();
  const [error, setError] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const resolverRef = useRef<((file: File) => void) | null>(null);

  const release = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  useEffect(() => () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    release();
  }, [release]);

  const start = useCallback(async () => {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      throw new Error('This browser does not support microphone recording. You can upload an audio file instead.');
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    const preferred = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((type) => MediaRecorder.isTypeSupported(type));
    const recorder = new MediaRecorder(stream, preferred ? { mimeType: preferred } : undefined);
    chunksRef.current = [];
    recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
    recorder.onstop = () => {
      const mime = recorder.mimeType || preferred || 'audio/webm';
      const extension = mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : mime.includes('wav') ? 'wav' : 'webm';
      const result = new File(chunksRef.current, `${prefix}-${Date.now()}.${extension}`, { type: mime });
      setFile(result);
      setRecording(false);
      release();
      resolverRef.current?.(result);
      resolverRef.current = null;
    };
    recorder.onerror = () => {
      setError('The browser could not finish this recording.');
      setRecording(false);
      release();
    };
    recorderRef.current = recorder;
    setSeconds(0);
    setFile(undefined);
    recorder.start(250);
    setRecording(true);
  }, [prefix, release]);

  const stop = useCallback(() => new Promise<File>((resolve, reject) => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== 'recording') {
      reject(new Error('There is no active recording to stop.'));
      return;
    }
    resolverRef.current = resolve;
    recorder.stop();
  }), []);

  return { recording, seconds, file, setFile, start, stop, error, setError };
}

function AppShell({ route, companion, health, onNavigate, children }: {
  route: Route;
  companion: Companion | null;
  health?: HealthResponse;
  onNavigate: (route: Route) => void;
  children: ReactNode;
}) {
  const navigation: Array<{ route: Route; label: string; icon: IconName }> = [
    { route: 'today', label: 'Today', icon: 'home' },
    { route: companion ? 'companion' : 'setup', label: 'Companion', icon: 'user' },
    { route: 'journal', label: 'Journal', icon: 'book' },
    { route: 'settings', label: 'Settings', icon: 'settings' },
  ];
  const active = route === 'mood' || route === 'precall' ? 'today' : route === 'chat' ? 'companion' : route;

  return (
    <div className="app-shell">
      <aside className="sidebar paper-surface">
        <Brand />
        <nav aria-label="Primary navigation">
          {navigation.map((item) => (
            <button key={item.route} className={active === item.route ? 'is-active' : ''} onClick={() => onNavigate(item.route)}>
              <Icon name={item.icon} size={19} />
              <span>{item.label}</span>
              {active === item.route && <i />}
            </button>
          ))}
        </nav>
        <div className="sidebar__footer">
          <div className="sidebar__services">
            <span className={health?.groq.online ? 'is-online' : ''} />
            <span className={health?.voicebox.online ? 'is-online' : ''} />
            <small>Backend services</small>
          </div>
          <p><Icon name="shield" size={14} /> Consent first. Clearly AI.</p>
        </div>
      </aside>
      <div className="app-stage">
        <div className="mobile-topbar paper-surface"><Brand compact /><button aria-label="Open settings" onClick={() => onNavigate('settings')}><Icon name="menu" /></button></div>
        <main className="main-content">{children}</main>
        <nav className="mobile-nav paper-surface" aria-label="Primary navigation">
          {navigation.map((item) => (
            <button key={item.route} className={active === item.route ? 'is-active' : ''} onClick={() => onNavigate(item.route)}>
              <Icon name={item.icon} size={20} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

function TodayScreen({ companion, moods, journal, health, onNavigate, onStartSession }: {
  companion: Companion | null;
  moods: MoodEntry[];
  journal: JournalEntry[];
  health?: HealthResponse;
  onNavigate: (route: Route) => void;
  onStartSession: (kind: SessionKind) => void;
}) {
  if (!companion) {
    return (
      <div className="screen screen--today-empty">
        <div className="today-empty__brand"><Brand /></div>
        <EmptyState
          image="/assets/welcome-forest.webp"
          eyebrow="YOUR SPACE BEGINS EMPTY"
          title="A gentle voice, rooted in care."
          action={<Button icon="arrow-right" onClick={() => onNavigate('setup')}>Create your companion</Button>}
        >
          Add only a voice you are allowed to use. Nothing is pre-filled, and every response stays clearly labelled as AI.
        </EmptyState>
        <div className="trust-strip reveal reveal--delay-2">
          <div><Icon name="shield" /><span><strong>Consent first</strong><small>You choose the voice.</small></span></div>
          <div><Icon name="lock" /><span><strong>Private by design</strong><small>Your server holds the data.</small></span></div>
          <div><Icon name="leaf" /><span><strong>Grounded</strong><small>No fake memories.</small></span></div>
        </div>
      </div>
    );
  }

  const lastMood = [...moods].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
  const lastJournal = [...journal].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
  const voiceReady = Boolean(companion.voicebox_profile_id && health?.voicebox.online);

  return (
    <div className="screen screen--today">
      <div className="today-heading reveal">
        <div><p className="eyebrow">A QUIET PLACE FOR TODAY</p><h1>How are you<br /><em>arriving?</em></h1></div>
        <button className="profile-orb" onClick={() => onNavigate('companion')} aria-label={`Open ${companion.name}'s companion profile`}>
          <img src={mediaUrl(companion.avatar_uri || companion.avatar_url) || '/assets/botanical-emblem.webp'} alt="" />
        </button>
      </div>

      <section className="forest-hero reveal reveal--delay-1">
        <img src="/assets/home-forest-path.webp" alt="Misty forest path at sunrise" />
        <div className="forest-hero__wash" />
        <div className="forest-hero__copy">
          <Badge icon="sparkles">{companion.voice_status === 'memorial' ? 'AI memorial voice' : 'AI-generated voice'}</Badge>
          <h2>{companion.name}</h2>
          <p>{voiceReady ? 'Your companion voice is ready when you are.' : 'Your profile is here. Voice service is not ready yet.'}</p>
          <Button className="forest-hero__button" variant="primary" icon="phone" onClick={() => onNavigate('precall')} disabled={!companion.voicebox_profile_id}>Start voice session</Button>
        </div>
      </section>

      <section className="section reveal reveal--delay-2">
        <div className="section__heading"><div><p className="eyebrow">SMALL RITUALS</p><h2>For right now</h2></div></div>
        <div className="action-grid">
          <button className="ritual-card" onClick={() => onNavigate('mood')}>
            <span className="ritual-card__icon"><Icon name="heart" /></span><div><strong>Check in</strong><p>Name what is here.</p></div><Icon name="chevron-right" />
          </button>
          <button className="ritual-card ritual-card--clay" onClick={() => onStartSession('text')}>
            <span className="ritual-card__icon"><Icon name="message" /></span><div><strong>Text chat</strong><p>Write at your pace.</p></div><Icon name="chevron-right" />
          </button>
          <button className="ritual-card ritual-card--mist" onClick={() => onNavigate('journal')}>
            <span className="ritual-card__icon"><Icon name="book" /></span><div><strong>Journal</strong><p>Keep only your words.</p></div><Icon name="chevron-right" />
          </button>
        </div>
      </section>

      <section className="dashboard-grid reveal reveal--delay-3">
        <article className="soft-card">
          <div className="soft-card__heading"><span><Icon name="heart" size={17} /></span><p className="eyebrow">LATEST CHECK-IN</p></div>
          {lastMood ? <><h3>{lastMood.mood}</h3><p>{lastMood.note || (lastMood.tags?.length ? lastMood.tags.join(' · ') : 'No note was added.')}</p><small>{formatDate(lastMood.created_at, true)}</small></> : <><h3>No check-in yet</h3><p>When you choose to save one, it will appear here.</p></>}
        </article>
        <article className="soft-card">
          <div className="soft-card__heading"><span><Icon name="book" size={17} /></span><p className="eyebrow">RECENT REFLECTION</p></div>
          {lastJournal ? <><h3>{lastJournal.title || 'Private reflection'}</h3><p className="clamp-3">{lastJournal.body}</p><small>{formatDate(lastJournal.created_at, true)}</small></> : <><h3>Your journal is empty</h3><p>Only reflections you write and save will live here.</p></>}
        </article>
      </section>
    </div>
  );
}

function ChoiceCard({ selected, icon, title, body, onClick }: { selected: boolean; icon: IconName; title: string; body: string; onClick: () => void }) {
  return (
    <button type="button" className={`choice-card ${selected ? 'is-selected' : ''}`} onClick={onClick}>
      <span className="choice-card__icon"><Icon name={icon} /></span>
      <span><strong>{title}</strong><small>{body}</small></span>
      <i>{selected && <Icon name="check" size={14} />}</i>
    </button>
  );
}

function CompanionSetup({ health, initial, onComplete, onCancel }: {
  health?: HealthResponse;
  initial?: Companion | null;
  onComplete: (companion: Companion) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState(0);
  const [voiceStatus, setVoiceStatus] = useState<ConsentStatus | ''>(initial?.voice_status || '');
  const [name, setName] = useState(initial?.name || '');
  const [relationship, setRelationship] = useState(initialRelationship(initial));
  const [customRelationship, setCustomRelationship] = useState(initial?.custom_relationship || '');
  const [consentNote, setConsentNote] = useState(initial?.consent_note || '');
  const [consented, setConsented] = useState(Boolean(initial?.consent_acknowledged));
  const [transcript, setTranscript] = useState(initial?.sample_transcript || '');
  const [traits, setTraits] = useState<string[]>(initial?.traits || []);
  const [addressAs, setAddressAs] = useState(initial?.address_as || '');
  const [helpfulWhen, setHelpfulWhen] = useState(initial?.helpful_when || '');
  const [avoid, setAvoid] = useState(initial?.avoid || '');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [created, setCreated] = useState<Companion | null>(initial || null);
  const [voiceProfileId, setVoiceProfileId] = useState(initial?.voicebox_profile_id || '');
  const recorder = useMicrophoneRecorder('saanjh-voice-sample');

  const stepTitles = ['Whose voice will you use?', 'Consent comes first.', 'Add the real voice sample.', 'Shape the support.'];

  const validate = () => {
    const normalizedRelationship = relationship.trim().toLowerCase();
    if (step === 0 && (!voiceStatus || !name.trim() || !normalizedRelationship || (normalizedRelationship === 'other' && !customRelationship.trim()))) return 'Add the voice owner, name, and relationship before continuing.';
    if (step === 1 && (!consented || ((voiceStatus === 'consented' || voiceStatus === 'memorial') && !consentNote.trim()))) return 'Complete the consent acknowledgement and authority note.';
    if (step === 2 && (!recorder.file || !transcript.trim())) return 'Record or upload a real voice sample and confirm its exact words.';
    return '';
  };

  const next = () => {
    const issue = validate();
    if (issue) { setError(issue); return; }
    setError('');
    setStep((value) => Math.min(3, value + 1));
  };

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (selected) { recorder.setFile(selected); setTranscript(''); setError(''); }
  };

  const transcribe = async () => {
    if (!recorder.file) return;
    setBusy('Transcribing the real sample with Voicebox…'); setError('');
    try { setTranscript(await api.transcribe(recorder.file)); }
    catch (cause) { setError(displayError(cause)); }
    finally { setBusy(''); }
  };

  const complete = async () => {
    if (!voiceStatus || !recorder.file) return;
    setBusy('Creating your private companion…'); setError('');
    let saved = created;
    let newRemoteProfileId = '';
    const relationshipValues = relationshipFields(relationship, customRelationship);
    const draft: CompanionDraft = {
      name: name.trim(),
      ...relationshipValues,
      voice_status: voiceStatus,
      consent_acknowledged: consented,
      ai_disclosure_acknowledged: consented,
      consent_note: consentNote.trim() || undefined,
      traits,
      address_as: addressAs.trim() || undefined,
      helpful_when: helpfulWhen.trim() || undefined,
      avoid: avoid.trim() || undefined,
      sample_transcript: transcript.trim(),
    };
    try {
      if (!saved) {
        saved = await api.createCompanion(draft);
        if (!saved?.id) throw new Error('The server did not return the created companion.');
        setCreated(saved);
      } else {
        saved = await api.updateCompanion(saved.id, draft);
        setCreated(saved);
      }

      let profileId = voiceProfileId;
      if (!profileId) {
        setBusy('Creating the consented Voicebox profile…');
        const profile = await api.createVoiceboxProfile(name.trim());
        if (!profile?.id) throw new Error('Voicebox did not return a profile ID.');
        profileId = profile.id;
        newRemoteProfileId = profile.id;
        setVoiceProfileId(profileId);
      }
      setBusy('Sending the real sample to Voicebox…');
      await api.uploadVoiceSample(profileId, recorder.file, transcript.trim());
      const completeProfile = await api.updateCompanion(saved.id, { voicebox_profile_id: profileId, sample_transcript: transcript.trim() });
      onComplete(completeProfile);
    } catch (cause) {
      let cleanup = '';
      if (newRemoteProfileId) {
        try {
          await api.deleteVoiceboxProfile(newRemoteProfileId);
          setVoiceProfileId('');
        } catch {
          cleanup = ' The partially created Voicebox profile could not be removed; its ID has been retained so deletion can be retried safely.';
          if (saved?.id) {
            try { await api.updateCompanion(saved.id, { voicebox_profile_id: newRemoteProfileId }); }
            catch { /* Preserve the original error. */ }
          }
        }
      }
      setError(`${displayError(cause)}${cleanup}`);
    }
    finally { setBusy(''); }
  };

  return (
    <div className="setup-screen paper-surface">
      <div className="setup-art" aria-hidden="true"><img src={step === 1 ? '/assets/consent-botanical.webp' : '/assets/paper-topography.webp'} alt="" /></div>
      <div className="setup-panel">
        <div className="setup-header">
          <IconButton label={step ? 'Previous step' : 'Leave setup'} icon="arrow-left" onClick={() => step ? setStep(step - 1) : onCancel()} />
          <Brand compact />
          <span className="setup-count">{String(step + 1).padStart(2, '0')} / 04</span>
        </div>
        <div className="progress"><i style={{ width: `${((step + 1) / 4) * 100}%` }} /></div>
        <div className="setup-content reveal" key={step}>
          <p className="eyebrow">CREATE YOUR COMPANION</p>
          <h1>{stepTitles[step]}</h1>

          {step === 0 && <div className="form-stack">
            <p className="lead">Choose only a voice you are allowed to use. Saanjh will always identify it as AI-generated.</p>
            <div className="choice-grid">
              <ChoiceCard selected={voiceStatus === 'self'} icon="user" title="My own voice" body="Create an AI version of your voice." onClick={() => { setVoiceStatus('self'); setConsented(false); setConsentNote(''); }} />
              <ChoiceCard selected={voiceStatus === 'consented'} icon="shield" title="A living person's voice" body="Explicit, informed permission is required." onClick={() => { setVoiceStatus('consented'); setConsented(false); setConsentNote(''); }} />
              <ChoiceCard selected={voiceStatus === 'memorial'} icon="heart" title="A deceased person's voice" body="Use only with legal and ethical authority." onClick={() => { setVoiceStatus('memorial'); setConsented(false); setConsentNote(''); }} />
            </div>
            <div className="two-columns"><Field label="COMPANION NAME" value={name} onChange={(event) => setName(event.target.value)} placeholder="Enter a name" /><Field label="RELATIONSHIP" value={relationship} onChange={(event) => setRelationship(event.target.value)} list="relationships" placeholder="Choose or type" /><datalist id="relationships">{RELATIONSHIPS.map((item) => <option key={item}>{item}</option>)}</datalist></div>
            {relationship.trim().toLowerCase() === 'other' && <Field label="DESCRIBE THE RELATIONSHIP" value={customRelationship} onChange={(event) => setCustomRelationship(event.target.value)} placeholder="For example, coach" />}
          </div>}

          {step === 1 && <div className="form-stack">
            <div className="consent-illustration"><img src="/assets/consent-botanical.webp" alt="Botanical wreath symbolising care and consent" /></div>
            <Notice icon="shield" title={voiceStatus === 'memorial' ? 'AI memorial, never the actual person' : 'Permission before imitation'}>
              {voiceStatus === 'self' ? 'You confirm this is your own voice and you choose to clone it.' : voiceStatus === 'consented' ? 'The living speaker must have explicitly agreed to this exact use.' : 'You accept responsibility for having the right to use this recording for clearly labelled AI memorial comfort.'}
            </Notice>
            {(voiceStatus === 'consented' || voiceStatus === 'memorial') && <TextArea label={voiceStatus === 'memorial' ? 'WHY ARE YOU AUTHORISED TO USE THIS RECORDING?' : 'HOW WAS CONSENT GIVEN?'} value={consentNote} onChange={(event) => setConsentNote(event.target.value)} placeholder={voiceStatus === 'memorial' ? 'Record your legal and ethical basis' : 'Record when and how they agreed, including revocation'} rows={4} />}
            <label className={`consent-check ${consented ? 'is-selected' : ''}`}><input type="checkbox" checked={consented} onChange={(event) => setConsented(event.target.checked)} /><span><Icon name="check" size={15} /></span><p>{voiceStatus === 'memorial' ? 'I understand this will be an AI memorial voice—not the actual person—and accept responsibility for this use.' : 'I confirm the voice owner has knowingly agreed, and I understand every reply is AI-generated—not the actual person.'}</p></label>
          </div>}

          {step === 2 && <div className="form-stack">
            <p className="lead">Use 10–30 seconds of clear speech without music or other voices. The transcript must match exactly.</p>
            <div className="sample-grid">
              <button className={`sample-action ${recorder.recording ? 'is-recording' : ''}`} onClick={() => recorder.recording ? recorder.stop().catch((cause) => setError(displayError(cause))) : recorder.start().catch((cause) => setError(displayError(cause)))}>
                <span><Icon name={recorder.recording ? 'stop' : 'mic'} size={27} /></span>
                <strong>{recorder.recording ? `Stop · ${recorder.seconds}s` : 'Record sample'}</strong>
                <small>Microphone stays off until you tap.</small>
              </button>
              <label className="sample-action"><span><Icon name="upload" size={27} /></span><strong>Upload audio</strong><small>Choose one real voice recording.</small><input type="file" accept="audio/*" onChange={chooseFile} /></label>
            </div>
            {recorder.file && <div className="file-ready"><span><Icon name="check" /></span><div><strong>Sample ready</strong><small>{recorder.file.name}</small></div><Badge tone="sage">{Math.max(1, Math.round(recorder.file.size / 1024))} KB</Badge></div>}
            <TextArea label="EXACT WORDS IN THE SAMPLE" value={transcript} onChange={(event) => setTranscript(event.target.value)} placeholder="Type exactly what is spoken, or transcribe with Voicebox" rows={4} />
            <Button variant="secondary" icon="sparkles" onClick={transcribe} disabled={!recorder.file || Boolean(busy)}>Transcribe with Voicebox</Button>
            {recorder.error && <ErrorBanner message={recorder.error} onDismiss={() => recorder.setError('')} />}
          </div>}

          {step === 3 && <div className="form-stack">
            <p className="lead">These notes guide the AI response. They do not invent memories or change the cloned voice.</p>
            <span className="field__label">HOW SHOULD THE COMPANION SPEAK?</span>
            <div className="chip-row">{TRAITS.map((trait) => <button type="button" key={trait} className={traits.includes(trait) ? 'chip is-selected' : 'chip'} onClick={() => setTraits(traits.includes(trait) ? traits.filter((item) => item !== trait) : [...traits, trait])}>{traits.includes(trait) && <Icon name="check" size={14} />}{trait}</button>)}</div>
            <Field label="WHAT SHOULD THEY CALL YOU?" value={addressAs} onChange={(event) => setAddressAs(event.target.value)} placeholder="Optional — such as bro or beta" />
            <div className="two-columns"><TextArea label="HELPFUL WHEN…" value={helpfulWhen} onChange={(event) => setHelpfulWhen(event.target.value)} placeholder="What kind of support helps?" rows={4} /><TextArea label="PLEASE AVOID…" value={avoid} onChange={(event) => setAvoid(event.target.value)} placeholder="Topics, phrases, or styles to avoid" rows={4} /></div>
            <Notice title="A companion, not a clinician">Saanjh supports reflection without diagnosing, replacing professional care, or encouraging dependency.</Notice>
            <div className="service-readiness"><ServicePill label="Groq" configured={Boolean(health?.groq.configured)} online={Boolean(health?.groq.online)} /><ServicePill label="Voicebox" configured={Boolean(health?.voicebox.configured)} online={Boolean(health?.voicebox.online)} /></div>
          </div>}

          {busy && <Busy label={busy} />}
          {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}
          <div className="setup-actions">
            {step < 3 ? <Button icon="arrow-right" onClick={next}>Continue</Button> : <Button icon="sparkles" onClick={complete} disabled={Boolean(busy) || !health?.voicebox.online}>Create companion & voice</Button>}
          </div>
        </div>
      </div>
    </div>
  );
}

function MoodPicker({ score, onChange }: { score?: number; onChange: (score: number) => void }) {
  return <div className="mood-picker">{MOODS.map((mood) => <button key={mood.score} className={score === mood.score ? 'is-selected' : ''} onClick={() => onChange(mood.score)}><span><Icon name={mood.icon} /></span><strong>{mood.score}</strong><small>{mood.label}</small></button>)}</div>;
}

function MoodScreen({ onBack, onSaved }: { onBack: () => void; onSaved: (entry: MoodEntry) => void }) {
  const [score, setScore] = useState<number>();
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    if (!score && !tags.length && !note.trim()) { onBack(); return; }
    setBusy(true); setError('');
    try {
      const selected = MOODS.find((item) => item.score === score);
      const result = await api.createMood({ mood: selected?.label || 'Check-in', score, tags, note: note.trim() || undefined, context: 'check-in' });
      onSaved(result);
    } catch (cause) { setError(displayError(cause)); }
    finally { setBusy(false); }
  };
  return (
    <div className="mood-screen">
      <img className="mood-screen__backdrop" src="/assets/mood-ripples.webp" alt="" />
      <div className="mood-screen__veil" />
      <div className="mood-screen__content">
        <PageHeader onBack={onBack} eyebrow="A PRIVATE CHECK-IN" title={<>How are you feeling<br /><em>right now?</em></>} description="There is no right or wrong answer. You can leave any part blank." />
        <MoodPicker score={score} onChange={setScore} />
        <div className="mood-ripple" aria-hidden="true"><i /><i /><span><Icon name="leaf" /></span></div>
        <span className="field__label">WHAT'S PRESENT?</span>
        <div className="chip-row chip-row--center">{FEELINGS.map((tag) => <button key={tag} className={tags.includes(tag) ? 'chip is-selected' : 'chip'} onClick={() => setTags(tags.includes(tag) ? tags.filter((item) => item !== tag) : [...tags, tag])}>{tags.includes(tag) && <Icon name="check" size={14} />}{tag}</button>)}</div>
        <TextArea label="OPTIONAL NOTE" value={note} onChange={(event) => setNote(event.target.value)} placeholder="A few private words, if you want" rows={3} />
        {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}
        <Button icon="arrow-right" onClick={save} disabled={busy}>{busy ? 'Saving…' : score || tags.length || note.trim() ? 'Save check-in' : 'Continue without answering'}</Button>
      </div>
    </div>
  );
}

function CompanionScreen({ companion, onNavigate, onUpdated, onDeleted }: { companion: Companion | null; onNavigate: (route: Route) => void; onUpdated: (value: Companion) => void; onDeleted: () => void }) {
  const [memory, setMemory] = useState('');
  const [previewText, setPreviewText] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  if (!companion) return <EmptyState image="/assets/consent-botanical.webp" eyebrow="NO COMPANION YET" title="Choose a voice with care." action={<Button onClick={() => onNavigate('setup')}>Begin setup</Button>}>Your profile begins empty and is created only from details you provide.</EmptyState>;

  const addMemory = async () => {
    if (!memory.trim()) return;
    setBusy('Saving the approved memory…'); setError('');
    try {
      const saved = await api.updateCompanion(companion.id, { memories: [memory.trim(), ...(companion.memories || [])] });
      setMemory(''); onUpdated(saved);
    } catch (cause) { setError(displayError(cause)); }
    finally { setBusy(''); }
  };
  const removeMemory = async (index: number) => {
    setBusy('Removing the memory…'); setError('');
    try { onUpdated(await api.updateCompanion(companion.id, { memories: (companion.memories || []).filter((_, itemIndex) => itemIndex !== index) })); }
    catch (cause) { setError(displayError(cause)); }
    finally { setBusy(''); }
  };
  const preview = async () => {
    if (!companion.voicebox_profile_id || !previewText.trim()) return;
    setBusy('Generating the requested preview…'); setError(''); setAudioUrl('');
    try {
      const result = await resolveVoiceGeneration(await api.generateVoice({ text: previewText.trim(), profile_id: companion.voicebox_profile_id }));
      if (!result.audio_url) throw new Error(result.detail || `Voicebox returned ${result.status || 'no playable audio yet'}.`);
      setAudioUrl(result.audio_url);
    } catch (cause) { setError(displayError(cause)); }
    finally { setBusy(''); }
  };
  const remove = async () => {
    if (!window.confirm(`Delete ${companion.name}'s companion profile from the Saanjh server?`)) return;
    setBusy('Deleting the companion…'); setError('');
    try {
      // The backend deletes the linked Voicebox profile first and preserves
      // this record if remote cleanup cannot be completed.
      await api.deleteCompanion(companion.id);
      onDeleted();
    }
    catch (cause) { setError(displayError(cause)); }
    finally { setBusy(''); }
  };
  return (
    <div className="screen screen--companion">
      <PageHeader eyebrow="YOUR COMPANION" title={companion.name} action={<Badge icon="sparkles">{companion.voice_status === 'memorial' ? 'AI memorial' : 'AI voice'}</Badge>} />
      <section className="companion-hero reveal">
        <div className="companion-hero__botanical"><img src="/assets/consent-botanical.webp" alt="" /></div>
        <div className="companion-portrait"><img src={mediaUrl(companion.avatar_uri || companion.avatar_url) || '/assets/botanical-emblem.webp'} alt="" /><span><Icon name="shield" size={15} /></span></div>
        <div><p className="eyebrow">{companion.relationship}</p><h2>{companion.name}</h2><Badge tone="sage" icon="shield">{companion.voice_status === 'self' ? 'Your own voice' : companion.voice_status === 'consented' ? 'Consent recorded' : 'AI memorial voice'}</Badge></div>
        <div className="companion-actions"><Button icon="phone" onClick={() => onNavigate('precall')} disabled={!companion.voicebox_profile_id}>Voice session</Button><Button variant="secondary" icon="message" onClick={() => onNavigate('chat')}>Text chat</Button></div>
      </section>
      <Notice title="Always AI-generated" icon="sparkles">{companion.voice_status === 'memorial' ? `This is an AI memorial voice inspired by ${companion.name}, never the actual person.` : `Saanjh never claims to literally be ${companion.name}.`}</Notice>
      <section className="section"><div className="section__heading"><div><p className="eyebrow">VOICE</p><h2>Hear only what you ask for</h2></div></div><div className="preview-card"><TextArea label="WORDS FOR THE PREVIEW" value={previewText} onChange={(event) => setPreviewText(event.target.value)} placeholder="Type the exact words you want the AI voice to speak" rows={3} /><Button icon="volume" onClick={preview} disabled={!previewText.trim() || !companion.voicebox_profile_id || Boolean(busy)}>Generate preview</Button>{audioUrl && <audio className="audio-player" src={audioUrl} controls autoPlay />}</div></section>
      <section className="section"><div className="section__heading"><div><p className="eyebrow">VOICE & TONE</p><h2>How they support you</h2></div></div>{companion.traits?.length ? <div className="chip-row">{companion.traits.map((trait) => <span className="chip is-selected" key={trait}>{trait}</span>)}</div> : <p className="empty-copy">No support traits have been added.</p>}</section>
      <section className="section"><div className="section__heading"><div><p className="eyebrow">APPROVED MEMORIES</p><h2>Only what you enter</h2></div></div><p className="section-help">These are the only personal details explicitly approved for the companion prompt.</p><div className="inline-form"><input value={memory} onChange={(event) => setMemory(event.target.value)} placeholder="Add one real detail" /><IconButton label="Add memory" icon="plus" onClick={addMemory} disabled={!memory.trim()} /></div>{companion.memories?.length ? <div className="memory-list">{companion.memories.map((item, index) => <div key={`${item}-${index}`}><Icon name="leaf" /><p>{item}</p><IconButton label="Remove memory" icon="x" onClick={() => removeMemory(index)} /></div>)}</div> : <p className="empty-copy">No approved memories are stored.</p>}</section>
      {busy && <Busy label={busy} />}{error && <ErrorBanner message={error} onDismiss={() => setError('')} />}
      <div className="danger-zone"><div><strong>Remove this companion</strong><p>This asks the Saanjh server to delete the profile.</p></div><Button variant="danger" icon="trash" onClick={remove}>Delete profile</Button></div>
    </div>
  );
}

function MessageList({ messages, companionName }: { messages: ChatMessage[]; companionName: string }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages]);
  return (
    <div className="message-list" aria-live="polite">
      {!messages.length && <div className="conversation-empty"><span><Icon name="leaf" size={24} /></span><h2>The conversation begins with you.</h2><p>No reply is pre-written. Share only what you want the AI companion to respond to.</p></div>}
      {messages.map((message) => <article key={message.id} className={`message message--${message.role}`}><small>{message.role === 'user' ? 'YOU' : `${companionName.toUpperCase()} · AI`}</small><p>{message.content}</p>{message.audio_url && <audio src={mediaUrl(message.audio_url)} controls />}</article>)}
      <div ref={endRef} />
    </div>
  );
}

function ChatScreen({ companion, session, onBack, onSession, onFinish, onSafety }: { companion: Companion; session?: Session; onBack: () => void; onSession: (session: Session) => void; onFinish: (sessionId?: string) => void; onSafety: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>(session?.messages || []);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const ensureSession = async () => {
    if (session) return session;
    const created = await api.createSession(companion.id, 'text');
    onSession(created);
    return created;
  };
  const send = async (event?: FormEvent) => {
    event?.preventDefault();
    const clean = text.trim(); if (!clean || busy) return;
    if (DISTRESS_PATTERN.test(clean)) { setText(''); onSafety(); return; }
    const optimistic = localMessage(clean, 'user', 'text');
    setText(''); setMessages((items) => [...items, optimistic]); setBusy(true); setError('');
    try {
      const active = await ensureSession();
      const response = await api.chat({ companion_id: companion.id, session_id: active.id, message: clean, modality: 'text' });
      const userMessage = normalizeMessage(response.user_message, optimistic) || optimistic;
      const assistant = normalizeMessage(response.assistant_message);
      if (!assistant) throw new Error('The server returned no companion reply.');
      if (response.audio_url && !assistant.audio_url) assistant.audio_url = response.audio_url;
      setMessages((items) => [...items.filter((item) => item.id !== optimistic.id), userMessage, assistant]);
    } catch (cause) { setError(displayError(cause)); }
    finally { setBusy(false); }
  };
  return (
    <div className="chat-screen">
      <header className="chat-header paper-surface"><IconButton label="Go back" icon="arrow-left" onClick={onBack} /><div className="chat-person"><img src={mediaUrl(companion.avatar_uri || companion.avatar_url) || '/assets/botanical-emblem.webp'} alt="" /><span><strong>{companion.name}</strong><small><i /> AI companion</small></span></div><Button variant="ghost" onClick={() => onFinish(session?.id)}>Finish</Button></header>
      <MessageList messages={messages} companionName={companion.name} />
      {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}
      <form className="chat-composer paper-surface" onSubmit={send}><textarea aria-label="Your message" value={text} onChange={(event) => setText(event.target.value)} placeholder="Write what is true for you…" rows={1} disabled={busy} /><button aria-label="Send message" disabled={!text.trim() || busy}><Icon name={busy ? 'sparkles' : 'send'} /></button></form>
    </div>
  );
}

function PreCallScreen({ companion, health, onBack, onStart }: { companion: Companion; health?: HealthResponse; onBack: () => void; onStart: (intention: string, score?: number) => void }) {
  const [intention, setIntention] = useState('');
  const [score, setScore] = useState<number>();
  const ready = Boolean(companion.voicebox_profile_id && health?.voicebox.online && health?.groq.online);
  return (
    <div className="screen screen--precall">
      <PageHeader onBack={onBack} eyebrow="BEFORE THE SESSION" title={<>Let's get<br /><em>settled.</em></>} description="Set an intention if it helps. You remain in control of every turn." />
      <section className="precall-profile reveal"><div className="precall-profile__art"><img src="/assets/consent-botanical.webp" alt="" /></div><img className="precall-profile__avatar" src={mediaUrl(companion.avatar_uri || companion.avatar_url) || '/assets/botanical-emblem.webp'} alt="" /><div><p className="eyebrow">YOUR AI COMPANION</p><h2>{companion.name}</h2><p>{companion.traits?.length ? companion.traits.join(' · ') : 'Your configured companion voice'}</p></div><Icon name="check" /></section>
      <section className="precall-card"><span className="field__label">HOW ARE YOU ARRIVING? · OPTIONAL</span><MoodPicker score={score} onChange={setScore} /><TextArea label="WHAT WOULD HELP RIGHT NOW?" value={intention} onChange={(event) => setIntention(event.target.value)} placeholder="Optional — such as “I need to talk it through”" rows={3} /><div className="service-readiness"><ServicePill label="Groq" configured={Boolean(health?.groq.configured)} online={Boolean(health?.groq.online)} /><ServicePill label="Voicebox" configured={Boolean(health?.voicebox.configured)} online={Boolean(health?.voicebox.online)} /></div></section>
      <Notice tone="dark" icon="shield" title="Turn-based and clearly AI">The microphone records only after you tap. The backend transcribes, creates the AI reply, and asks Voicebox to speak it.</Notice>
      <Button icon="phone" onClick={() => onStart(intention.trim(), score)} disabled={!ready}>Start AI voice session</Button>
      {!ready && <p className="helper-centered">The server must report both Groq and Voicebox online before a voice session can start.</p>}
    </div>
  );
}

function VoiceWave({ active }: { active: boolean }) {
  return <div className={`voice-wave ${active ? 'is-active' : ''}`} aria-hidden="true">{Array.from({ length: 17 }, (_, index) => <i key={index} style={{ '--i': index } as CSSProperties} />)}</div>;
}

function VoiceSessionScreen({ companion, session, reducedMotion, onEnd, onSafety }: { companion: Companion; session: Session; reducedMotion: boolean; onEnd: (sessionId: string) => void; onSafety: () => void }) {
  const recorder = useMicrophoneRecorder('saanjh-session-turn');
  const [messages, setMessages] = useState<ChatMessage[]>(session.messages || []);
  const [phase, setPhase] = useState<'ready' | 'recording' | 'transcribing' | 'thinking' | 'speaking' | 'error'>('ready');
  const [error, setError] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [playbackUrl, setPlaybackUrl] = useState('');
  const [playbackBlocked, setPlaybackBlocked] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  useEffect(() => { const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000); return () => window.clearInterval(timer); }, []);
  const phaseLabel = { ready: 'Ready when you are', recording: `Listening · ${recorder.seconds}s`, transcribing: 'Transcribing with Voicebox', thinking: 'The AI is responding', speaking: 'AI voice is speaking', error: 'Paused after an error' }[phase];

  const process = async (file: File) => {
    setError('');
    try {
      setPhase('transcribing');
      const transcript = await api.transcribe(file);
      if (DISTRESS_PATTERN.test(transcript)) { setPhase('ready'); onSafety(); return; }
      const user = localMessage(transcript, 'user', 'voice');
      setMessages((items) => [...items, user]);
      setPhase('thinking');
      const response = await api.chat({ companion_id: companion.id, session_id: session.id, message: transcript, modality: 'voice' });
      const persistedUser = normalizeMessage(response.user_message, user) || user;
      const assistant = normalizeMessage(response.assistant_message);
      if (!assistant) throw new Error('The server returned no companion reply.');
      let audio = mediaUrl(response.audio_url || assistant.audio_url);
      if (!audio && companion.voicebox_profile_id) {
        const generated = await resolveVoiceGeneration(await api.generateVoice({ text: assistant.content, profile_id: companion.voicebox_profile_id }));
        audio = generated.audio_url;
        if (!audio && generated.status && generated.status !== 'completed') {
          setError(generated.detail || `Voicebox generation is ${generated.status}; audio is not available yet.`);
        }
      }
      assistant.audio_url = audio;
      setMessages((items) => [...items.filter((item) => item.id !== user.id), persistedUser, assistant]);
      if (audio) {
        setPlaybackUrl(audio);
        setPlaybackBlocked(false);
        setPhase('speaking');
        window.setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.src = audio!;
            audioRef.current.play().catch(() => {
              setPlaybackBlocked(true);
              setError('The browser blocked automatic playback. Tap “Play AI voice” below to hear the real generated audio.');
              setPhase('ready');
            });
          }
        }, 20);
      } else setPhase('ready');
    } catch (cause) { setError(displayError(cause)); setPhase('error'); }
  };

  const toggle = async () => {
    if (recorder.recording) {
      try { const file = await recorder.stop(); await process(file); }
      catch (cause) { setError(displayError(cause)); setPhase('error'); }
      return;
    }
    try { await recorder.start(); setPhase('recording'); setError(''); }
    catch (cause) { setError(displayError(cause)); setPhase('error'); }
  };
  const end = async () => {
    try { if (recorder.recording) await recorder.stop(); await api.updateSession(session.id, { status: 'completed', ended_at: new Date().toISOString() }); onEnd(session.id); }
    catch (cause) { setError(displayError(cause)); }
  };
  const playGeneratedAudio = () => {
    if (!audioRef.current || !playbackUrl) return;
    audioRef.current.src = playbackUrl;
    setPlaybackBlocked(false);
    setError('');
    setPhase('speaking');
    audioRef.current.play().catch((cause) => { setPlaybackBlocked(true); setError(displayError(cause)); setPhase('ready'); });
  };
  return (
    <div className={`voice-session ${reducedMotion ? 'reduce-motion' : ''}`}>
      <img src="/assets/session-forest-night.webp" alt="Night forest with a warm botanical light" className="voice-session__backdrop" />
      <div className="voice-session__shade" />
      <header><Badge tone="dark" icon="sparkles">{companion.voice_status === 'memorial' ? 'AI memorial session' : 'AI voice session'}</Badge><time>{String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</time></header>
      <section className="voice-session__identity"><span>Comfort call</span><h1>I'm here<br /><em>with you.</em></h1><p>{companion.name} · AI-generated, not the real person</p></section>
      <div className={`presence-ring ${phase !== 'ready' && phase !== 'error' ? 'is-active' : ''}`}><i /><i /><i /><span><Icon name="leaf" size={30} /></span></div>
      <VoiceWave active={phase !== 'ready' && phase !== 'error'} /><p className="phase-label" aria-live="polite">{phaseLabel}</p>
      <div className="voice-captions"><MessageList messages={messages} companionName={companion.name} /></div>
      {playbackUrl && (playbackBlocked || phase === 'ready') && <button className="voice-playback" onClick={playGeneratedAudio}><Icon name="play" size={16} /> Play AI voice</button>}
      {error && <div className="voice-error"><Icon name="cloud" /><p>{error}</p><button onClick={() => { setError(''); setPhase('ready'); }}><Icon name="x" /></button></div>}
      <div className="voice-controls"><button className={`voice-control voice-control--mic ${recorder.recording ? 'is-recording' : ''}`} onClick={toggle} disabled={phase === 'transcribing' || phase === 'thinking' || phase === 'speaking'}><Icon name={recorder.recording ? 'stop' : 'mic'} size={27} /><small>{recorder.recording ? 'Stop' : 'Speak'}</small></button><button className="voice-control voice-control--end" onClick={end}><Icon name="phone-off" size={27} /><small>End</small></button></div>
      <audio ref={audioRef} onEnded={() => { setPlaybackBlocked(false); setPhase('ready'); }} onError={() => { setPlaybackBlocked(true); setError('The generated audio could not be played.'); setPhase('ready'); }} />
    </div>
  );
}

function AftercareScreen({ sessionId, onFinish }: { sessionId?: string; onFinish: (mood?: MoodEntry, journal?: JournalEntry) => void }) {
  const [score, setScore] = useState<number>();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    setBusy(true); setError('');
    try {
      const selected = MOODS.find((item) => item.score === score);
      const mood = score ? await api.createMood({ mood: selected?.label || String(score), score, context: 'after-session', session_id: sessionId }) : undefined;
      const journal = note.trim() ? await api.createJournal({ title: undefined, body: note.trim(), session_id: sessionId }) : undefined;
      onFinish(mood, journal);
    } catch (cause) { setError(displayError(cause)); }
    finally { setBusy(false); }
  };
  return (
    <div className="aftercare-screen paper-surface">
      <div className="aftercare-screen__image"><img src="/assets/journal-stilllife.webp" alt="Open journal beside a warm cup" /></div>
      <div className="aftercare-screen__panel reveal"><p className="eyebrow">AFTER THE SESSION</p><h1>Take a moment<br /><em>for you.</em></h1><p className="lead">You showed up for yourself. This optional reflection is yours to keep or skip.</p><span className="field__label">HOW ARE YOU FEELING NOW?</span><MoodPicker score={score} onChange={setScore} /><TextArea label="PRIVATE AFTERCARE NOTE · OPTIONAL" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Only save what you choose" rows={4} />{error && <ErrorBanner message={error} onDismiss={() => setError('')} />}<Button onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save and finish'}</Button><Button variant="ghost" onClick={() => onFinish()}>Finish without saving</Button><Notice title="No pressure to continue">There are no streaks or prompts designed to make it difficult to leave.</Notice></div>
    </div>
  );
}

function SafetyScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="safety-screen paper-surface">
      <div className="safety-screen__art"><img src="/assets/welcome-forest.webp" alt="Misty forest at sunrise" /></div>
      <main className="safety-screen__content reveal">
        <Badge tone="clay" icon="shield">Immediate human support</Badge>
        <p className="eyebrow">PAUSE THE AI CONVERSATION</p>
        <h1>You do not have to<br /><em>hold this alone.</em></h1>
        <p className="lead">Saanjh is not an emergency service. If you may act on these thoughts or you are in immediate danger, contact real-world help now.</p>
        <div className="safety-actions">
          <article><span>01</span><div><strong>Call your local emergency number</strong><p>Or go to the nearest emergency department.</p></div></article>
          <article><span>02</span><div><strong>Move near another person</strong><p>Do not stay alone while the danger feels immediate.</p></div></article>
          <article><span>03</span><div><strong>Contact someone you trust</strong><p>Ask them to stay with you or help you reach professional support.</p></div></article>
        </div>
        <Notice tone="dark" icon="heart" title="Your safety comes before this app">Close Saanjh if needed and keep reaching for human help until someone responds.</Notice>
        <Button variant="secondary" icon="arrow-left" onClick={onBack}>Return to today</Button>
      </main>
    </div>
  );
}

function JournalScreen({ entries, onCreated, onDeleted }: { entries: JournalEntry[]; onCreated: (entry: JournalEntry) => void; onDeleted: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ordered = useMemo(() => [...entries].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()), [entries]);
  const save = async (event: FormEvent) => {
    event.preventDefault(); if (!body.trim()) return;
    setBusy(true); setError('');
    try { const entry = await api.createJournal({ title: title.trim() || undefined, body: body.trim(), session_id: undefined }); onCreated(entry); setTitle(''); setBody(''); setOpen(false); }
    catch (cause) { setError(displayError(cause)); }
    finally { setBusy(false); }
  };
  const remove = async (id: string) => {
    if (!window.confirm('Delete this private reflection from the server?')) return;
    try { await api.deleteJournal(id); onDeleted(id); }
    catch (cause) { setError(displayError(cause)); }
  };
  return (
    <div className="screen screen--journal">
      <PageHeader eyebrow="PRIVATE REFLECTIONS" title={<>Your<br /><em>journal.</em></>} description="Nothing is generated here. Every entry comes from words you chose to save." action={<IconButton label="New reflection" icon="plus" onClick={() => setOpen(true)} />} />
      {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}
      {!ordered.length ? <EmptyState image="/assets/journal-stilllife.webp" eyebrow="NO SAVED REFLECTIONS" title="Your journal is empty." action={<Button icon="plus" onClick={() => setOpen(true)}>Write the first note</Button>}>When you save a reflection through Saanjh, the server will return it here.</EmptyState> : <div className="journal-layout"><div className="journal-feature"><img src="/assets/journal-stilllife.webp" alt="Open journal in soft morning light" /><div><p className="eyebrow">YOUR WORDS, HELD GENTLY</p><h2>{ordered.length} saved {ordered.length === 1 ? 'reflection' : 'reflections'}</h2><Button variant="cream" icon="plus" onClick={() => setOpen(true)}>New reflection</Button></div></div><div className="entry-list">{ordered.map((entry, index) => <article className="journal-entry" key={entry.id} style={{ '--delay': `${Math.min(index, 8) * 60}ms` } as CSSProperties}><div><time>{formatDate(entry.created_at, true)}</time><h3>{entry.title || 'Private reflection'}</h3><p>{entry.body}</p></div><IconButton label="Delete reflection" icon="trash" onClick={() => remove(entry.id)} /></article>)}</div></div>}
      {open && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}><form className="sheet paper-surface" onSubmit={save}><div className="sheet__handle" /><header><div><p className="eyebrow">PRIVATE REFLECTION</p><h2>A note for yourself</h2></div><IconButton label="Close" icon="x" onClick={() => setOpen(false)} type="button" /></header><Field label="TITLE · OPTIONAL" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Name this moment" autoFocus /><TextArea label="YOUR WORDS" value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write what is true for you" rows={7} />{error && <ErrorBanner message={error} />}<Button type="submit" disabled={!body.trim() || busy}>{busy ? 'Saving…' : 'Save private reflection'}</Button></form></div>}
    </div>
  );
}

function SettingsScreen({ health, reducedMotion, onReducedMotion, onRefresh }: { health?: HealthResponse; reducedMotion: boolean; onReducedMotion: (value: boolean) => void; onRefresh: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const refresh = async () => { setBusy(true); setError(''); try { await onRefresh(); } catch (cause) { setError(displayError(cause)); } finally { setBusy(false); } };
  const services = [
    { name: 'Groq', icon: 'sparkles' as const, service: health?.groq, detail: health?.groq.model ? `Model: ${health.groq.model}` : health?.groq.detail },
    { name: 'Voicebox', icon: 'volume' as const, service: health?.voicebox, detail: health?.voicebox.detail || (health?.voicebox.url ? 'Managed by the Saanjh server' : undefined) },
  ];
  return (
    <div className="screen screen--settings">
      <PageHeader eyebrow="CONTROL & TRANSPARENCY" title={<>Settings<br /><em>& services.</em></>} description="The browser talks only to the Saanjh backend. Groq and Voicebox credentials remain server-side." action={<IconButton label="Refresh service status" icon="refresh" onClick={refresh} />} />
      {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}
      <section className="settings-section"><div className="section__heading"><div><p className="eyebrow">CONNECTIONS</p><h2>Backend services</h2></div><Badge tone={health?.status === 'ok' || health?.status === 'healthy' ? 'sage' : 'clay'}>{health?.status || 'Status unavailable'}</Badge></div><div className="service-cards">{services.map(({ name, icon, service, detail }) => <article className="service-card" key={name}><span className="service-card__icon"><Icon name={icon} /></span><div><div className="service-card__title"><h3>{name}</h3><ServicePill label="Service" configured={Boolean(service?.configured)} online={Boolean(service?.online)} /></div><p>{detail || 'No service detail was returned by the API.'}</p></div></article>)}</div><div className="backend-address"><Icon name="shield" /><div><strong>Saanjh API gateway</strong><code>{API_BASE_URL}</code></div><Badge tone="cream">Frontend only</Badge></div>{busy && <Busy label="Refreshing service status…" />}</section>
      <section className="settings-section"><div className="section__heading"><div><p className="eyebrow">ACCESSIBILITY</p><h2>Motion & comfort</h2></div></div><label className="setting-row"><span className="setting-row__icon"><Icon name="leaf" /></span><span><strong>Reduce ambient motion</strong><small>Stops decorative breathing, ripple, and forest drift effects in this browser.</small></span><button role="switch" aria-checked={reducedMotion} className={reducedMotion ? 'switch is-on' : 'switch'} onClick={() => onReducedMotion(!reducedMotion)}><i /></button></label></section>
      <section className="settings-section"><div className="section__heading"><div><p className="eyebrow">PRIVACY</p><h2>What this frontend does</h2></div></div><div className="privacy-grid"><Notice title="Server-mediated AI" icon="lock">This frontend never calls Groq or Voicebox directly. Requests go to the configured Saanjh API.</Notice><Notice title="No seeded stories" icon="book">Companions, messages, moods, and journal entries appear only after the API or your input provides them.</Notice><Notice tone="clay" title="Prototype boundary" icon="shield">Review server storage and deployment security before using this as a production service.</Notice></div></section>
    </div>
  );
}

export default function App() {
  const [route, setRoute] = useState<Route>('today');
  const [companion, setCompanion] = useState<Companion | null>(null);
  const [moods, setMoods] = useState<MoodEntry[]>([]);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [health, setHealth] = useState<HealthResponse>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeSession, setActiveSession] = useState<Session>();
  const [afterSessionId, setAfterSessionId] = useState<string>();
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false);

  const loadAll = useCallback(async () => {
    const results = await Promise.allSettled([api.companion(), api.moods(), api.journal(), api.health()]);
    const [companionResult, moodsResult, journalResult, healthResult] = results;
    if (companionResult.status === 'fulfilled') setCompanion(companionResult.value);
    if (moodsResult.status === 'fulfilled') setMoods(moodsResult.value);
    if (journalResult.status === 'fulfilled') setJournal(journalResult.value);
    if (healthResult.status === 'fulfilled') setHealth(healthResult.value);
    const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
    if (failures.length) setError(`The Saanjh API could not load ${failures.length === results.length ? 'your space' : 'every section'}: ${displayError(failures[0].reason)}`);
  }, []);

  useEffect(() => { loadAll().finally(() => setLoading(false)); }, [loadAll]);
  useEffect(() => { document.documentElement.dataset.reduceMotion = reducedMotion ? 'true' : 'false'; }, [reducedMotion]);

  const refreshHealth = async () => { const result = await api.health(); setHealth(result); };
  const startSession = async (kind: SessionKind, intention?: string, score?: number) => {
    if (!companion) { setRoute('setup'); return; }
    setError('');
    try {
      if (score) {
        const selected = MOODS.find((item) => item.score === score);
        const mood = await api.createMood({ mood: selected?.label || String(score), score, context: 'before-session' });
        setMoods((items) => [mood, ...items]);
      }
      const session = await api.createSession(companion.id, kind, intention);
      setActiveSession(session);
      setRoute(kind === 'voice' ? 'voice' : 'chat');
    } catch (cause) { setError(displayError(cause)); }
  };
  const navigate = (next: Route) => {
    if (next === 'chat' && companion && !activeSession) { void startSession('text'); return; }
    setRoute(next);
    window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
  };
  const finishSession = (sessionId?: string) => {
    if (sessionId) void api.updateSession(sessionId, { status: 'completed', ended_at: new Date().toISOString() }).catch((cause) => setError(displayError(cause)));
    setAfterSessionId(sessionId || activeSession?.id);
    setActiveSession(undefined);
    setRoute('aftercare');
  };

  if (loading) return <Busy fullscreen />;
  if (route === 'safety') return <SafetyScreen onBack={() => setRoute('today')} />;
  if (route === 'setup') return <CompanionSetup health={health} initial={companion} onCancel={() => setRoute(companion ? 'companion' : 'today')} onComplete={(value) => { setCompanion(value); setRoute('today'); }} />;
  if (route === 'mood') return <MoodScreen onBack={() => setRoute('today')} onSaved={(entry) => { setMoods((items) => [entry, ...items]); setRoute('today'); }} />;
  if (route === 'precall' && companion) return <PreCallScreen companion={companion} health={health} onBack={() => setRoute('today')} onStart={(intention, score) => void startSession('voice', intention, score)} />;
  if (route === 'voice' && companion && activeSession) return <VoiceSessionScreen companion={companion} session={activeSession} reducedMotion={reducedMotion} onSafety={() => setRoute('safety')} onEnd={(sessionId) => { setAfterSessionId(sessionId); setActiveSession(undefined); setRoute('aftercare'); }} />;
  if (route === 'aftercare') return <AftercareScreen sessionId={afterSessionId} onFinish={(mood, entry) => { if (mood) setMoods((items) => [mood, ...items]); if (entry) setJournal((items) => [entry, ...items]); setAfterSessionId(undefined); setRoute('today'); }} />;

  let content: ReactNode;
  if (route === 'companion') content = <CompanionScreen companion={companion} onNavigate={navigate} onUpdated={setCompanion} onDeleted={() => { setCompanion(null); setActiveSession(undefined); setRoute('today'); }} />;
  else if (route === 'chat' && companion) content = <ChatScreen companion={companion} session={activeSession} onBack={() => setRoute('today')} onSession={setActiveSession} onFinish={finishSession} onSafety={() => setRoute('safety')} />;
  else if (route === 'journal') content = <JournalScreen entries={journal} onCreated={(entry) => setJournal((items) => [entry, ...items])} onDeleted={(id) => setJournal((items) => items.filter((entry) => entry.id !== id))} />;
  else if (route === 'settings') content = <SettingsScreen health={health} reducedMotion={reducedMotion} onReducedMotion={setReducedMotion} onRefresh={refreshHealth} />;
  else content = <TodayScreen companion={companion} moods={moods} journal={journal} health={health} onNavigate={navigate} onStartSession={(kind) => void startSession(kind)} />;

  return (
    <AppShell route={route} companion={companion} health={health} onNavigate={navigate}>
      {error && <div className="global-error"><ErrorBanner message={error} onDismiss={() => setError('')} /></div>}
      {content}
    </AppShell>
  );
}
