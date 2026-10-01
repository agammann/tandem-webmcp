import { test, expect, type Page } from '@playwright/test';

type NativeTool = { name: string; title: string; inputSchema: string | Record<string, unknown>; annotations: { readOnlyHint: boolean; untrustedContentHint: boolean } };
type NativeContext = { registerTool: unknown; getTools(): Promise<NativeTool[]>; executeTool(tool: NativeTool, input: string | Record<string, unknown>): Promise<unknown> };
type State = { sessionId: string; revision: number; status: string; audioReady: boolean; completedTrialCount: number; availableActions: string[]; pendingQuestion: string | null; approvedProfile: unknown; humanFeedbackHistory: { choice: string; preferredProfile: unknown }[] };
const names = ['get_calibration_state', 'skill_calibrate_listening', 'stage_ab_trial', 'stage_final_profile'];
const flat = { low: 0, warmth: 0, presence: 0, clarity: 0, air: 0 };

async function ready(page: Page) {
  await expect.poll(() => page.evaluate(async () => (await (document.modelContext as unknown as NativeContext).getTools()).map(tool => tool.name).sort())).toEqual(names);
  await expect(page.getByText('Agent tools available', { exact: true })).toBeVisible();
}
async function call(page: Page, name: string, input: Record<string, unknown> = {}) {
  return page.evaluate(async ({ name, input }) => {
    const context = document.modelContext as unknown as NativeContext;
    const tool = (await context.getTools()).find(tool => tool.name === name)!;
    const major = Number(navigator.userAgent.match(/Chrome\/(\d+)/)?.[1]);
    try {
      const result = await context.executeTool(tool, major < 155 ? JSON.stringify(input) : input);
      return typeof result === 'string' ? JSON.parse(result) : result;
    } catch (error) { return { nativeError: (error as Error).message }; }
  }, { name, input });
}
async function state(page: Page): Promise<State> { return call(page, 'get_calibration_state') as Promise<State>; }
function trial(revision: number, requestId = 'native-trial') {
  return { requestId, expectedRevision: revision, question: `Scripted workflow check (${requestId}): compare the two versions`, candidateOne: flat, candidateTwo: { ...flat, warmth: 0.5 }, agentRationale: 'Verify the browser workflow; this is not a listening judgment.' };
}
async function testVote(page: Page) {
  await page.getByRole('button', { name: 'No preference', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Record my feedback' })).toBeDisabled();
  const play = page.getByRole('button', { name: 'Play audio', exact: true });
  if (await play.isVisible()) await play.click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'A', exact: true }).click();
  await page.getByRole('button', { name: 'B', exact: true }).click();
  await page.getByLabel('Optional note').fill('Scripted test input, not subjective listening feedback.');
  await page.getByRole('button', { name: 'Record my feedback' }).click();
}
test.beforeEach(async ({ page }) => { await page.goto('/'); await ready(page); });

test('native discovery reads the four contracts without revealing a blind mapping or private audio', async ({ page, browser }) => {
  console.log(`Native WebMCP browser: ${browser.version()}`);
  expect(await page.evaluate(() => document.modelContext?.registerTool.toString())).toContain('[native code]');
  const tools = await page.evaluate(async () => (await (document.modelContext as unknown as NativeContext).getTools()));
  for (const tool of tools) {
    expect(tool.title.trim()).not.toBe('');
    const schema = typeof tool.inputSchema === 'string' ? JSON.parse(tool.inputSchema) : tool.inputSchema;
    expect(schema.additionalProperties).toBe(false);
    expect(tool.annotations.readOnlyHint).toBe(['get_calibration_state', 'skill_calibrate_listening'].includes(tool.name));
  }
  const before = await state(page);
  expect(await call(page, 'skill_calibrate_listening')).toMatchObject({ minimumTrials: 2, bands: Array(5).fill(expect.objectContaining({ stepDb: 0.5 })) });
  expect(await state(page)).toEqual(before);
  await page.getByRole('button', { name: 'Load demo audio', exact: true }).click();
  await call(page, 'stage_ab_trial', trial((await state(page)).revision));
  const blind = await state(page);
  expect(blind).toMatchObject({ status: 'trial_pending', availableActions: ['wait_for_human_vote'] });
  for (const key of ['mapping', 'candidateOne', 'candidateTwo', 'audioFingerprint', 'filename', 'audioBytes']) expect(blind).not.toHaveProperty(key);
  await expect(page.getByRole('button', { name: 'Play audio', exact: true })).toBeVisible();
});

