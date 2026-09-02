import { z } from 'zod';
import { eqProfileSchema } from './eq';
import { useTandemStore } from './store';
import { EQ_BANDS, type EqProfile } from './types';

const requestId = z.string().trim().min(1).max(80);
const revision = z.number().int().nonnegative();
const shortText = z.string().trim().min(1).max(240);
const rationale = z.string().trim().min(1).max(600);

const stageTrialInput = z
  .object({
    requestId,
    expectedRevision: revision,
    question: shortText,
    candidateOne: eqProfileSchema,
    candidateTwo: eqProfileSchema,
    agentRationale: rationale,
  })
  .strict()
  .refine(
    ({ candidateOne, candidateTwo }) =>
      EQ_BANDS.some(({ key }) => candidateOne[key] !== candidateTwo[key]),
    {
      message: 'Candidate profiles must differ on at least one EQ band',
      path: ['candidateTwo'],
    },
  );

const stageFinalInput = z
  .object({
    requestId,
    expectedRevision: revision,
    profile: eqProfileSchema,
    explanation: rationale,
  })
  .strict();

const filterNames = {
  lowshelf: 'low-shelf',
  peaking: 'bell',
  highshelf: 'high-shelf',
} as const;

const eqJsonProperties = Object.fromEntries(
  EQ_BANDS.map((band) => [
    band.key,
    {
      type: 'number',
      description: `${band.label} ${filterNames[band.filter]} gain at ${band.frequency} Hz, from -6 to +6 dB in 0.5 dB steps.`,
      minimum: -6,
      maximum: 6,
      multipleOf: 0.5,
    },
  ]),
);

const eqJsonSchema = {
  type: 'object',
  description: 'A complete five-band EQ profile expressed as gain in decibels.',
  properties: eqJsonProperties,
  required: ['low', 'warmth', 'presence', 'clarity', 'air'],
  additionalProperties: false,
} as const;

const mutationMetaSchema = {
  requestId: {
    type: 'string',
    description: 'A unique idempotency key for this mutation. Reuse it only when retrying the same request.',
    minLength: 1,
    maxLength: 80,
  },
  expectedRevision: {
    type: 'integer',
    description: 'The current revision returned by get_calibration_state; stale values are rejected.',
    minimum: 0,
  },
} as const;

function stateSnapshot() {
  const state = useTandemStore.getState();
  const availableActions: string[] = [];
  if (['audio_ready', 'feedback_recorded', 'review_ready'].includes(state.status)) {
    availableActions.push('stage_ab_trial');
  }
  if (state.completedTrials.length >= 2 && ['review_ready', 'feedback_recorded'].includes(state.status)) {
    availableActions.push('stage_final_profile');
  }
  if (state.status === 'trial_pending') availableActions.push('wait_for_human_vote');
  if (state.status === 'final_staged') availableActions.push('wait_for_human_approval');
  return {
    sessionId: state.sessionId,
    revision: state.revision,
    status: state.status,
    audioReady: state.audioReady,
    completedTrialCount: state.completedTrials.length,
    humanFeedbackHistory: state.completedTrials.map((trial, index) => ({
      trialNumber: index + 1,
      question: trial.question,
      choice: trial.feedback.choice,
      tags: trial.feedback.tags,
      note: trial.feedback.note,
    })),
    availableActions,
    canStageFinalProfile: state.completedTrials.length >= 2 && ['review_ready', 'feedback_recorded'].includes(state.status),
    suggestedNextTool: state.completedTrials.length >= 2 && ['review_ready', 'feedback_recorded'].includes(state.status)
      ? 'stage_final_profile'
      : availableActions.find((action) => action.startsWith('stage_')) ?? null,
  };
}

