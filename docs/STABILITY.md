# Tandem v1 support and recovery

## Supported workflow

Load the demo or a supported local file, stage two distinct bounded EQ candidates, play both paths, record feedback, and repeat. Review the suggested profile against Original, then approve and save it or reject it and continue testing. Reject and Request another test restore unchanged audio processing while retaining completed trials. JSON export records the settings and feedback.

The guided mode works without WebMCP or an API key. Optional native WebMCP exposes four tools for reading the skill and state and staging trials and final proposals. Playback, voting, approval, save, and export are explicit UI decisions. A listener must assess the sound; automated recorded votes prove the controls and state transitions, not a person's preference.

## Persistence and recovery

Settings, feedback, pending trials, and approved profiles save in local storage at the current origin. Audio is never saved. Refreshing or reopening the same browser profile and origin restores the session with audio paused. Reload demo audio or select the original local file before continuing. The stored local SHA-256 fingerprint refuses a different track for new sessions; older sessions without a fingerprint lack that check.

Export JSON before New session or clearing site data. JSON is a readable record, not an import or audio backup. The app does not offer cross-browser restoration, cloud sync, or recovery after browser storage is erased. Keep your original local audio independently. Use one tab per session. Browser profile backups remain subject to your browser's own support and privacy rules.

## Developer setup and upgrades

Use Node.js 24.15+ and pnpm 11.19.0. Install the frozen lockfile, build, then preview at `http://localhost:3000`. Deploy `dist/client` at the root of your own HTTPS static origin; no environment variables or server database are required. Do not reuse the maintained Site's project ID.

When updating a self-hosted copy, export the current session record, retain the old static build, and keep the same origin and browser profile. Replace the static files only after verification; reload, reselect the original audio, and confirm the same trial history and approved profile. If it fails, restore the previous static files. Moving to a new origin will not move browser storage. This v1 release preserves the existing session key and schema.

## Verification and stopping point

The release gate runs the 26 unit checks, type checking, lint, a dependency audit with no findings, seven ordinary browser checks using real audio nodes, five native WebMCP checks, and the same browser acceptance from an independent exact-source ZIP consumer. Checks include real decoded audio amplitude changes, pause/resume, restored filters, refused inputs, idempotency, saved recovery, local-file identity/privacy, mobile controls, and cached page lifecycle. Source archives exclude installed dependencies, built files, browser profiles, private environment files, and test outputs.

Ordinary checks use Chromium; native checks use Chrome with WebMCP enabled. WebMCP is experimental and must be rechecked after browser changes. Measured signal processing and scripted feedback do not establish hearing safety, preference quality, scientific calibration, or connected-agent behavior on every browser. Tandem does not export edited audio or change system audio settings. With the bounded workflows and delivered source passing, the initial release is complete; subsequent improvements are maintenance releases.
