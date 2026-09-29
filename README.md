# tandem

Compare EQ settings, hear the difference, and keep the sound you prefer.

**[Open tandem](https://tandem-listening-lab.alx21.chatgpt.site)** · [WebMCP guide](WEBMCP.md) · [Report a problem](https://github.com/agammann/tandem-webmcp/issues)

tandem is a browser listening tool. It plays one audio source through two synchronized EQ paths, randomly labels them A and B, and hides their settings until you record a preference. Use the built-in guided comparisons or let a WebMCP-capable browser agent design comparisons from your feedback. No account or API key is required by tandem.

## Try it

1. Open the app and choose **Load demo audio** or **Choose local file**. Use headphones or speakers at a comfortable volume.
2. Choose **Try a guided comparison**, then **Play audio**. Switch between **A** and **B** while listening.
3. Select **Prefer A**, **Prefer B**, or **No preference**. Add optional tags or a note, then choose **Record my feedback**. Both versions must have been played before the button becomes available.
4. Complete another comparison. Choose **Review a suggested profile**, then compare **Proposal** with **Original**.
5. Approve the profile if you prefer it, or reject it and keep testing. **Save approved profile** marks it saved in this browser. **Export session JSON** downloads the settings and feedback for your records.

The guided mode uses fixed comparison pairs. Its final suggestion averages your chosen profiles and rounds to 0.5 dB; a no-preference vote contributes the unchanged profile. This is a starting point to review, not a prediction of your ideal sound. An agent can use your recorded settings and notes to design different follow-up comparisons.

## What you get

- Real Web Audio processing with five EQ bands, bounded to −6…+6 dB in 0.5 dB steps.
- A synchronized source, short switching crossfades, and shared output headroom across A/B/Original.
- Trial history showing the settings behind each recorded choice.
- Local session recovery, an explicit **New session** confirmation, and JSON export.
- Four page tools that let an agent read the same session and stage comparisons and proposals.
- A complete guided workflow when the browser has no WebMCP support.

**Scope:** EQ applies only to playback inside tandem. It does not change your computer’s audio settings, process other apps, export edited audio, or provide a system EQ preset. JSON export is a record; importing it is not supported. “Blind” means the interface and agent state hide the pending mapping, not that a person inspecting browser storage cannot find it. This is a preference tool, not a hearing test or scientifically calibrated loudness comparison. EQ can change perceived loudness, and two trials cannot establish a universally better profile.

## Your audio and saved progress

Audio is synthesized or decoded on your device. tandem does not upload it. Local files must be supported by your browser, at most **50 MiB**, and no longer than **10 minutes**. WAV and MP3 are useful starting formats; codec support varies by browser. The decoded clip loops during playback.

Session settings and feedback are saved automatically in this browser’s local storage. Audio is not saved. After refreshing, reload the demo or choose the same local file to continue the existing session. New local-file sessions store a local SHA-256 fingerprint to reject a different track during recovery. Older sessions without a fingerprint cannot make that check. Neither filenames nor fingerprints are exposed to the agent or included in exports.

**New session** replaces the saved session after confirmation. Export first if you want to keep its history. Clearing browser site data also removes saved progress. Use one tab per session; simultaneous editing across tabs is not supported. See [Privacy](PRIVACY.md).

## Use with a browser agent

Open tandem in a browser that supports the current `document.modelContext.registerTool` API and provides an agent that can access page tools. The header reports **Agent tools available** only after registration succeeds. This does not mean every assistant or browser can use WebMCP. Ordinary browsers can use the guided controls.

Load audio, then ask your agent:

> Read tandem’s listening skill and current state. Stage a small blind comparison. Wait for me to listen and vote, then use my recorded preferred settings and notes to choose the next comparison. After at least two trials, propose a profile for me to review.

| Tool | Purpose |
| --- | --- |
| `skill_calibrate_listening` | Read the workflow, EQ bands, limits, and human decisions |
| `get_calibration_state` | Read the current revision, completed feedback, preferred settings, and available actions |
| `stage_ab_trial` | Stage two distinct EQ candidates as a randomized comparison |
| `stage_final_profile` | Propose a profile after at least two completed trials |

Playback, listening, voting, approval, save, and export remain in the interface. There is no remote MCP server to connect. See [the WebMCP guide](WEBMCP.md) for inputs, recovery, and an example.

## Run locally

Requirements: **Node.js 22.13+** and **pnpm 11.19.0**.

```bash
git clone https://github.com/agammann/tandem-webmcp.git
cd tandem-webmcp
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:3000`. No environment variables, cloud account, backend, or database are needed.

```bash
pnpm build
pnpm preview
```

The production files are in `dist/client`. Serve that directory from a static HTTPS host at the site root. `pnpm preview` is for checking the build locally. `.openai/hosting.json` points to the maintained public Site; do not reuse its project ID when deploying your own copy.

## Verify changes

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

Vitest covers EQ limits, shared headroom, revisions, idempotency, session recovery, feedback mapping, and tool registration failure. Playwright runs the production build through manual and mocked-WebMCP workflows, using real browser audio nodes. It checks approval/export, reload recovery, local-file errors and identity, and a mobile layout. Automated test votes are scripted input, not listening evaluations. Mocked registration does not by itself prove compatibility with a particular browser agent.

The GitHub workflow runs these checks for pushes and pull requests. Changes to browser support should also be checked in a real WebMCP-enabled client.

## Contributing

For a bug report, include the browser/version, steps, expected result, and actual result. Mention whether you used guided mode or an agent. Avoid attaching private audio or personal notes. Small focused fixes are welcome.

Built with React, TypeScript, Vite, Zustand, Zod, and the Web Audio API. See [accessibility notes](ACCESSIBILITY.md) and [attribution](ATTRIBUTION.md). Licensed under [MIT](LICENSE).
