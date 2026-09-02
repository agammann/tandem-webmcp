# tandem

## Your ears are the eval.

tandem is a local-first blind listening lab built for human-agent collaboration. Your browser agent can inspect the calibration session and stage small, safe EQ experiments through WebMCP. The agent cannot hear the result, cast your vote, or approve a profile. You listen, choose, and remain in control.

You bring your agent. tandem brings the listening lab. Your ears decide.

- Live app: https://tandem-listening-lab.alx21.chatgpt.site/
- Public source: https://github.com/agammann/tandem-webmcp
- Narrated demo: https://youtu.be/2Z8HO1BMDGs

## What works

- Built-in synthesized demo audio and local audio-file decoding with the Web Audio API
- One synchronized source routed through independent A, B, and Original signal paths
- Five bounded EQ bands, 0.5 dB steps, output headroom, and a short switching crossfade
- Randomized A/B assignment with settings and rationale hidden until the human votes
- Human-only feedback, final approval/rejection, save, and JSON export
- Zustand session state persisted in local storage with revisions and request-id idempotency
- Four imperative page-side WebMCP tools registered through `document.modelContext.registerTool`
- Manual fallback when WebMCP is unavailable
- Keyboard focus, screen-reader labels/status, contrast, large controls, and reduced-motion support
- Vitest contracts and Playwright end-to-end scenarios

No OpenAI API, API key, backend, database, account, analytics, tracking, audio upload, or separate MCP server is used.

## Run locally

Requirements: Node.js 22.13 or newer and pnpm.

```bash
pnpm install
pnpm dev
```

The managed Windows Codex preview uses:

```powershell
$env:TANDEM_LOCAL_PREVIEW='1'
pnpm dev
```

Then open `http://localhost:3000`.

## Verify

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

The Playwright suite includes both a complete manual-mode workflow and a mocked WebMCP workflow in which tools stage trials while voting and approval remain visible human actions.

## WebMCP tools

| Tool | Kind | Purpose |
| --- | --- | --- |
| `skill_calibrate_listening` | Read only | Teaches an unfamiliar agent tandem’s workflow and boundaries |
| `get_calibration_state` | Read only | Returns the current revision, feedback history, and available actions |
| `stage_ab_trial` | Mutation | Validates and stages a randomized blind A/B comparison |
| `stage_final_profile` | Mutation | Proposes a final profile after at least two completed human trials |

There are intentionally no tools for unlocking audio, listening, voting, entering subjective feedback, approving/rejecting, saving, or exporting.

See [WEBMCP.md](./WEBMCP.md) for the contract, lifecycle, and test details, and [AUDIT_RESULTS.md](./AUDIT_RESULTS.md) for the local and hosted verification record, including third-party scanner limitations.

## Privacy and safety

Audio is decoded and processed in the browser. It is never uploaded or recorded. WebMCP inputs are untrusted, length-limited, schema-validated, and rendered only as text. EQ values are restricted to −6 through +6 dB in 0.5 dB steps. tandem does not make medical or hearing-health claims.

See [PRIVACY.md](./PRIVACY.md), [ACCESSIBILITY.md](./ACCESSIBILITY.md), and [ATTRIBUTION.md](./ATTRIBUTION.md).

## License

MIT. See [LICENSE](./LICENSE).

