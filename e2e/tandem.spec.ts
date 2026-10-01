import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { EqProfile } from '../lib/types';

declare global {
  interface Window {
    __tandemTestTools: Record<string, { execute(input: unknown): unknown }>;
    __audioContexts: AudioContext[];
    __filters: BiquadFilterNode[];
    __analysers: AnalyserNode[];
  }
}

async function configureBrowser(page: Page, mode: 'manual' | 'mock' | 'failure' = 'manual') {
  await page.addInitScript((mode) => {
    const tools: Window['__tandemTestTools'] = {};
    window.__tandemTestTools = tools;
    window.__audioContexts = [];
    window.__filters = [];
    window.__analysers = [];
    const NativeAudioContext = window.AudioContext;
    window.AudioContext = class extends NativeAudioContext {
      constructor(options?: AudioContextOptions) { super(options); window.__audioContexts.push(this); }
      createBiquadFilter() { const filter = super.createBiquadFilter(); window.__filters.push(filter); return filter; }
      createAnalyser() { const analyser = super.createAnalyser(); window.__analysers.push(analyser); return analyser; }
    };
    Object.defineProperty(document, 'modelContext', { configurable: true, value: mode === 'manual' ? undefined : {
      registerTool(tool: { name: string; execute(input: unknown): unknown }, options: { signal: AbortSignal }) {
        if (mode === 'failure') return Promise.reject(new Error('Test registration failure'));
        tools[tool.name] = tool;
        options.signal.addEventListener('abort', () => { if (tools[tool.name] === tool) delete tools[tool.name]; });
        return Promise.resolve();
      },
    } });
  }, mode);
}

async function loadDemo(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Load demo audio', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Play audio', exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.__audioContexts.at(-1)?.state)).toBe('suspended');
}

async function listenAndVote(page: Page, choice = 'Prefer A') {
  await page.getByRole('button', { name: choice, exact: true }).click();
  await expect(page.getByRole('button', { name: 'Record my feedback' })).toBeDisabled();
  const play = page.getByRole('button', { name: 'Play audio', exact: true });
  if (await play.isVisible()) await play.click();
  await page.getByRole('button', { name: 'A', exact: true }).click();
  await page.getByRole('button', { name: 'B', exact: true }).click();
  expect(await page.evaluate(() => window.__audioContexts.at(-1)?.state)).toBe('running');
  await page.getByRole('button', { name: 'Record my feedback' }).click();
}

async function completeManualTrials(page: Page) {
  for (const choice of ['Prefer A', 'Prefer B']) {
    await page.getByRole('button', { name: 'Try a guided comparison' }).click();
    await listenAndVote(page, choice);
  }
}

