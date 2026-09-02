# External audit results

Checked September 2, 2026 during local development and again against the verified production deployment at `https://tandem-listening-lab.alx21.chatgpt.site/`.

## WebMCP Ready Checker

Target submitted: `http://localhost:3000`

Observed result: the hosted checker reported that it could not connect to `localhost:3000`. It displayed a score of 0 only because all eight checks were marked “Cannot assess — server unreachable.” This is not a product-readiness score and must not be presented as one.

Production target submitted: `tandem-listening-lab.alx21.chatgpt.site`

Observed result: `28/100`, “Needs work.” The report claimed that the page had no forms, minimal semantics, no JavaScript API, no tool contracts, and that it used “ChatGPT's internal message system.” Those claims conflict with direct inspection of the deployed page: it contains labeled native controls, runs as an independent website, and registers four tools through `document.modelContext.registerTool()` after client hydration. The checker is therefore behaving as a static/server-side crawler that does not execute or observe the page-side WebMCP runtime. Its score is retained as a third-party result but excluded from product-readiness claims.

Compatibility note: this checker searches for `navigator.modelContext`, while tandem implements the page-scoped `document.modelContext` interface used by the challenge environment. Discrepancies are evaluated against the current challenge requirements and live registered behavior rather than accepted blindly.

## ora.ai WebMCP audit

Hosted target submitted through ora.ai’s own `scan_domain` WebMCP tool: `http://localhost:3000`

Observed result: `Invalid domain`, because the hosted audit requires a reachable domain.

ora.ai local CLI attempt: `ax@0.7.1 webmcp-audit http://localhost:3000`

Observed result: the pinned official CLI was located and invoked, but its new Chrome process could not launch under this managed Windows sandbox. The CLI’s `--chrome-endpoint` option requires a separately exposed Chrome debugging endpoint, which is not available here. No score was produced, stored, or ranked.

Production target submitted through ora.ai's hosted audit page: `https://tandem-listening-lab.alx21.chatgpt.site/`

Observed result: “No WebMCP on this page” and not scored. Ora's own capture metadata explains why the result is not evidentiary: `about:blank`, “observed via: not captured,” `pages: 0`, and `tools: 0`, with a one-second run. The scanner never captured the deployed page, so this is a scanner failure rather than a successful negative inspection.

The in-app browser performed the functional contract check that the hosted run did not: all four production tools registered, reads returned current state, mutations visibly updated the same durable UI, two explicitly illustrative human votes were recorded through visible controls, a final profile was staged, and approval/save remained human-only.

## WebMCPTools.io audit report generator

Target submitted: `localhost:3000` (the page forcibly rendered it as `https://localhost:3000`)

Observed result: the generator displayed `85/100`, grade B, and generic claims including “Page loads in under 2s” and “Manifest correctly implemented.” This is not a valid audit of tandem: the hosted service cannot reach a TLS site at `https://localhost:3000`.

Reliability control: the same tool was then run against the deliberately nonexistent target `this-domain-should-not-exist.invalid`. It returned the exact same `85/100` score, four sub-scores, implementation claims, and three recommendations. That control demonstrates that the displayed report is a fixed/demo result rather than target-derived evidence.

The production domain was also submitted after deployment. The generator returned the exact same `85/100`, grade B, four sub-scores, implementation claims, and three recommendations as the unreachable localhost and nonexistent `.invalid` controls. This confirms that the output remains fixed/demo content rather than a target-derived audit. The result was not saved, shared, downloaded, or submitted to the public leaderboard, and it must not be quoted as tandem's score.

## Expanded WebMCPTools.io tool sweep

The following tools were run directly on WebMCPTools.io. Results were not saved, shared, downloaded, or submitted to a leaderboard.

### WebMCP Checker

- Tandem input: `localhost:3000`
- Displayed result: `30/100`
- Reliability finding: invalid. The service claimed that `https://localhost:3000` enforced HTTPS and exposed `llms.txt` plus AI-specific `robots.txt` directives even though that target is not reachable and those files do not exist in the project.
- Negative control: `this-domain-should-not-exist.invalid` returned a different template (`5/100`) but was still awarded HTTPS points. This indicates URL-string heuristics or canned branches, not a real fetch and inspection.
- Compatibility warning: the checker searches for `navigator.modelContext`, while tandem implements the page-scoped `document.modelContext` interface used by the challenge environment.

### WebMCP Security Scanner

- Tandem input: `localhost:3000`
- Displayed result: `88/100`
- Reliability finding: invalid. It claimed HTTPS, authentication, restricted CORS, CSP, HSTS, and `requestUserInteraction()` were detected at an unreachable TLS localhost URL.
- Negative control: the nonexistent `.invalid` domain still received `68/100` and was credited with HTTPS, restricted CORS, CSP, HSTS, and `requestUserInteraction()`. The security score is fabricated and must not be used.

