# Privacy

tandem is local-first by design.

- Built-in demo audio is synthesized in the browser.
- Selected audio files are read and decoded only on the user’s device.
- Audio bytes, file names, file paths, and waveform data are not sent to a server or exposed through WebMCP.
- The session state contains EQ profiles, votes, feedback tags, optional text notes, provenance, and revision metadata. It is stored in browser local storage.
- JSON export happens only after a visible human click and contains no audio bytes or processed request ids.
- tandem has no accounts, backend, database, analytics, advertising, tracking, or OpenAI API integration.

Clearing browser site data removes the locally persisted session. The interface can also start a fresh session without uploading or deleting any source audio file.

WebMCP inputs and returned human notes are treated as untrusted data. Strings are length-limited, schemas reject unknown fields, and agent-provided text is rendered as plain React text rather than HTML.