export function tandemTools(): WebMCPTool[] {
  return [
    {
      name: 'skill_calibrate_listening',
      title: 'Read tandem calibration skill',
      description: 'Learn tandem’s safe blind-listening workflow before staging an EQ experiment.',
      inputSchema: {
        type: 'object',
        description: 'No input parameters. Call this tool before beginning a calibration workflow.',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute(input) {
        z.object({}).strict().parse(input);
        return {
          purpose: 'tandem is a local-first blind listening lab. You stage small EQ experiments; the human listens, votes, and approves.',
          workflow: [
            'Read get_calibration_state.',
            'Stage two safe candidates with stage_ab_trial.',
            'Wait for the human to listen and vote in the visible interface.',
            'Read the recorded feedback and change only one or two meaningful variables.',
            'After two completed trials, stage_final_profile and wait for human approval.',
          ],
          bands: EQ_BANDS.map((band) => ({
            name: band.label,
            key: band.key,
            frequencyHz: band.frequency,
            filter: band.filter,
            rangeDb: [-6, 6],
            stepDb: 0.5,
          })),
          feedbackGuidance: 'Use the human’s tags and note as subjective evidence. Do not infer a winner from the EQ settings.',
          minimumTrials: 2,
          safety: [
            'Make small comparisons and change only one or two bands per trial.',
            'Never vote, report subjective feedback, approve, save, or export for the human.',
            'Never start playback automatically.',
          ],
          staleRevisionRecovery: 'If a mutation returns stale_revision, call get_calibration_state and retry once with a new requestId and the current revision.',
          suggestedNextActions: ['get_calibration_state', 'stage_ab_trial'],
        };
      },
    },
    {
      name: 'get_calibration_state',
      title: 'Get calibration state',
      description: 'Read the current tandem session, human feedback, and permitted next agent action without revealing a pending A/B mapping.',
      inputSchema: {
        type: 'object',
        description: 'No input parameters. The response reflects the current visible tandem session.',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute(input) {
        z.object({}).strict().parse(input);
        return stateSnapshot();
      },
    },
    {
      name: 'stage_ab_trial',
      title: 'Stage blind A/B trial',
      description: 'Validate and stage two safe EQ profiles as a randomized, hidden A/B comparison. This never plays audio or records a vote.',
      inputSchema: {
        type: 'object',
        description:
          'Inputs for staging one randomized blind comparison without playing audio or voting. The two candidates must differ on at least one EQ band.',
        properties: {
          ...mutationMetaSchema,
          question: {
            type: 'string',
            description: 'A neutral listening question shown to the human without revealing the A/B mapping.',
            minLength: 1,
            maxLength: 240,
          },
          candidateOne: {
            ...eqJsonSchema,
            description: 'The first complete EQ candidate. The interface randomizes whether it becomes A or B.',
          },
          candidateTwo: {
            ...eqJsonSchema,
            description: 'The second complete EQ candidate. The interface randomizes whether it becomes A or B.',
          },
          agentRationale: {
            type: 'string',
            description: 'A concise explanation of the evidence and variables motivating this comparison.',
            minLength: 1,
            maxLength: 600,
          },
        },
        required: ['requestId', 'expectedRevision', 'question', 'candidateOne', 'candidateTwo', 'agentRationale'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        const parsed = stageTrialInput.parse(input);
        const result = useTandemStore.getState().stageTrial(parsed);
        if (!result.ok) throw new Error(result.error);
        return {
          ...result,
          message: result.duplicate ? 'Request already applied; no second mutation performed.' : 'Blind trial staged in the visible interface. Wait for the human vote.',
        };
      },
    },
    {
      name: 'stage_final_profile',
      title: 'Stage final EQ profile',
      description: 'Propose a final EQ profile after at least two human-completed trials. Human approval remains required in the visible interface.',
      inputSchema: {
        type: 'object',
        description: 'Inputs for staging a final profile for visible human review after two completed trials.',
        properties: {
          ...mutationMetaSchema,
          profile: {
            ...eqJsonSchema,
            description: 'The complete proposed EQ profile derived from the recorded human feedback.',
          },
          explanation: {
            type: 'string',
            description: 'A concise evidence-based explanation shown beside the proposal for human review.',
            minLength: 1,
            maxLength: 600,
          },
        },
        required: ['requestId', 'expectedRevision', 'profile', 'explanation'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        const parsed = stageFinalInput.parse(input);
        const result = useTandemStore.getState().stageFinal(parsed);
        if (!result.ok) throw new Error(result.error);
        return {
          ...result,
          message: result.duplicate ? 'Request already applied; no second mutation performed.' : 'Final profile staged for human review and approval.',
        };
      },
    },
  ];
}

export function registerTandemTools(): () => void {
  const context = typeof document === 'undefined' ? undefined : document.modelContext;
  if (!context?.registerTool) {
    window.dispatchEvent(new CustomEvent('tandem:webmcp-status', { detail: { available: false } }));
    return () => undefined;
  }
  const lifecycle = new AbortController();
  try {
    for (const tool of tandemTools()) {
      void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch((error) => {
        window.dispatchEvent(
          new CustomEvent('tandem:webmcp-status', {
            detail: { available: false, error: error instanceof Error ? error.message : 'Tool registration failed' },
          }),
        );
      });
    }
    window.dispatchEvent(new CustomEvent('tandem:webmcp-status', { detail: { available: true } }));
  } catch (error) {
    window.dispatchEvent(
      new CustomEvent('tandem:webmcp-status', {
        detail: { available: false, error: error instanceof Error ? error.message : 'Tool registration failed' },
      }),
    );
  }
  return () => lifecycle.abort();
}

export function flatProfile(): EqProfile {
  return { low: 0, warmth: 0, presence: 0, clarity: 0, air: 0 };
}
