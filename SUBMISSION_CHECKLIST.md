# Submission checklist

## Local product gates

- [x] TypeScript strict-mode check passes
- [x] Lint passes
- [x] Vitest suite passes: 20/20
- [x] Production build passes
- [x] In-app browser Playwright workflow passes with real page-owned WebMCP calls and visible human voting/approval
- [ ] Standalone `@playwright/test` runner passes outside this sandbox; the test file is complete, but this managed Windows environment blocks its worker process with `spawn EPERM`
- [x] Four tools register with correct schemas and annotations
- [x] Valid tool mutations update visible shared state
- [x] Invalid input fails without corrupting state; stale revisions are covered by Vitest
- [x] Identical A/B candidates fail before mutation; live negative control preserved the revision
- [x] Tool schema frequencies derive from the audio engine’s canonical EQ metadata
- [x] Initial EQ-chain headroom, failed-audio session preservation, and reduced-motion spectrum behavior hardened
- [x] Human-only actions are absent from the tool registry
- [x] Local demo audio, A/B switching, final/original comparison, rejection, approval, save, and export click work
- [x] Keyboard semantics, screen-reader labels, reduced motion, 390×844 mobile layout, contrast, and horizontal overflow checked

## External checks

- [x] Local URL submitted to WebMCP Ready Checker; recorded as unreachable rather than misreported as a score
- [x] ora.ai hosted/local paths attempted; hosted scan requires a domain and local Chrome launch is sandbox-blocked
- [x] WebMCPTools.io audit-report generator tested; its `85/100` result was rejected as non-evidentiary after it returned identical results for a nonexistent `.invalid` domain
- [x] WebMCPTools.io Checker, Security Scanner, Description Analyzer, Schema Validator, WebMCP Validator, and Implementation Checklist reviewed with negative or malformed-input controls
- [x] WebMCPTools.io supported finding fixed: rich descriptions now cover every mutation parameter and nested EQ band
- [x] WebMCPTools.io `outputSchema` suggestion checked against the current page-side specification and rejected as outside `ModelContextTool`
- [x] WebMCPTools.io fabricated/fixed scores excluded from release and submission claims
- [x] Live root, `/og.png`, and `/llms.txt` return successful responses
- [x] WebMCP Ready Checker run against production; static-crawler false negatives recorded
- [x] ora.ai hosted audit run against production; scanner capture failure (`about:blank`, zero pages) recorded
- [x] WebMCPTools.io audit run against production; fixed/demo `85/100` output rejected using its identical nonexistent-domain control
- [x] Live WebMCP reads and mutations verified in a supported agent browser

## Publication — requires user approval

- [x] Public source repository created
- [x] Repository contains all source, docs, MIT license, and setup instructions
- [x] Live site deployed and independently verified
- [x] Narrated public YouTube demo under three minutes uploaded and playback/audio verified
- [x] Public demo URL replaces the remaining publication note

## Devpost — requires current record and user-supplied declarations

- [x] Exact tandem submission identified as `1167620` before editing
- [x] Project story, thumbnail/gallery media, tags, judge instructions, and verified links saved
- [x] Residence, submitter type, learning level, career impact, and legal declarations supplied by the user rather than inferred
- [x] User gave explicit final-action approval
- [x] Final page verifies `Project submitted!`, `SUBMITTED`, `5/5 steps done`, and a checked/disabled agreement

