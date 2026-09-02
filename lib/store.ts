import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  EqProfile,
  FeedbackTag,
  MutationResult,
  StageFinalInput,
  StageTrialInput,
  TandemSession,
  VoteChoice,
} from './types';

function now(): string {
  return new Date().toISOString();
}

function id(prefix: string): string {
  const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${prefix}-${random}`;
}

export function freshSession(): TandemSession {
  const timestamp = now();
  return {
    sessionId: id('session'),
    schemaVersion: 1,
    revision: 0,
    status: 'setup',
    audioReady: false,
    audioSourceLabel: 'none',
    activeTrial: null,
    completedTrials: [],
    stagedFinalProfile: null,
    approvedProfile: null,
    approvedProfileSaved: false,
    timeline: [],
    processedRequestIds: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

type Store = TandemSession & {
  beginSession: () => void;
  markAudioReady: (source: 'tandem demo loop' | 'local audio') => void;
  stageTrial: (input: StageTrialInput) => MutationResult;
  recordFeedback: (choice: VoteChoice, tags: FeedbackTag[], note: string) => void;
  stageFinal: (input: StageFinalInput) => MutationResult;
  rejectFinal: () => void;
  approveFinal: () => void;
  saveApprovedProfile: () => void;
  clearPersistedSession: () => void;
};

function mutationResult(state: TandemSession, ok: boolean, error?: string): MutationResult {
  return { ok, error, revision: state.revision, status: state.status };
}

export const useTandemStore = create<Store>()(
  persist(
    (set, get) => ({
      ...freshSession(),
      beginSession: () => set(freshSession()),
      markAudioReady: (source) =>
        set((state) => ({
          audioReady: true,
          audioSourceLabel: source,
          status: 'audio_ready',
          revision: state.revision + 1,
          updatedAt: now(),
        })),
      stageTrial: (input) => {
        const state = get();
        if (state.processedRequestIds.includes(input.requestId)) {
          return { ...mutationResult(state, true), duplicate: true };
        }
        if (input.expectedRevision !== state.revision) {
          return mutationResult(state, false, `stale_revision: current revision is ${state.revision}`);
        }
        if (!state.audioReady || !['audio_ready', 'feedback_recorded', 'review_ready'].includes(state.status)) {
          return mutationResult(state, false, `illegal_state: cannot stage a trial from ${state.status}`);
        }
        const oneIsA = Math.random() >= 0.5;
        const timestamp = now();
        set({
          activeTrial: {
            id: id('trial'),
            requestId: input.requestId,
            question: input.question,
            candidateOne: input.candidateOne,
            candidateTwo: input.candidateTwo,
            mapping: oneIsA ? { A: 'one', B: 'two' } : { A: 'two', B: 'one' },
            agentRationale: input.agentRationale,
            createdAt: timestamp,
          },
          status: 'trial_pending',
          revision: state.revision + 1,
          updatedAt: timestamp,
          processedRequestIds: [...state.processedRequestIds, input.requestId].slice(-100),
          timeline: [
            ...state.timeline,
            {
              id: id('event'),
              actor: input.requestId.startsWith('manual-') ? 'Manual staged' : 'Agent staged',
              detail: input.question,
              at: timestamp,
            },
          ],
        });
        return mutationResult(get(), true);
      },
      recordFeedback: (choice, tags, note) => {
        const state = get();
        if (!state.activeTrial || state.status !== 'trial_pending') return;
        const timestamp = now();
        const feedback = { choice, tags, note: note.slice(0, 280), recordedAt: timestamp };
        const completed = [...state.completedTrials, { ...state.activeTrial, feedback }];
        set({
          completedTrials: completed,
          activeTrial: null,
          status: completed.length >= 2 ? 'review_ready' : 'feedback_recorded',
          revision: state.revision + 1,
          updatedAt: timestamp,
          timeline: [
            ...state.timeline,
            {
              id: id('event'),
              actor: 'Human preferred',
              detail: choice === 'no_preference' ? 'No preference recorded' : `Version ${choice}`,
              at: timestamp,
            },
          ],
        });
      },
      stageFinal: (input) => {
        const state = get();
        if (state.processedRequestIds.includes(input.requestId)) {
          return { ...mutationResult(state, true), duplicate: true };
        }
        if (input.expectedRevision !== state.revision) {
          return mutationResult(state, false, `stale_revision: current revision is ${state.revision}`);
        }
        if (state.completedTrials.length < 2) {
          return mutationResult(state, false, 'minimum_trials: complete at least two trials');
        }
        if (!['review_ready', 'feedback_recorded'].includes(state.status)) {
          return mutationResult(state, false, `illegal_state: cannot stage a final profile from ${state.status}`);
        }
        const timestamp = now();
        set({
          stagedFinalProfile: {
            profile: input.profile,
            explanation: input.explanation,
            requestId: input.requestId,
            stagedAt: timestamp,
          },
          status: 'final_staged',
          revision: state.revision + 1,
          updatedAt: timestamp,
          processedRequestIds: [...state.processedRequestIds, input.requestId].slice(-100),
          timeline: [
            ...state.timeline,
            {
              id: id('event'),
              actor: input.requestId.startsWith('manual-') ? 'Manual proposed' : 'Agent proposed',
              detail: input.explanation,
              at: timestamp,
            },
          ],
        });
        return mutationResult(get(), true);
      },
      rejectFinal: () => {
        const state = get();
        if (state.status !== 'final_staged') return;
        set({
          stagedFinalProfile: null,
          status: 'review_ready',
          revision: state.revision + 1,
          updatedAt: now(),
        });
      },
      approveFinal: () => {
        const state = get();
        if (state.status !== 'final_staged' || !state.stagedFinalProfile) return;
        const timestamp = now();
        set({
          approvedProfile: state.stagedFinalProfile.profile,
          status: 'approved',
          revision: state.revision + 1,
          updatedAt: timestamp,
          timeline: [
            ...state.timeline,
            { id: id('event'), actor: 'Human approved', detail: 'Final EQ profile approved', at: timestamp },
          ],
        });
      },
      saveApprovedProfile: () => {
        const state = get();
        if (state.status !== 'approved' || !state.approvedProfile || state.approvedProfileSaved) return;
        set({ approvedProfileSaved: true, revision: state.revision + 1, updatedAt: now() });
      },
      clearPersistedSession: () => {
        useTandemStore.persist.clearStorage();
        set(freshSession());
      },
    }),
    {
      name: 'tandem-listening-session-v1',
      partialize: (state) => ({
        sessionId: state.sessionId,
        schemaVersion: state.schemaVersion,
        revision: state.revision,
        status: state.status,
        audioReady: false,
        audioSourceLabel: state.audioSourceLabel,
        activeTrial: state.activeTrial,
        completedTrials: state.completedTrials,
        stagedFinalProfile: state.stagedFinalProfile,
        approvedProfile: state.approvedProfile,
        approvedProfileSaved: state.approvedProfileSaved,
        timeline: state.timeline,
        processedRequestIds: state.processedRequestIds,
        createdAt: state.createdAt,
        updatedAt: state.updatedAt,
      }),
    },
  ),
);

export function profileForSide(
  trial: TandemSession['activeTrial'],
  side: 'A' | 'B',
): EqProfile | null {
  if (!trial) return null;
  return trial.mapping[side] === 'one' ? trial.candidateOne : trial.candidateTwo;
}

export function exportableSession(state: TandemSession) {
  const { processedRequestIds: _processedRequestIds, ...safeState } = state;
  return safeState;
}
