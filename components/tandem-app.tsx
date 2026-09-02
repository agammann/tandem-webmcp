'use client';

import {
  Check,
  Clipboard,
  Download,
  Headphones,
  LockKeyhole,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Save,
  ShieldCheck,
  Upload,
  Waves,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAudioEngine } from '@/hooks/use-audio-engine';
import { FLAT_PROFILE, profileSummary } from '@/lib/eq';
import { exportableSession, profileForSide, useTandemStore } from '@/lib/store';
import type { EqProfile, FeedbackTag, VoteChoice } from '@/lib/types';
import { EQ_BANDS } from '@/lib/types';
import { registerTandemTools } from '@/lib/webmcp';

const AGENT_PROMPT =
  'Help me calibrate this listening session. Read tandem’s calibration skill, inspect the current state, and stage the first blind A/B trial. Do not choose for me.';

const FEEDBACK_TAGS: FeedbackTag[] = [
  'Clearer',
  'Warmer',
  'Less harsh',
  'Less muddy',
  'Less tiring',
  'Too thin',
  'No meaningful difference',
];

const STATUS_LABELS = {
  setup: 'Setup',
  audio_ready: 'Audio ready',
  trial_pending: 'Blind trial pending',
  feedback_recorded: 'Feedback recorded',
  review_ready: 'Final review available',
  final_staged: 'Final profile staged',
  approved: 'Profile approved',
} as const;

function requestId(prefix: string): string {
  return `manual-${prefix}-${crypto.randomUUID()}`;
}

function manualProfiles(index: number): { one: EqProfile; two: EqProfile; question: string; rationale: string } {
  if (index === 0) {
    return {
      one: { ...FLAT_PROFILE, presence: 0.5, clarity: 1.5 },
      two: { ...FLAT_PROFILE, low: 0.5, warmth: 1.0 },
      question: 'Which version sounds clearer without becoming harsh?',
      rationale: 'A small clarity lift is compared with a gentle warmth lift; only two related variables change per candidate.',
    };
  }
  return {
    one: { ...FLAT_PROFILE, presence: 1.0, clarity: 1.5 },
    two: { ...FLAT_PROFILE, presence: 0.5, air: 1.0 },
    question: 'Which version keeps detail while feeling less tiring?',
    rationale: 'This narrows the comparison to presence versus air after the first human judgment.',
  };
}

function preferredProfileForTrial(trial: ReturnType<typeof useTandemStore.getState>['completedTrials'][number]): EqProfile {
  if (trial.feedback.choice === 'no_preference') return FLAT_PROFILE;
  return profileForSide(trial, trial.feedback.choice) ?? FLAT_PROFILE;
}

function averagedPreferredProfile() {
  const trials = useTandemStore.getState().completedTrials;
  if (!trials.length) return FLAT_PROFILE;
  const profiles = trials.map(preferredProfileForTrial);
  return Object.fromEntries(
    EQ_BANDS.map(({ key }) => [
      key,
      Math.round((profiles.reduce((sum, profile) => sum + profile[key], 0) / profiles.length) * 2) / 2,
    ]),
  ) as EqProfile;
}

function ProfileMeters({ profile, label }: { profile: EqProfile; label: string }) {
  return (
    <div className="profile-meters" aria-label={`${label} EQ values`}>
      <p className="profile-label">{label}</p>
      {EQ_BANDS.map(({ key, label: bandLabel, frequency }) => (
        <div className="meter-row" key={key}>
          <span>{bandLabel}<small>{frequency >= 1000 ? `${frequency / 1000}k` : frequency} Hz</small></span>
          <div className="meter-track" aria-hidden="true">
            <span className="meter-zero" />
            <span
              className={`meter-fill ${profile[key] < 0 ? 'negative' : ''}`}
              style={{
                width: `${Math.abs(profile[key]) / 12 * 100}%`,
                left: profile[key] < 0 ? `${50 - Math.abs(profile[key]) / 12 * 100}%` : '50%',
              }}
            />
          </div>
          <output>{profile[key] > 0 ? '+' : ''}{profile[key].toFixed(1)}</output>
        </div>
      ))}
    </div>
  );
}

