# Privacy

tandem is local-first by design.

- Built-in demo audio is synthesized in the browser.
- Selected audio files are read and decoded only on the user’s device.
- Audio bytes, file names, file paths, and waveform data are not sent to a server or exposed through WebMCP.
- The session state contains EQ profiles, votes, feedback tags, optional text notes, provenance, and revision metadata. It is stored in browser local storage.
- A SHA-256 fingerprint of a selected local file is kept only in local storage to check that the same file is reloaded. It is excluded from agent responses and JSON exports. Audio itself is held in memory only.
- JSON export happens only after a visible human click and contains no audio bytes, fingerprint, or processed request ids. Pending blind settings are omitted; completed trials include their revealed profiles.
- tandem has no accounts, backend, database, analytics, advertising, tracking, or OpenAI API integration.

Clearing browser site data removes the locally persisted session. The interface can also start a fresh session without uploading or deleting any source audio file.

Opening the website still requests its code and assets from the hosting provider, which may keep normal service logs. If you use a browser agent, the session settings and feedback exposed through WebMCP may be handled by that agent's provider under its policies. Do not put sensitive information in optional notes. Exported JSON contains your notes; review it before sharing.

WebMCP inputs and returned human notes are treated as untrusted data. Strings are length-limited, schemas reject unknown fields, and agent-provided text is rendered as plain React text rather than HTML.
