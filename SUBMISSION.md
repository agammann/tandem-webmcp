# tandem — Devpost draft

## Tagline

Your ears are the eval.

## Short description

tandem is a local-first blind listening lab where a user’s browser agent stages safe EQ experiments while the human listens, compares, votes, and approves the final result.

## Inspiration

People can describe sound as muddy, harsh, thin, tiring, or unclear without knowing how to translate that feeling into equalizer settings. An agent can reason about language and structure an experiment, but it cannot hear through the user’s ears. tandem turns that limitation into the collaboration model: the agent stages controlled tests, and the human supplies the evidence only listening can provide.

## What it does

The user loads tandem’s built-in demo loop or a local audio file that never leaves the device. A browser agent reads the calibration skill and session state, then stages two bounded EQ profiles. tandem randomizes them to A and B, routes one synchronized audio source through both processing chains, hides the settings, and asks a simple listening question. The human switches between A and B, votes, adds tags or a note, and reveals the mapping only after the judgment is recorded.

After at least two trials, the agent can propose a final profile using the actual feedback. The human compares that proposal with the original audio, then approves, rejects, requests another test, saves locally, or exports the session. The timeline labels agent staging, human preferences, agent proposals, and human approval.

## How we built it

tandem uses React, TypeScript, Vinext/Vite, Zustand, Zod, and the Web Audio API. One looping `AudioBufferSourceNode` feeds independent A, B, and Original paths so playback stays synchronized. Each processed path has five `BiquadFilterNode` bands, conservative output headroom, and a short output-gain crossfade.

Four imperative tools are registered with `document.modelContext.registerTool`: two read-only tools teach and inspect, while two mutation tools stage blind trials and final proposals. Tool handlers read Zustand through `getState()`, validate strict schemas, require current revisions and idempotency keys, and update the same visible state as the human interface. There is intentionally no API, key, backend, account, analytics, or separate MCP server.

## Challenges

The most important design challenge was preserving responsibility rather than maximizing automation. A WebMCP tool that votes would make the demo faster but erase the product’s core truth: the agent cannot hear the result. The state machine, tool names, schemas, provenance, and tests all enforce that boundary.

Audio comparison also required avoiding false preferences caused by playback drift or obvious loudness changes. tandem uses one shared source, synchronized paths, gain headroom, bounded profiles, and a short crossfade while retaining playback position.

## Accomplishments

- Page-owned WebMCP tools over the same durable state shown in the UI
- Blind randomized A/B tests with post-vote reveal
- Human-only listening, voting, approval, save, and export
- Stale-revision protection and request-id idempotency
- Manual mode that remains functional without WebMCP
- Local-only audio processing and clearly documented privacy boundaries
- Unit and end-to-end tests for the agent/human responsibility boundary

## What we learned

Human-agent collaboration is strongest when each participant has a capability the other genuinely lacks. The useful contract is not “the agent does everything.” It is “the agent makes a disciplined experiment possible, and the human contributes irreducible evidence.”

## What’s next

Potential future work includes more listening-question templates, user-authored band presets, offline spectral guidance that never leaves the browser, and richer export visualization. These remain secondary to keeping the experiment bounded, interpretable, and human-controlled.

## Links

- Live app: https://tandem-listening-lab.alx21.chatgpt.site/
- Source repository: https://github.com/agammann/tandem-webmcp
- Public narrated demo: uploaded as a verified private draft; publication awaits the account holder's action-time confirmation

External WebMCP Ready Checker, ora.ai, and WebMCPTools.io were run against the production domain. Their limitations and the stronger live-browser functional evidence are documented in `AUDIT_RESULTS.md`.

