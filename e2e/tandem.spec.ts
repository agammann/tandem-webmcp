import { expect, test, type Page } from '@playwright/test';

async function installMockWebMCP(page: Page) {
  await page.addInitScript(() => {
    const tools: Record<string, { execute(input: unknown): unknown }> = {};
    Object.defineProperty(window, '__tandemTestTools', { value: tools, configurable: true });
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: {
        registerTool(tool: { name: string; execute(input: unknown): unknown }) {
          tools[tool.name] = tool;
        },
      },
    });
  });
}

async function loadDemo(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: 'Load demo audio' }).click();
  await expect(page.getByText('tandem demo loop')).toBeVisible();
}

test('human completes the full manual fallback, approval, save, and export flow', async ({ page }) => {
  await installMockWebMCP(page);
  await loadDemo(page);
  await page.getByRole('button', { name: /Stage example/ }).click();
  await expect(page.getByText('Blind test')).toBeVisible();
  await page.getByRole('button', { name: 'Prefer A' }).click();
  await page.getByText('Clearer', { exact: true }).click();
  await page.getByRole('button', { name: 'Record my feedback' }).click();
  await page.getByRole('button', { name: /Stage example/ }).click();
  await page.getByRole('button', { name: 'Prefer B' }).click();
  await page.getByText('Less tiring', { exact: true }).click();
  await page.getByRole('button', { name: 'Record my feedback' }).click();
  await expect(page.getByText('A final profile can be staged.')).toBeVisible();
  await page.getByRole('button', { name: /Stage final/ }).click();
  await expect(page.getByRole('button', { name: 'Original' })).toBeVisible();
  await page.getByRole('button', { name: 'Approve profile' }).click();
  await page.getByRole('button', { name: 'Save approved profile' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export session JSON' }).click();
  expect((await download).suggestedFilename()).toMatch(/^tandem-session-.*\.json$/);
  await expect(page.getByText('Human approved', { exact: true }).first()).toBeVisible();
});

test('mocked WebMCP stages trials while voting and approval stay in the UI', async ({ page }) => {
  await installMockWebMCP(page);
  await loadDemo(page);
  await expect(page.getByText('Agent tools available')).toBeVisible();
  const toolNames = await page.evaluate(() => Object.keys((window as unknown as { __tandemTestTools: Record<string, unknown> }).__tandemTestTools));
  expect(toolNames).toEqual([
    'skill_calibrate_listening',
    'get_calibration_state',
    'stage_ab_trial',
    'stage_final_profile',
  ]);
  expect(toolNames.join(' ')).not.toMatch(/(^|_)(vote|approve|unlock|save|export)(_|$)/);

  const stageTrial = async (requestId: string, offset: number) => {
    await page.evaluate(
      async ({ requestId, offset }) => {
        const tools = (window as unknown as { __tandemTestTools: Record<string, { execute(input: unknown): unknown }> }).__tandemTestTools;
        const state = (await tools.get_calibration_state.execute({})) as { revision: number };
        await tools.stage_ab_trial.execute({
          requestId,
          expectedRevision: state.revision,
          question: offset === 1 ? 'Which is clearer without becoming harsh?' : 'Which feels less tiring?',
          candidateOne: { low: 0, warmth: 0, presence: 0.5 * offset, clarity: 1, air: 0 },
          candidateTwo: { low: 0, warmth: 0.5, presence: 0, clarity: 0, air: 0.5 * offset },
          agentRationale: 'A small two-variable comparison based on the latest human feedback.',
        });
      },
      { requestId, offset },
    );
  };

  await stageTrial('e2e-agent-trial-1', 1);
  await page.getByRole('button', { name: 'Prefer A' }).click();
  await page.getByRole('button', { name: 'Record my feedback' }).click();
  await stageTrial('e2e-agent-trial-2', 2);
  await page.getByRole('button', { name: 'No preference' }).click();
  await page.getByRole('button', { name: 'Record my feedback' }).click();
  await page.evaluate(async () => {
    const tools = (window as unknown as { __tandemTestTools: Record<string, { execute(input: unknown): unknown }> }).__tandemTestTools;
    const state = (await tools.get_calibration_state.execute({})) as { revision: number };
    await tools.stage_final_profile.execute({
      requestId: 'e2e-agent-final',
      expectedRevision: state.revision,
      profile: { low: 0, warmth: 0, presence: 0.5, clarity: 1, air: 0 },
      explanation: 'Trial one preferred the clarity lift; trial two found no meaningful difference, so the proposal stays conservative.',
    });
  });
  await expect(page.getByText('Agent proposed', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Approve profile' }).click();
  await expect(page.getByText('This profile is yours.')).toBeVisible();
});