### Tool Description Analyzer

- Tandem input: the real `stage_ab_trial` description
- Displayed result: `92/100`
- Negative control: the one-character description `x` received the exact same `92/100`, sub-scores, and recommendations.
- Reliability finding: fixed/demo output; the 92 score is not evidence about tandem’s descriptions.

### WebMCP Schema Validator

- Tandem input: the exact `stage_ab_trial` input schema from `lib/webmcp.ts`
- Displayed result: `70/100`
- Positive control: malformed JSON (`{`) was correctly rejected as invalid syntax, so this tool performs at least basic parsing.
- Defensible finding: the schema is valid JSON with an object root, defined required fields, bounded values, and no additional properties. Adding human-readable `description` fields to parameters and nested EQ fields could improve agent guidance.
- Reliability caveat: the output also recommended “Fix JSON Syntax” while saying the syntax was valid and claimed a Draft 7 marker was detected even though no `$schema` marker was supplied. The numeric score is therefore not treated as authoritative.

### WebMCP Validator

- Tandem input: a faithful JSON representation of the four registered tools, their real descriptions, and their exact input schemas. This was an analysis representation, not a claim that tandem publishes a manifest.
- Displayed result: `72/100`
- Defensible findings: the basic tool structure passed; the validator identified missing per-parameter descriptions for the two mutation tools and suggested explicit output schemas for all four tools.
- Resolution: descriptive guidance was added to every mutation parameter, every EQ band, both no-input schemas, and both mutation-root schemas. A regression test now requires all mutation parameters and nested band properties to retain meaningful descriptions.
- Output-schema decision: no `outputSchema` was added. The current WebMCP specification’s `ModelContextTool` dictionary defines `name`, `title`, `description`, `inputSchema`, `execute`, and `annotations`, but not `outputSchema`. The recommendation appears to come from server-side MCP manifest conventions and is not part of the current page-side registration contract.

### Implementation Checklist

- The checklist’s three tool-definition items map to tandem: unique action-oriented names, detailed descriptions, and strict input schemas.
- Most remaining items target a server/manifest deployment model (`/.well-known/mcp.json`, manifest link headers, crawler files, endpoint CORS, and endpoint authentication) rather than a page-owned WebMCP challenge app.
- Its recommendation to configure `Access-Control-Allow-Origin: *` should not be adopted as a blanket security practice.
- The checklist UI did not persist checkbox clicks or update its displayed `0%` progress during this run, so no progress percentage is reported.

### Consolidated conclusion

The supported actionable suggestion—richer parameter descriptions—has been implemented and verified in the live registered schemas. The `outputSchema` suggestion was reviewed against the current page-side specification and intentionally rejected as nonstandard for `ModelContextTool`. The URL-based scores (`30`, `88`, and the earlier `85`) and the description score (`92`) failed reliability controls and are excluded from tandem’s evidence.

Production verification provides the release evidence the hosted scanners did not: the root document returned HTTP 200, `/og.png` returned a PNG with HTTP 200, `/llms.txt` returned text with HTTP 200, and the hydrated page registered `skill_calibrate_listening`, `get_calibration_state`, `stage_ab_trial`, and `stage_final_profile`. A production `stage_ab_trial` call advanced the revision and visibly opened the human-only blind-vote interface; after two illustrative human votes, `stage_final_profile` visibly opened the human-only approval gate. No approval was automated.

Post-fix verification: TypeScript, lint, all 20 Vitest tests, and the production build pass. After a browser reload, all four tools re-registered with the new schema descriptions, and a live `get_calibration_state` call succeeded. WebMCPTools.io’s Schema Validator then recognized that all properties had clear descriptions and raised its displayed result from `70/100` to `86/100`. That number remains non-authoritative because the same report incorrectly claimed that no required fields were defined even though the submitted schema contained all six required fields, and it recommended fixing a root object type it simultaneously described as correct.

Additional hardening completed during follow-up review:

- EQ schema descriptions are generated from the same `EQ_BANDS` metadata used by the audio engine and UI, eliminating frequency drift. Live registration now reports the actual 350 Hz warmth and 1500 Hz presence filters.
- `stage_ab_trial` rejects identical candidates before touching state. A live negative-control call returned the expected validation error and left revision 10 unchanged.
- Audio-context ownership is established before EQ-chain initialization, so the intended headroom compensation is applied to newly created chains.
- Failed demo creation or local-file decoding no longer clears the previous session, because a new session begins only after audio preparation succeeds.
- The animated spectrum loop is not started when the browser requests reduced motion.

