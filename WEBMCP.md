# WebMCP in tandem

tandem exposes a small imperative WebMCP surface owned by the page. It feature-detects `document.modelContext?.registerTool`, registers once from a stable client module, and unregisters all tools with one `AbortController` when the page lifecycle ends.

The tools call `useTandemStore.getState()` inside every handler, so agent actions read and mutate the same current state shown in the human interface. A successful mutation visibly changes the workspace and timeline before returning a concise result.

## Tools

### `skill_calibrate_listening`

Read-only. Returns the workflow, band definitions, parameter limits, feedback guidance, two-trial minimum, small-change rule, human-only boundary, stale-revision recovery, and suggested next actions.

### `get_calibration_state`

Read-only. Returns session id, revision, status, completed-trial count, human feedback history, currently available agent actions, final-staging eligibility, and the suggested next tool. It never returns audio, local file names or paths, or the hidden mapping of an active trial. Because human notes are untrusted user content, the tool uses `untrustedContentHint: true`.

### `stage_ab_trial`

Mutation. Requires `requestId`, `expectedRevision`, a bounded listening question, two distinct complete five-band profiles, and a bounded rationale. Every parameter and nested EQ band includes agent-facing schema guidance generated from the audio engine’s canonical band metadata. It rejects identical candidates, unknown properties, stale revisions, illegal states, values outside −6 through +6 dB, and values not aligned to 0.5 dB. It randomizes A/B, hides the mapping, increments once, updates the visible interface, and never starts playback or votes.

### `stage_final_profile`

Mutation. Requires a unique request id, current revision, a valid profile, an explanation grounded in the human feedback, and at least two completed trials. It stages a visible proposal and never approves or saves it.

Every input schema uses `additionalProperties: false`. Repeated request ids are acknowledged without applying a second mutation.

## Human-only boundary

There are no WebMCP tools for:

- unlocking or playing audio;
- listening or switching A/B;
- voting or reporting subjective feedback;
- approving or rejecting a proposal;
- saving an approved profile; or
- exporting the session.

These actions require a visible human interface because the agent cannot hear and should not impersonate a listening judgment.

## Verification

Vitest checks registration, schemas, annotations, read-only non-mutation, hidden mappings, untrusted input rejection, stale revisions, request idempotency, randomization, human-only tool absence, and manual mode. Playwright injects a mock `document.modelContext`, invokes the real tool handlers, reads state back through the tool, and keeps voting and approval in the visible UI.

External WebMCP Ready Checker and ora.ai results must be recorded only after a live URL exists and the checks have actually run.
