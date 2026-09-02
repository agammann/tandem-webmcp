export const EQ_BANDS = [
  { key: 'low', label: 'Low', frequency: 120, filter: 'lowshelf' },
  { key: 'warmth', label: 'Warmth', frequency: 350, filter: 'peaking' },
  { key: 'presence', label: 'Presence', frequency: 1500, filter: 'peaking' },
  { key: 'clarity', label: 'Clarity', frequency: 3500, filter: 'peaking' },
  { key: 'air', label: 'Air', frequency: 9000, filter: 'highshelf' },
] as const;

export type EqBandKey = (typeof EQ_BANDS)[number]['key'];
export type EqProfile = Record<EqBandKey, number>;
export type SessionStatus =
  | 'setup'
  | 'audio_ready'
  | 'trial_pending'
  | 'feedback_recorded'
  | 'review_ready'
  | 'final_staged'
  | 'approved';

export type VoteChoice = 'A' | 'B' | 'no_preference';
export type FeedbackTag =
  | 'Clearer'
  | 'Warmer'
  | 'Less harsh'
  | 'Less muddy'
  | 'Less tiring'
  | 'Too thin'
  | 'No meaningful difference';

export interface ActiveTrial {
  id: string;
  requestId: string;
  question: string;
  candidateOne: EqProfile;
  candidateTwo: EqProfile;
  mapping: { A: 'one' | 'two'; B: 'one' | 'two' };
  agentRationale: string;
  createdAt: string;
}

export interface HumanFeedback {
  choice: VoteChoice;
  tags: FeedbackTag[];
  note: string;
  recordedAt: string;
}

export interface CompletedTrial extends ActiveTrial {
  feedback: HumanFeedback;
}

export interface FinalProposal {
  profile: EqProfile;
  explanation: string;
  requestId: string;
  stagedAt: string;
}

export interface TimelineEvent {
  id: string;
  actor:
    | 'Agent staged'
    | 'Manual staged'
    | 'Human preferred'
    | 'Agent proposed'
    | 'Manual proposed'
    | 'Human approved';
  detail: string;
  at: string;
}

export interface TandemSession {
  sessionId: string;
  schemaVersion: 1;
  revision: number;
  status: SessionStatus;
  audioReady: boolean;
  audioSourceLabel: 'none' | 'tandem demo loop' | 'local audio';
  activeTrial: ActiveTrial | null;
  completedTrials: CompletedTrial[];
  stagedFinalProfile: FinalProposal | null;
  approvedProfile: EqProfile | null;
  approvedProfileSaved: boolean;
  timeline: TimelineEvent[];
  processedRequestIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface StageTrialInput {
  requestId: string;
  expectedRevision: number;
  question: string;
  candidateOne: EqProfile;
  candidateTwo: EqProfile;
  agentRationale: string;
}

export interface StageFinalInput {
  requestId: string;
  expectedRevision: number;
  profile: EqProfile;
  explanation: string;
}

export interface MutationResult {
  ok: boolean;
  duplicate?: boolean;
  error?: string;
  revision: number;
  status: SessionStatus;
}