test('manual workflow plays audio, compares, approves, saves, exports, and starts over', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await configureBrowser(page);
  await loadDemo(page);
  await expect(page.getByText('Manual mode', { exact: true })).toBeVisible();
  await completeManualTrials(page);
  await page.getByRole('button', { name: 'Review a suggested profile' }).click();
  await expect(page.getByRole('button', { name: 'Approve profile' })).toBeDisabled();
  await page.getByRole('button', { name: 'Original', exact: true }).click();
  await page.getByRole('button', { name: 'Approve profile' }).click();
  await page.getByRole('button', { name: 'Save approved profile' }).click();
  await expect(page.getByRole('button', { name: 'Saved locally' })).toBeDisabled();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export session JSON' }).click();
  const download = await downloadPromise;
  const file = info.outputPath('session.json');
  await download.saveAs(file);
  const exported = JSON.parse(await readFile(file, 'utf8'));
  expect(exported.status).toBe('approved');
  expect(exported.completedTrials).toHaveLength(2);
  expect(exported.approvedProfile).toBeTruthy();
  expect(exported).not.toHaveProperty('audioFingerprint');
  await page.locator('#workspace').screenshot({ path: info.outputPath('desktop-approved.png') });
  await page.reload();
  await expect(page.getByText('Resume your saved session')).toBeVisible();
  await page.getByRole('button', { name: 'Reload demo audio' }).click();
  await expect(page.getByRole('button', { name: 'Approved EQ', exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.__audioContexts.at(-1)?.state)).toBe('suspended');
  await page.getByRole('button', { name: 'New session', exact: true }).click();
  await page.getByRole('button', { name: 'Keep this session' }).click();
  await expect(page.getByRole('button', { name: 'Saved locally' })).toBeVisible();
  await page.getByRole('button', { name: 'New session', exact: true }).click();
  await page.getByRole('button', { name: 'Start new session', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Load demo audio', exact: true })).toBeVisible();
  await expect(page.getByText('Trial history', { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('mocked WebMCP completes an adaptive workflow using recorded preferred settings', async ({ page }) => {
  await configureBrowser(page, 'mock');
  await loadDemo(page);
  await expect(page.getByText('Agent tools available', { exact: true })).toBeVisible();
  const names = await page.evaluate(() => Object.keys(window.__tandemTestTools));
  expect(names).toEqual(['skill_calibrate_listening', 'get_calibration_state', 'stage_ab_trial', 'stage_final_profile']);
  for (let trial = 0; trial < 2; trial++) {
    await page.evaluate(async (trial) => {
      const tools = window.__tandemTestTools;
      const state = await tools.get_calibration_state.execute({}) as { revision: number; humanFeedbackHistory: { preferredProfile: EqProfile }[] };
      const base = trial === 0 ? { low: 0, warmth: 0, presence: 0, clarity: 0, air: 0 } : state.humanFeedbackHistory[0].preferredProfile;
      await tools.stage_ab_trial.execute({ requestId: `e2e-${trial}`, expectedRevision: state.revision, question: 'Which version do you prefer?', candidateOne: base, candidateTwo: { ...base, air: base.air + 0.5 }, agentRationale: 'Compare a small air increase with the previously preferred settings.' });
    }, trial);
    await listenAndVote(page, 'Prefer B');
  }
  await page.evaluate(async () => {
    const tools = window.__tandemTestTools;
    const state = await tools.get_calibration_state.execute({}) as { revision: number; humanFeedbackHistory: { preferredProfile: EqProfile; profiles: { B: EqProfile } }[] };
    const last = state.humanFeedbackHistory[1];
    if (JSON.stringify(last.preferredProfile) !== JSON.stringify(last.profiles.B)) throw new Error('Feedback mapping is incorrect');
    await tools.stage_final_profile.execute({ requestId: 'e2e-final', expectedRevision: state.revision, profile: last.preferredProfile, explanation: 'Review the settings selected in your most recent comparison.' });
  });
  await page.getByRole('button', { name: 'Original', exact: true }).click();
  await page.getByRole('button', { name: 'Approve profile' }).click();
  await expect(page.getByText('This profile is yours.')).toBeVisible();
});

test('reload preserves a pending trial and reapplies its real audio filters', async ({ page }) => {
  await configureBrowser(page, 'mock');
  await loadDemo(page);
  await page.getByRole('button', { name: 'Try a guided comparison' }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('tandem-listening-session-v1')!).state);
  await page.reload();
  await expect(page.getByText('Resume your saved session')).toBeVisible();
  const waiting = await page.evaluate(async () => window.__tandemTestTools.get_calibration_state.execute({}));
  expect(waiting).toMatchObject({ availableActions: ['wait_for_human_audio'], suggestedNextTool: null });
  await page.getByRole('button', { name: 'Reload demo audio' }).click();
  await page.getByRole('button', { name: 'Play audio', exact: true }).click();
  const expectedA = saved.activeTrial.mapping.A === 'one' ? saved.activeTrial.candidateOne : saved.activeTrial.candidateTwo;
  await expect.poll(() => page.evaluate(() => window.__filters.slice(0, 5).map((f) => Math.round(f.gain.value * 2) / 2))).toEqual(Object.values(expectedA));
  const restored = await page.evaluate(() => JSON.parse(localStorage.getItem('tandem-listening-session-v1')!).state);
  expect(restored.sessionId).toBe(saved.sessionId);
  expect(restored.activeTrial).toEqual(saved.activeTrial);
  await page.getByRole('button', { name: 'B', exact: true }).click();
  await page.getByRole('button', { name: 'No preference', exact: true }).click();
  await page.getByRole('button', { name: 'Record my feedback' }).click();
  await expect(page.getByText('Trial history', { exact: true })).toBeVisible();
});

function wav(frequency: number) {
  const rate = 8000;
  const buffer = Buffer.alloc(44 + rate * 2);
  buffer.write('RIFF'); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(rate, 24); buffer.writeUInt32LE(rate * 2, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36); buffer.writeUInt32LE(rate * 2, 40);
  for (let i = 0; i < rate; i++) buffer.writeInt16LE(Math.round(Math.sin(2 * Math.PI * frequency * i / rate) * 5000), 44 + i * 2);
  return { name: 'test.wav', mimeType: 'audio/wav', buffer };
}

test('EQ changes the measured output of the same decoded looping clip', async ({ page }) => {
  await configureBrowser(page, 'mock');
  await page.goto('/');
  await page.getByLabel('Choose a local audio file').setInputFiles(wav(350));
  await expect(page.getByRole('button', { name: 'Play audio', exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const tools = window.__tandemTestTools;
    const state = await tools.get_calibration_state.execute({}) as { revision: number };
    const flat = { low: 0, warmth: 0, presence: 0, clarity: 0, air: 0 };
    await tools.stage_ab_trial.execute({ requestId: 'measured-eq', expectedRevision: state.revision, question: 'Scripted audio processing check', candidateOne: { ...flat, warmth: 6 }, candidateTwo: { ...flat, warmth: -6 }, agentRationale: 'Check real processing at the warmth band center.' });
  });
  await page.getByRole('button', { name: 'Play audio', exact: true }).click();
  const rms = () => page.evaluate(() => {
    const analyser = window.__analysers.at(-1)!;
    const samples = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(samples);
    return Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
  });
  await expect.poll(() => page.evaluate(() => Math.abs(window.__filters[1].gain.value))).toBeGreaterThan(5.99);
  await expect.poll(rms).toBeGreaterThan(0.01);
  const measuredA = await rms();
  await page.getByRole('button', { name: 'B', exact: true }).click();
  const gainA = await page.evaluate(() => window.__filters[1].gain.value);
  if (gainA > 0) await expect.poll(rms).toBeLessThan(measuredA / 2.5);
  else await expect.poll(rms).toBeGreaterThan(measuredA * 2.5);
  expect(await page.evaluate(() => window.__audioContexts.at(-1)?.state)).toBe('running');
});

test('rejecting a proposed profile restores unchanged audio processing', async ({ page }) => {
  await configureBrowser(page); await loadDemo(page); await completeManualTrials(page);
  for (const action of ['Reject', 'Request another test']) {
    await page.getByRole('button', { name: 'Review a suggested profile' }).click();
    await expect.poll(() => page.evaluate(() => window.__filters.slice(0, 5).some(filter => filter.gain.value > 0.1))).toBe(true);
    await page.getByRole('button', { name: action, exact: true }).click();
    await expect(page.getByRole('button', { name: 'Try a guided comparison' })).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.__filters.map(filter => Math.round(filter.gain.value * 2) / 2))).toEqual(Array(15).fill(0));
  }
});

test('local files stay local, invalid files recover, and resume requires the original file', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => { if (request.method() !== 'GET') requests.push(request.url()); });
  await configureBrowser(page);
  await page.goto('/');
  const input = page.getByLabel('Choose a local audio file');
  await input.setInputFiles({ name: 'broken.wav', mimeType: 'audio/wav', buffer: Buffer.from('not audio') });
  await expect(page.getByRole('alert')).toBeVisible();
  await input.setInputFiles(wav(440));
  await expect(page.getByRole('button', { name: 'Play audio', exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('button', { name: 'Try a guided comparison' }).click();
  await page.reload();
  await input.setInputFiles(wav(880));
  await expect(page.getByRole('alert')).toContainText('different file');
  await expect(page.getByRole('button', { name: 'Play audio', exact: true })).toHaveCount(0);
  await input.setInputFiles(wav(440));
  await expect(page.getByRole('button', { name: 'Play audio', exact: true })).toBeVisible();
  await listenAndVote(page);
  expect(requests).toEqual([]);
});

test('mobile layout completes manual controls after WebMCP registration failure', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await configureBrowser(page, 'failure');
  await loadDemo(page);
  await expect(page.getByText('Agent connection unavailable', { exact: true })).toBeVisible();
  await completeManualTrials(page);
  await page.getByRole('button', { name: 'Review a suggested profile' }).click();
  await page.getByRole('button', { name: 'Reject', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Try a guided comparison' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('mobile-review.png'), fullPage: true });
});
