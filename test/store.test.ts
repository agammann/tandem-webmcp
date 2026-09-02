import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FLAT_PROFILE } from '@/lib/eq';
import { exportableSession, freshSession, profileForSide, useTandemStore } from '@/lib/store';

function resetReady() {
  useTandemStore.setState(freshSession());
  useTandemStore.getState().markAudioReady('tandem demo loop');
}

function stageTrial(requestId = 'agent-trial-1') {
  const state = useTandemStore.getState();
  return state.stageTrial({
    requestId,
    expectedRevision: state.revision,
    question: 'Which sounds clearer?',
    candidateOne: { ...FLAT_PROFILE, clarity: 1 },
    candidateTwo: { ...FLAT_PROFILE, warmth: 1 },
    agentRationale: 'One small clarity-versus-warmth comparison.',
  });
}

function completeTrial(choice: 'A' | 'B' | 'no_preference' = 'A') {
  useTandemStore.getState().recordFeedback(choice, ['Clearer'], 'Human note');
}

beforeEach(() => resetReady());

describe('session state machine', () => {
  it('increments revision for domain changes and follows the required states', () => {
    expect(useTandemStore.getState()).toMatchObject({ revision: 1, status: 'audio_ready' });
    expect(stageTrial().ok).toBe(true);
    expect(useTandemStore.getState()).toMatchObject({ revision: 2, status: 'trial_pending' });
    completeTrial();
    expect(useTandemStore.getState()).toMatchObject({ revision: 3, status: 'feedback_recorded' });
  });

  it('rejects stale revisions without changing state', () => {
    const before = useTandemStore.getState().revision;
    const result = useTandemStore.getState().stageTrial({
      requestId: 'stale',
      expectedRevision: 0,
      question: 'Question',
      candidateOne: FLAT_PROFILE,
      candidateTwo: FLAT_PROFILE,
      agentRationale: 'Rationale',
    });
    expect(result).toMatchObject({ ok: false, revision: before });
    expect(result.error).toContain('stale_revision');
    expect(useTandemStore.getState().revision).toBe(before);
  });

  it('deduplicates request IDs idempotently', () => {
    expect(stageTrial('same-request')).toMatchObject({ ok: true });
    const revisionAfterFirst = useTandemStore.getState().revision;
    completeTrial();
    const duplicate = useTandemStore.getState().stageTrial({
      requestId: 'same-request',
      expectedRevision: useTandemStore.getState().revision,
      question: 'Another question',
      candidateOne: FLAT_PROFILE,
      candidateTwo: FLAT_PROFILE,
      agentRationale: 'Another rationale',
    });
    expect(duplicate).toMatchObject({ ok: true, duplicate: true });
    expect(useTandemStore.getState().revision).toBe(revisionAfterFirst + 1);
  });

  it('randomizes which candidate becomes A', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.9);
    stageTrial('random-one');
    expect(useTandemStore.getState().activeTrial?.mapping.A).toBe('one');
    resetReady();
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.1);
    stageTrial('random-two');
    expect(useTandemStore.getState().activeTrial?.mapping.A).toBe('two');
  });

  it('keeps settings hidden until feedback moves the trial into history', () => {
    stageTrial();
    expect(useTandemStore.getState().completedTrials).toHaveLength(0);
    expect(useTandemStore.getState().activeTrial?.mapping).toBeDefined();
    completeTrial('B');
    const completed = useTandemStore.getState().completedTrials[0];
    expect(completed.mapping).toBeDefined();
    expect(profileForSide(completed, 'B')).toBeDefined();
  });

  it('requires two completed trials before a final profile can be staged', () => {
    const tooEarly = useTandemStore.getState().stageFinal({
      requestId: 'final-early',
      expectedRevision: useTandemStore.getState().revision,
      profile: FLAT_PROFILE,
      explanation: 'Too early',
    });
    expect(tooEarly.error).toContain('minimum_trials');
    stageTrial('trial-1'); completeTrial();
    const stillEarly = useTandemStore.getState().stageFinal({
      requestId: 'final-still-early',
      expectedRevision: useTandemStore.getState().revision,
      profile: FLAT_PROFILE,
      explanation: 'Still early',
    });
    expect(stillEarly.error).toContain('minimum_trials');
  });

  it('supports final rejection, another trial, human approval, save, and export', () => {
    stageTrial('trial-1'); completeTrial('A');
    stageTrial('trial-2'); completeTrial('B');
    expect(useTandemStore.getState().status).toBe('review_ready');
    const current = useTandemStore.getState();
    expect(current.stageFinal({
      requestId: 'final-1', expectedRevision: current.revision, profile: { ...FLAT_PROFILE, clarity: 1 }, explanation: 'Based on two human votes.',
    }).ok).toBe(true);
    const stagedRevision = useTandemStore.getState().revision;
    useTandemStore.getState().rejectFinal();
    expect(useTandemStore.getState()).toMatchObject({ status: 'review_ready', stagedFinalProfile: null, revision: stagedRevision + 1 });
    const afterReject = useTandemStore.getState();
    afterReject.stageFinal({ requestId: 'final-2', expectedRevision: afterReject.revision, profile: FLAT_PROFILE, explanation: 'Second proposal.' });
    useTandemStore.getState().approveFinal();
    expect(useTandemStore.getState()).toMatchObject({ status: 'approved', approvedProfileSaved: false });
    useTandemStore.getState().saveApprovedProfile();
    expect(useTandemStore.getState().approvedProfileSaved).toBe(true);
    expect(exportableSession(useTandemStore.getState())).not.toHaveProperty('processedRequestIds');
  });

  it('persists session data locally without audio bytes', () => {
    stageTrial(); completeTrial();
    const persisted = localStorage.getItem('tandem-listening-session-v1');
    expect(persisted).toContain('feedback_recorded');
    expect(persisted).toContain('Human note');
    expect(persisted).not.toContain('audioBuffer');
  });
});
