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

## External checks — only after approved deployment

- [x] Local URL submitted to WebMCP Ready Checker; recorded as unreachable rather than misreported as a score
- [x] ora.ai hosted/local paths attempted; hosted scan requires a domain and local Chrome launch is sandbox-blocked
- [x] WebMCPTools.io audit-report generator tested; its `85/100` result was rejected as non-evidentiary after it returned identical results for a nonexistent `.invalid` domain
- [x] WebMCPTools.io Checker, Security Scanner, Description Analyzer, Schema Validator, WebMCP Validator, and Implementation Checklist reviewed with negative or malformed-input controls
- [x] WebMCPTools.io supported finding fixed: rich descriptions now cover every mutation parameter and nested EQ band
- [x] WebMCPTools.io `outputSchema` suggestion checked against the current page-side specification and rejected as outside `ModelContextTool`
- [x] WebMCPTools.io fabricated/fixed scores excluded from release and submission claims
- [ ] Live root and `/og.png` return successful responses
- [ ] WebMCP Ready Checker run and findings recorded
- [ ] ora.ai project review run and findings recorded
- [ ] A target-derived WebMCPTools.io audit run and findings recorded, if that service adds real remote checks
- [ ] Live WebMCP reads and mutations verified in a supported agent browser

## Publication — requires user approval

- [ ] Public source repository created
- [ ] Repository contains all source, docs, MIT license, and setup instructions
- [ ] Live site deployed and independently verified
- [ ] Narrated public YouTube demo under three minutes uploaded and playback/audio verified
- [ ] Real live, repository, and demo URLs replace pending placeholders

## Devpost — requires current record and user-supplied declarations

- [ ] Confirm exact submission id before editing
- [ ] Project story, media, captions, tags, judge instructions, and links saved
- [ ] Eligibility, residence, submitter type, learning level, career impact, and legal declarations supplied by the user rather than inferred
- [ ] User gives explicit final-action approval
- [ ] Final page verifies `Project submitted!`, `Submitted`, and `5/5 steps done`