test('all four native tools complete staging, scripted UI feedback, human approval controls and saved recovery', async ({ page }) => {
  await call(page, 'skill_calibrate_listening');
  const empty = await state(page);
  expect(await call(page, 'stage_ab_trial', trial(empty.revision))).toHaveProperty('nativeError');
  expect(await state(page)).toEqual(empty);
  await page.getByRole('button', { name: 'Load demo audio', exact: true }).click();
  for (let index = 0; index < 2; index++) {
    const current = await state(page), input = trial(current.revision, `native-trial-${index}`);
    expect(await call(page, 'stage_ab_trial', input)).toMatchObject({ ok: true, revision: current.revision + 1 });
    const pending = await state(page);
    expect(await call(page, 'stage_ab_trial', input)).toMatchObject({ duplicate: true });
    expect(await state(page)).toEqual(pending);
    await expect(page.getByRole('heading', { name: input.question, exact: true })).toBeVisible();
    await testVote(page);
    expect((await state(page)).completedTrialCount).toBe(index + 1);
  }
  const complete = await state(page);
  expect(complete.humanFeedbackHistory.every(row => row.choice === 'no_preference' && row.preferredProfile === null)).toBe(true);
  const profile = { ...flat, warmth: 0.5 };
  expect(await call(page, 'stage_final_profile', { requestId: 'native-final', expectedRevision: complete.revision, profile, explanation: 'Scripted proposal to verify explicit approval controls.' })).toMatchObject({ ok: true, status: 'final_staged' });
  expect((await state(page)).approvedProfile).toBeNull();
  await expect(page.getByRole('button', { name: 'Approve profile' })).toBeDisabled();
  await page.getByRole('button', { name: 'Original', exact: true }).click();
  await page.getByRole('button', { name: 'Approve profile' }).click();
  await page.getByRole('button', { name: 'Save approved profile' }).click();
  expect(await state(page)).toMatchObject({ status: 'approved', approvedProfile: profile });
  await page.reload(); await ready(page);
  expect(await state(page)).toMatchObject({ sessionId: complete.sessionId, audioReady: false, status: 'approved', approvedProfile: profile });
  await page.getByRole('button', { name: 'Reload demo audio' }).click();
  await expect(page.getByRole('button', { name: 'Saved locally' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Play audio', exact: true })).toBeVisible();
});

test('native invalid inputs, stale revisions and premature proposals leave the session unchanged', async ({ page }) => {
  await page.getByRole('button', { name: 'Load demo audio', exact: true }).click();
  const before = await state(page), input = trial(before.revision);
  for (const invalid of [
    { ...input, extra: true }, { ...input, expectedRevision: before.revision - 1 },
    { ...input, candidateTwo: flat }, { ...input, candidateTwo: { ...flat, low: 6.5 } },
    { ...input, candidateTwo: { ...flat, low: 0.25 } },
  ]) {
    expect(await call(page, 'stage_ab_trial', invalid)).toHaveProperty('nativeError');
    expect(await state(page)).toEqual(before);
  }
  expect(await call(page, 'stage_final_profile', { requestId: 'too-early', expectedRevision: before.revision, profile: flat, explanation: 'Scripted premature proposal.' })).toHaveProperty('nativeError');
  expect(await state(page)).toEqual(before);
});

test('native pending comparisons survive reload and wait for audio restoration', async ({ page }) => {
  await page.getByRole('button', { name: 'Load demo audio', exact: true }).click();
  const input = trial((await state(page)).revision); await call(page, 'stage_ab_trial', input);
  const before = await state(page); await page.reload(); await ready(page);
  const restored = await state(page);
  expect(restored).toMatchObject({ sessionId: before.sessionId, revision: before.revision, status: 'trial_pending', audioReady: false, pendingQuestion: input.question, availableActions: ['wait_for_human_audio'] });
  expect(await call(page, 'stage_ab_trial', trial(restored.revision, 'reload-mutation'))).toHaveProperty('nativeError');
  expect(await state(page)).toEqual(restored);
  await page.getByRole('button', { name: 'Reload demo audio' }).click();
  expect(await state(page)).toMatchObject({ audioReady: true, revision: restored.revision + 1, pendingQuestion: input.question });
  await expect(page.getByRole('button', { name: 'Play audio', exact: true })).toBeVisible();
});

test('native tools withdraw on pagehide and reconnect after cached restoration', async ({ page }) => {
  const before = await state(page);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  expect(await page.evaluate(async () => (await (document.modelContext as unknown as NativeContext).getTools()).length)).toBe(0);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await ready(page); expect(await state(page)).toEqual(before);
  await page.evaluate(() => window.addEventListener('pageshow', event => document.documentElement.dataset.cachedRestore = String(event.persisted)));
  await page.goto('about:blank'); await page.goBack({ waitUntil: 'commit' }); await ready(page);
  const persisted = await page.locator('html').getAttribute('data-cached-restore');
  if (!process.env.TANDEM_WEBMCP_URL) expect(persisted).toBe('true');
  expect(await state(page)).toEqual(before);
});
