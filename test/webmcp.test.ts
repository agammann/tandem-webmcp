import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FLAT_PROFILE } from '@/lib/eq';
import { freshSession, useTandemStore } from '@/lib/store';
import { EQ_BANDS } from '@/lib/types';
import { registerTandemTools, tandemTools } from '@/lib/webmcp';

beforeEach(() => {
  useTandemStore.setState(freshSession());
  useTandemStore.getState().markAudioReady('tandem demo loop');
  Object.defineProperty(document, 'modelContext', { value: undefined, configurable: true });
});

describe('WebMCP contract', () => {
  it('defines exactly four tools and no human-only action tool', () => {
    const names = tandemTools().map((tool) => tool.name);
    expect(names).toEqual([
      'skill_calibrate_listening',
      'get_calibration_state',
      'stage_ab_trial',
      'stage_final_profile',
    ]);
    expect(names.some((name) => /(^|_)(vote|approve|unlock|save|export)(_|$)/.test(name))).toBe(false);
  });

  it('marks read-only tools and does not mutate state when they execute', async () => {
    const before = useTandemStore.getState().revision;
    const readTools = tandemTools().filter((tool) => tool.annotations?.readOnlyHint);
    expect(readTools).toHaveLength(2);
    await Promise.all(readTools.map((tool) => tool.execute({})));
    expect(useTandemStore.getState().revision).toBe(before);
  });

  it('does not reveal the hidden mapping of an active trial', async () => {
    const state = useTandemStore.getState();
    state.stageTrial({
      requestId: 'agent-1', expectedRevision: state.revision, question: 'Which is clearer?', candidateOne: FLAT_PROFILE, candidateTwo: { ...FLAT_PROFILE, clarity: 1 }, agentRationale: 'Small comparison.',
    });
    const tool = tandemTools().find((candidate) => candidate.name === 'get_calibration_state');
    const snapshot = await tool?.execute({});
    expect(JSON.stringify(snapshot)).not.toContain('mapping');
    expect(JSON.stringify(snapshot)).not.toContain('candidateOne');
  });

  it('rejects unknown mutation properties before changing state', async () => {
    const before = useTandemStore.getState().revision;
    const tool = tandemTools().find((candidate) => candidate.name === 'stage_ab_trial');
    await expect(
      Promise.resolve().then(() =>
        tool?.execute({
          requestId: 'agent-2', expectedRevision: before, question: 'Question', candidateOne: FLAT_PROFILE, candidateTwo: FLAT_PROFILE, agentRationale: 'Rationale', injected: '<script>',
        }),
      ),
    ).rejects.toThrow();
    expect(useTandemStore.getState().revision).toBe(before);
  });

  it('rejects indistinguishable A/B candidates before changing state', async () => {
    const before = useTandemStore.getState().revision;
    const tool = tandemTools().find((candidate) => candidate.name === 'stage_ab_trial');
    await expect(
      Promise.resolve().then(() =>
        tool?.execute({
          requestId: 'agent-identical',
          expectedRevision: before,
          question: 'Can the human hear a difference?',
          candidateOne: FLAT_PROFILE,
          candidateTwo: FLAT_PROFILE,
          agentRationale: 'This should be rejected because there is no audible variable to compare.',
        }),
      ),
    ).rejects.toThrow('Candidate profiles must differ');
    expect(useTandemStore.getState().revision).toBe(before);
  });

  it('registers once with schemas and unregisters through AbortSignal', () => {
    const registered: WebMCPTool[] = [];
    const signals: AbortSignal[] = [];
    const registerTool = vi.fn((tool: WebMCPTool, options?: { signal?: AbortSignal }) => {
      registered.push(tool);
      if (options?.signal) signals.push(options.signal);
    });
    Object.defineProperty(document, 'modelContext', { value: { registerTool }, configurable: true });
    const cleanup = registerTandemTools();
    expect(registerTool).toHaveBeenCalledTimes(4);
    expect(registered.every((tool) => tool.inputSchema.additionalProperties === false)).toBe(true);
    expect(signals.every((signal) => !signal.aborted)).toBe(true);
    cleanup();
    expect(signals.every((signal) => signal.aborted)).toBe(true);
  });

  it('documents every mutation parameter for agent guidance', () => {
    const mutationTools = tandemTools().filter((tool) => !tool.annotations?.readOnlyHint);
    expect(mutationTools).toHaveLength(2);

    for (const tool of mutationTools) {
      const schema = tool.inputSchema as {
        properties: Record<
          string,
          { description?: string; properties?: Record<string, { description?: string }> }
        >;
      };
      for (const property of Object.values(schema.properties)) {
        expect(property.description).toBeTypeOf('string');
        expect(property.description?.length).toBeGreaterThan(20);
        if (property.properties) {
          for (const nestedProperty of Object.values(property.properties)) {
            expect(nestedProperty.description).toBeTypeOf('string');
            expect(nestedProperty.description?.length).toBeGreaterThan(20);
          }
        }
      }
    }
  });

  it('derives EQ schema guidance from the canonical audio-band metadata', () => {
    const tool = tandemTools().find((candidate) => candidate.name === 'stage_ab_trial');
    const schema = tool?.inputSchema as {
      properties: {
        candidateOne: { properties: Record<string, { description?: string }> };
        candidateTwo: { properties: Record<string, { description?: string }> };
      };
    };

    for (const candidate of [schema.properties.candidateOne, schema.properties.candidateTwo]) {
      for (const band of EQ_BANDS) {
        expect(candidate.properties[band.key].description).toContain(`${band.frequency} Hz`);
      }
    }
  });

  it('announces manual mode when the browser has no WebMCP implementation', () => {
    const listener = vi.fn();
    window.addEventListener('tandem:webmcp-status', listener);
    registerTandemTools();
    expect(listener).toHaveBeenCalled();
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({ available: false });
    window.removeEventListener('tandem:webmcp-status', listener);
  });
});
