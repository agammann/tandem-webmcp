# Changelog

## 1.0.3

- Clarify the privacy contract: exports omit the internal `processedRequestIds` retry ledger, while individual completed-trial and final-proposal `requestId` values remain as provenance. Review those identifiers and notes before sharing.
- Assert both ledger omission and retained record provenance in the existing export regression. Export bytes/schema, audio processing and session behavior are unchanged.

## 1.0.2

- Deliver the current compatible dependency and Node 24/26 verification contract in a checksummed source archive.
- Patch Vite 8.2.4 to 8.3.7 with patched Rolldown for GHSA-p4f5-76q4-ffq7, which concerns explicitly network-exposed development servers. Keep localhost development defaults and static hosting.
- Preserve the existing audio model, guided and native workflows, four tools, explicit playback/feedback/approval controls, session schema, and origin-bound recovery.

## 1.0.1

- Record the manual or agent source of newly staged trials and final proposals explicitly.
- Use a neutral label for older final proposals whose source was not stored.
- Clarify the interface copy for both guided and agent workflows.

## 1.0.0

- Establish the supported guided and optional native WebMCP workflows as the v1 contract.
- Patch the available source-map-js and tinypool dependency advisories through bounded overrides.
- Provide a checksummed MIT source ZIP, fresh-consumer verification, and a main-only publisher guarded by the checked commit.
- Document browser session recovery, original audio requirements, upgrade boundaries, and the limits of JSON export and automated listening checks.