export function TandemApp() {
  const store = useTandemStore();
  const {
    canvasRef,
    isPlaying,
    isUnlocked,
    selectedOutput,
    error: audioError,
    loadDemo,
    loadFile,
    unlock,
    togglePlayback,
    selectOutput,
    applyProfiles,
    applyFinalProfile,
  } = useAudioEngine();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);
  const [webmcpStatus, setWebmcpStatus] = useState<'available' | 'manual' | 'error'>('manual');
  const [selectedVote, setSelectedVote] = useState<VoteChoice | null>(null);
  const [tags, setTags] = useState<FeedbackTag[]>([]);
  const [note, setNote] = useState('');
  const [copyStatus, setCopyStatus] = useState('Copy prompt');
  const [notice, setNotice] = useState('Ready to begin a local listening session.');

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) setMounted(true);
    });
    const handleStatus = (event: WindowEventMap['tandem:webmcp-status']) => {
      setWebmcpStatus(event.detail.available ? 'available' : event.detail.error ? 'error' : 'manual');
    };
    window.addEventListener('tandem:webmcp-status', handleStatus);
    const unregister = registerTandemTools();
    return () => {
      active = false;
      window.removeEventListener('tandem:webmcp-status', handleStatus);
      unregister();
    };
  }, []);

  const activeA = useMemo(() => profileForSide(store.activeTrial, 'A'), [store.activeTrial]);
  const activeB = useMemo(() => profileForSide(store.activeTrial, 'B'), [store.activeTrial]);

  useEffect(() => {
    if (activeA && activeB) applyProfiles(activeA, activeB);
  }, [activeA, activeB, applyProfiles]);

  useEffect(() => {
    if (store.stagedFinalProfile) applyFinalProfile(store.stagedFinalProfile.profile);
  }, [store.stagedFinalProfile, applyFinalProfile]);

  const prepareDemo = useCallback(() => {
    loadDemo();
    store.beginSession();
    useTandemStore.getState().markAudioReady('tandem demo loop');
    setNotice('Demo loop loaded. Unlock audio when you are ready to listen.');
  }, [loadDemo, store]);

  const prepareLocalFile = useCallback(
    async (file: File) => {
      await loadFile(file);
      store.beginSession();
      useTandemStore.getState().markAudioReady('local audio');
      setNotice('Local audio decoded on this device. It was not uploaded.');
    },
    [loadFile, store],
  );

  const stageManualTrial = useCallback(() => {
    const current = useTandemStore.getState();
    const next = manualProfiles(current.completedTrials.length);
    const result = current.stageTrial({
      requestId: requestId('trial'),
      expectedRevision: current.revision,
      question: next.question,
      candidateOne: next.one,
      candidateTwo: next.two,
      agentRationale: next.rationale,
    });
    setNotice(result.ok ? 'Manual fallback staged a randomized blind comparison.' : result.error ?? 'Could not stage trial.');
  }, []);

  const submitFeedback = useCallback(() => {
    if (!selectedVote) return;
    useTandemStore.getState().recordFeedback(selectedVote, tags, note);
    setSelectedVote(null);
    setTags([]);
    setNote('');
    setNotice('Human feedback recorded. The A/B mapping is now revealed in the trial history.');
  }, [note, selectedVote, tags]);

  const stageManualFinal = useCallback(() => {
    const current = useTandemStore.getState();
    const feedback = current.completedTrials.flatMap((trial) => trial.feedback.tags).join(', ') || 'the recorded choices';
    const result = current.stageFinal({
      requestId: requestId('final'),
      expectedRevision: current.revision,
      profile: averagedPreferredProfile(),
      explanation: `Manual fallback averaged the human-preferred profiles across two trials and preserved evidence from: ${feedback}.`,
    });
    setNotice(result.ok ? 'Manual fallback staged a final profile for your approval.' : result.error ?? 'Could not stage final profile.');
  }, []);

  const copyPrompt = useCallback(async () => {
    await navigator.clipboard.writeText(AGENT_PROMPT);
    setCopyStatus('Copied');
    window.setTimeout(() => setCopyStatus('Copy prompt'), 1800);
  }, []);

  const exportSession = useCallback(() => {
    const state = useTandemStore.getState();
    const blob = new Blob([JSON.stringify(exportableSession(state), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `tandem-${state.sessionId}.json`;
    anchor.hidden = true;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice('Session JSON exported by the human.');
  }, []);

  if (!mounted) return <main className="studio-loading">Preparing tandem…</main>;

  const canStageTrial = store.audioReady && ['audio_ready', 'feedback_recorded', 'review_ready'].includes(store.status);
  const finalProposal = store.status === 'final_staged' ? store.stagedFinalProfile : null;

  return (
    <main className="studio-shell">
      <header className="studio-header">
        <a className="wordmark" href="#workspace" aria-label="tandem home">tandem<span className="signal-dot" /></a>
        <div className="header-statuses">
          <span className={`tool-status ${webmcpStatus === 'available' ? 'online' : ''}`}>
            <Radio size={14} aria-hidden="true" />
            {webmcpStatus === 'available' ? 'Agent tools available' : 'Manual mode'}
          </span>
          <span className="privacy-chip"><ShieldCheck size={14} aria-hidden="true" /> local audio · never uploaded</span>
        </div>
      </header>

      <section className="intro" aria-labelledby="page-title">
        <p className="eyebrow">a blind listening lab for you + your agent</p>
        <h1 id="page-title">Your ears are the eval.</h1>
        <p className="lede">You bring your agent. tandem brings the listening lab. Your ears decide.</p>
        <div className="session-readout" aria-label="Session status">
          <span>session {store.sessionId.slice(-8)}</span><span>revision {store.revision}</span><span>{STATUS_LABELS[store.status]}</span>
        </div>
      </section>

      <section id="workspace" className="workspace" aria-label="Listening workspace">
        <div className="workspace-topline">
          <div>
            <p className="step-label">listening workspace</p>
            <h2>{store.activeTrial?.question ?? (finalProposal ? 'Compare the proposal with the original' : STATUS_LABELS[store.status])}</h2>
          </div>
          <span className="source-label">{store.audioSourceLabel}</span>
        </div>

        <canvas
          ref={canvasRef}
          className="waveform-canvas"
          aria-label="Audio spectrum visualization"
        />

        {!store.audioReady && (
          <div className="setup-panel">
            <div className="setup-copy">
              <Headphones size={28} aria-hidden="true" />
              <div><h3>Start a listening session</h3><p>Use the built-in synthesized demo loop or choose an audio file. Local files are decoded in this browser and never uploaded.</p></div>
            </div>
            <div className="setup-actions">
              <button className="primary-action" type="button" onClick={prepareDemo}>Load demo audio</button>
              <button className="secondary-action" type="button" onClick={() => fileInputRef.current?.click()}><Upload size={17} /> Choose local file</button>
              <input
                ref={fileInputRef}
                className="visually-hidden"
                type="file"
                accept="audio/*"
                aria-label="Choose a local audio file"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void prepareLocalFile(file);
                }}
              />
            </div>
          </div>
        )}

        {store.audioReady && (
          <div className="transport" aria-label="Audio controls">
            {!isUnlocked ? (
              <button className="primary-action" type="button" onClick={() => void unlock()}><LockKeyhole size={18} /> Unlock audio</button>
            ) : (
              <button className="transport-button" type="button" onClick={() => void togglePlayback()}>
                {isPlaying ? <Pause size={19} /> : <Play size={19} />} {isPlaying ? 'Pause' : 'Play'}
              </button>
            )}
            {store.activeTrial && (
              <div className="ab-switcher" aria-label="Switch between synchronized blind versions">
                <button className={selectedOutput === 'A' ? 'selected' : ''} onClick={() => selectOutput('A')} type="button" aria-pressed={selectedOutput === 'A'}>A</button>
                <button className={selectedOutput === 'B' ? 'selected' : ''} onClick={() => selectOutput('B')} type="button" aria-pressed={selectedOutput === 'B'}>B</button>
              </div>
            )}
            {finalProposal && (
              <div className="ab-switcher final-switcher" aria-label="Compare proposed profile with original audio">
                <button className={selectedOutput === 'A' ? 'selected' : ''} onClick={() => selectOutput('A')} type="button" aria-pressed={selectedOutput === 'A'}>Proposal</button>
                <button className={selectedOutput === 'Original' ? 'selected' : ''} onClick={() => selectOutput('Original')} type="button" aria-pressed={selectedOutput === 'Original'}>Original</button>
              </div>
            )}
            <span className="transport-note">One source · synchronized paths · 25 ms crossfade</span>
          </div>
        )}

        {store.activeTrial && (
          <section className="feedback-panel" aria-labelledby="feedback-title">
            <div className="blind-banner"><Waves size={18} /><span>Blind test</span> Settings and agent rationale stay hidden until you vote.</div>
            <h3 id="feedback-title">What did your ears tell you?</h3>
            <fieldset className="vote-row">
              <legend className="visually-hidden">Select your preference</legend>
              {(['A', 'B', 'no_preference'] as VoteChoice[]).map((choice) => (
                <button key={choice} className={selectedVote === choice ? 'selected-vote' : ''} type="button" aria-pressed={selectedVote === choice} onClick={() => setSelectedVote(choice)}>
                  {choice === 'no_preference' ? 'No preference' : `Prefer ${choice}`}
                </button>
              ))}
            </fieldset>
            <div className="tag-grid" aria-label="Feedback tags">
              {FEEDBACK_TAGS.map((tag) => (
                <label key={tag}><input type="checkbox" checked={tags.includes(tag)} onChange={() => setTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag])} /><span>{tag}</span></label>
              ))}
            </div>
            <label className="note-field">Optional note<textarea maxLength={280} value={note} onChange={(event) => setNote(event.target.value)} placeholder="e.g. A opened the vocal, but cymbals felt sharp" /></label>
            <button className="primary-action" type="button" disabled={!selectedVote} onClick={submitFeedback}>Record my feedback</button>
          </section>
        )}

        {finalProposal && (
          <section className="final-panel" aria-labelledby="final-title">
            <div><p className="provenance-label">{finalProposal.requestId.startsWith('manual-') ? 'Manual proposed' : 'Agent proposed'}</p><h3 id="final-title">Final EQ profile</h3><p>{finalProposal.explanation}</p></div>
            <ProfileMeters profile={finalProposal.profile} label="Proposed profile" />
            <div className="final-actions">
              <button className="primary-action" type="button" onClick={() => { store.approveFinal(); setNotice('Final profile approved by the human.'); }}><Check size={18} /> Approve profile</button>
              <button className="secondary-action" type="button" onClick={() => { store.rejectFinal(); setNotice('Proposal rejected. Another blind test can now be staged.'); }}>Reject</button>
              <button className="text-action" type="button" onClick={() => { store.rejectFinal(); setNotice('Ready for another blind test.'); }}><RotateCcw size={16} /> Request another test</button>
            </div>
          </section>
        )}

        {store.status === 'approved' && store.approvedProfile && (
          <section className="approved-panel" aria-labelledby="approved-title">
            <div className="approved-heading"><span><Check size={18} /></span><div><p className="provenance-label">Human approved</p><h3 id="approved-title">This profile is yours.</h3></div></div>
            <ProfileMeters profile={store.approvedProfile} label="Approved profile" />
            <div className="final-actions">
              <button className="primary-action" type="button" disabled={store.approvedProfileSaved} onClick={() => { store.saveApprovedProfile(); setNotice('Approved profile saved locally by the human.'); }}><Save size={18} /> {store.approvedProfileSaved ? 'Saved locally' : 'Save approved profile'}</button>
              <button className="secondary-action" type="button" onClick={exportSession}><Download size={18} /> Export session JSON</button>
            </div>
          </section>
        )}

        {canStageTrial && (
          <section className="handoff-panel">
            <div><p className="step-label">next handoff</p><h3>{store.completedTrials.length ? 'Ask your agent to adapt' : 'Invite your agent in'}</h3><p>{webmcpStatus === 'available' ? 'The four page tools are registered. Your agent can inspect this revision and stage a safe blind trial.' : 'Manual mode keeps the full human workflow available. You can stage a bounded example comparison below.'}</p></div>
            <button className="secondary-action" type="button" onClick={stageManualTrial}>Stage example · manual fallback</button>
          </section>
        )}

        {store.status === 'review_ready' && (
          <section className="review-ready">
            <div><p className="step-label">two trials complete</p><h3>A final profile can be staged.</h3><p>The agent may use your actual feedback, or you can continue testing.</p></div>
            <button className="secondary-action" type="button" onClick={stageManualFinal}>Stage final · manual fallback</button>
          </section>
        )}

        {audioError && <p className="error-message" role="alert">{audioError}</p>}
      </section>

      <div className="below-grid">
        <section className="agent-card" aria-labelledby="agent-prompt-title">
          <p className="step-label">bring your own agent</p>
          <h2 id="agent-prompt-title">A prompt with a boundary.</h2>
          <blockquote>{AGENT_PROMPT}</blockquote>
          <button className="text-action" type="button" onClick={() => void copyPrompt()}><Clipboard size={16} /> {copyStatus}</button>
          <div className="tool-list"><span>read</span><code>skill_calibrate_listening</code><span>read</span><code>get_calibration_state</code><span>change</span><code>stage_ab_trial</code><span>change</span><code>stage_final_profile</code></div>
          <p className="boundary-note">There is no tool to unlock audio, listen, vote, report subjective feedback, approve, save, or export.</p>
        </section>

        <section className="timeline-card" aria-labelledby="timeline-title">
          <p className="step-label">shared provenance</p><h2 id="timeline-title">Session timeline</h2>
          {store.timeline.length ? (
            <ol className="timeline-list">{store.timeline.map((event) => <li key={event.id}><span className={`timeline-dot ${event.actor.startsWith('Human') ? 'human' : ''}`} /><div><p>{event.actor}</p><span>{event.detail}</span><time>{new Date(event.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></div></li>)}</ol>
          ) : <p className="empty-timeline">Nothing has been staged yet. The timeline will show who did what.</p>}
        </section>
      </div>

      {store.completedTrials.length > 0 && (
        <section className="history" aria-labelledby="history-title">
          <p className="step-label">revealed after voting</p><h2 id="history-title">Trial history</h2>
          <div className="history-grid">{store.completedTrials.map((trial, index) => (
            <article key={trial.id}><div className="history-heading"><span>Trial {index + 1}</span><strong>{trial.feedback.choice === 'no_preference' ? 'No preference' : `Human preferred ${trial.feedback.choice}`}</strong></div><h3>{trial.question}</h3><p>{trial.agentRationale}</p><dl><div><dt>A</dt><dd>{profileSummary(profileForSide(trial, 'A') ?? FLAT_PROFILE)}</dd></div><div><dt>B</dt><dd>{profileSummary(profileForSide(trial, 'B') ?? FLAT_PROFILE)}</dd></div></dl>{trial.feedback.tags.length > 0 && <p className="tag-summary">{trial.feedback.tags.join(' · ')}</p>}{trial.feedback.note && <blockquote>“{trial.feedback.note}”</blockquote>}</article>
          ))}</div>
        </section>
      )}

      <footer>
        <p><span>Agent staged</span> the experiment. <span>Human preferred</span> the sound. <span>Agent proposed</span> the profile. <span>Human approved</span> the result.</p>
        <p>Listen first. Decide second.</p>
      </footer>
      <output className="visually-hidden" aria-live="polite" aria-atomic="true">{notice}</output>
    </main>
  );
}
