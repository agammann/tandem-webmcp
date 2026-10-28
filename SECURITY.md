# Security

Tandem 1.0.x is the supported release line. Report a suspected issue privately to the maintainer through GitHub's private vulnerability reporting when available. Avoid posting private audio or notes publicly.

Tandem is a static browser app with no account, backend, API key, or audio upload. Session settings and feedback live in the current browser's local storage. Local audio is decoded in memory; it is not included in session JSON or sent to an agent. Files are limited to 50 MiB and ten minutes. Agent tools cannot initiate playback, vote, approve, save, export, or reset a session.

Serve your copy at a trusted HTTPS origin. Browser agents can access registered page tools and session feedback, so use only agents you trust. Hidden A/B labels are an interface boundary; someone who can inspect browser storage can inspect the pending mapping. Session notes are plain text rendered by React. Clearing site data removes progress.

Run `pnpm security:audit` after a frozen install. The lockfile uses patched Zod for browser-runtime input validation, patched Vite/Vitest for development and tests, and narrow pnpm overrides for affected transitive versions (including jsdom’s Undici dependency). Development-tool advisories do not establish exposure in the deployed static application; application-specific exploitability has not been established. The release gate retains the full audit JSON, requires an empty advisories object and all five explicit severity counts to be zero, and rejects missing or malformed data; there is no accepted advisory exception. Dependency audit results are a point-in-time check and do not prove the absence of every vulnerability. Reassess dependency or browser changes before a maintenance release.
