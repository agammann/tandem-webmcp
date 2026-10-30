import { create } from 'zustand';
import type { PersistStorage } from 'zustand/middleware';
import { z } from 'zod';
import { eqProfileSchema } from './eq';
import { EQ_BANDS, type TandemSession } from './types';

const timestamp = z.iso.datetime();
const identifier = z.string().min(1);
const trialSchema = z.object({
  id: identifier,
  requestId: identifier,
  question: z.string(),
  candidateOne: eqProfileSchema,
  candidateTwo: eqProfileSchema,
  mapping: z.object({ A: z.enum(['one', 'two']), B: z.enum(['one', 'two']) })
    .refine(({ A, B }) => A !== B),
  agentRationale: z.string(),
  createdAt: timestamp,
});
const feedbackSchema = z.object({
  choice: z.enum(['A', 'B', 'no_preference']),
  tags: z.array(z.enum(['Clearer', 'Warmer', 'Less harsh', 'Less muddy', 'Less tiring', 'Too thin', 'No meaningful difference'])),
  note: z.string().max(280),
  recordedAt: timestamp,
});

// Validate nested values before anything reaches React or the audio engine. The
// v1 session key historically uses Zustand envelope version 0, not version 1.
const sessionSchema = z.object({
  sessionId: identifier,
  schemaVersion: z.literal(1),
  revision: z.number().int().nonnegative(),
  status: z.enum(['setup', 'audio_ready', 'trial_pending', 'feedback_recorded', 'review_ready', 'final_staged', 'approved']),
  audioReady: z.boolean(),
  audioSourceLabel: z.enum(['none', 'tandem demo loop', 'local audio']),
  audioFingerprint: z.string().optional(),
  activeTrial: trialSchema.nullable(),
  completedTrials: z.array(trialSchema.extend({ feedback: feedbackSchema })),
  stagedFinalProfile: z.object({
    profile: eqProfileSchema,
    explanation: z.string(),
    requestId: identifier,
    stagedAt: timestamp,
    source: z.enum(['agent', 'manual']).optional(),
  }).nullable(),
  approvedProfile: eqProfileSchema.nullable(),
  approvedProfileSaved: z.boolean(),
  timeline: z.array(z.object({
    id: identifier,
    actor: z.enum(['Agent staged', 'Manual staged', 'Human preferred', 'Agent proposed', 'Manual proposed', 'Human approved']),
    detail: z.string(),
    at: timestamp,
  })),
  processedRequestIds: z.array(identifier),
  createdAt: timestamp,
  updatedAt: timestamp,
}).refine((state) => {
  if ((state.status === 'trial_pending') !== (state.activeTrial !== null)) return false;
  if (['final_staged', 'approved'].includes(state.status) !== (state.stagedFinalProfile !== null)) return false;
  if ((state.status === 'approved') !== (state.approvedProfile !== null)) return false;
  if (state.approvedProfileSaved && !state.approvedProfile) return false;
  if ((state.status === 'setup') !== (state.audioSourceLabel === 'none')) return false;
  if (['setup', 'audio_ready'].includes(state.status) && state.completedTrials.length !== 0) return false;
  if (state.status === 'feedback_recorded' && state.completedTrials.length !== 1) return false;
  if (['review_ready', 'final_staged', 'approved'].includes(state.status) && state.completedTrials.length < 2) return false;
  if (state.approvedProfile && state.stagedFinalProfile &&
      EQ_BANDS.some(({ key }) => state.approvedProfile![key] !== state.stagedFinalProfile!.profile[key])) return false;
  return true;
}, 'Inconsistent saved session');
const envelopeSchema = z.object({ state: sessionSchema, version: z.literal(0) });

type PersistenceIssue = 'invalid' | 'unavailable' | 'write_failed' | null;

// Kept outside the persisted/domain store so warnings cannot recursively trigger
// another failing write, or leak raw recovery data into agent state or exports.
export const usePersistenceStatus = create<{
  issue: PersistenceIssue;
  recoveryData: string | null;
}>(() => ({ issue: null, recoveryData: null }));

let protectSavedSession = false;

export function allowSessionReplacement() {
  // Called only by the explicit New session/reset action, after UI confirmation.
  protectSavedSession = false;
}

export const sessionStorage: PersistStorage<TandemSession> = {
  getItem(name) {
    let raw: string | null;
    try {
      raw = localStorage.getItem(name);
    } catch {
      protectSavedSession = true;
      usePersistenceStatus.setState({ issue: 'unavailable', recoveryData: null });
      return null;
    }
    try {
      const saved = raw === null ? null : envelopeSchema.parse(JSON.parse(raw));
      protectSavedSession = false;
      usePersistenceStatus.setState({ issue: null, recoveryData: null });
      // Audio bytes cannot be recovered from storage, even if the flag was edited.
      return saved ? { ...saved, state: { ...saved.state, audioReady: false } } : null;
    } catch {
      // Leave the exact original bytes in place; never silently overwrite an
      // unknown/corrupt version with the fallback session during ordinary actions.
      protectSavedSession = true;
      usePersistenceStatus.setState({ issue: 'invalid', recoveryData: raw });
      return null;
    }
  },
  setItem(name, value) {
    if (protectSavedSession) return;
    try {
      localStorage.setItem(name, JSON.stringify(value));
      usePersistenceStatus.setState({ issue: null, recoveryData: null });
    } catch {
      // Domain changes stay usable in memory. A later action retries the write.
      usePersistenceStatus.setState({ issue: 'write_failed' });
    }
  },
  removeItem(name) {
    try {
      localStorage.removeItem(name);
      protectSavedSession = false;
      usePersistenceStatus.setState({ issue: null, recoveryData: null });
    } catch {
      usePersistenceStatus.setState({ issue: 'write_failed' });
    }
  },
};
