import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { exportableSession, freshSession, useTandemStore } from '@/lib/store';
import { FLAT_PROFILE } from '@/lib/eq';
import { sessionStorage, usePersistenceStatus } from '@/lib/persistence';
import { TandemApp } from '@/components/tandem-app';

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
  });
  useTandemStore.getState().beginSession();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('rejects malformed completedTrials and retains the original saved bytes', async () => {
  const raw = JSON.stringify({ state: { ...freshSession(), completedTrials: null }, version: 0 });
  localStorage.setItem('tandem-listening-session-v1', raw);
  await useTandemStore.persist.rehydrate();
  expect(Array.isArray(useTandemStore.getState().completedTrials)).toBe(true);
  render(<TandemApp />);
  expect(await screen.findByRole('button', { name: 'Load demo audio' })).toBeDefined();
  expect(await screen.findByRole('alert')).toHaveTextContent(/saved session/i);
  act(() => useTandemStore.getState().markAudioReady('tandem demo loop'));
  expect(localStorage.getItem('tandem-listening-session-v1')).toBe(raw);
});

it('keeps normal actions usable when browser storage is full', async () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('Synthetic storage is full', 'QuotaExceededError');
  });
  expect(() => useTandemStore.getState().beginSession()).not.toThrow();
  expect(() => useTandemStore.getState().markAudioReady('tandem demo loop')).not.toThrow();
  expect(useTandemStore.getState().audioReady).toBe(true);
  render(<TandemApp />);
  expect(await screen.findByRole('alert')).toHaveTextContent(/not saved/i);
});

const KEY = 'tandem-listening-session-v1';
const saved = (state: unknown, version: unknown = 0) => JSON.stringify({ state, version });

it.each([
  ['invalid JSON', '{oops'],
  ['null envelope', 'null'],
  ['missing envelope version', JSON.stringify({ state: freshSession() })],
  ['unsupported envelope version', saved(freshSession(), 10)],
  ['string envelope version', saved(freshSession(), '0')],
  ['unsupported session version', saved({ ...freshSession(), schemaVersion: 2 })],
  ['missing session fields', saved({ schemaVersion: 1 })],
  ['invalid timeline', saved({ ...freshSession(), timeline: [null] })],
  ['invalid requests', saved({ ...freshSession(), processedRequestIds: [null] })],
  ['invalid revision', saved({ ...freshSession(), revision: -1 })],
  ['unknown status', saved({ ...freshSession(), status: 'unexpected' })],
  ['invalid session identifier', saved({ ...freshSession(), sessionId: 3 })],
  ['invalid timestamp', saved({ ...freshSession(), createdAt: 'yesterday' })],
  ['missing active trial', saved({ ...freshSession(), status: 'trial_pending', audioSourceLabel: 'local audio' })],
  ['impossible saved approval', saved({ ...freshSession(), approvedProfileSaved: true })],
])('recovers safely from %s without replacing original storage', async (_name, raw) => {
  localStorage.setItem(KEY, raw);
  await useTandemStore.persist.rehydrate();
  expect(useTandemStore.getState()).toMatchObject({ status: 'setup', completedTrials: [] });
  expect(usePersistenceStatus.getState()).toMatchObject({ issue: 'invalid', recoveryData: raw });
  useTandemStore.getState().markAudioReady('tandem demo loop');
  expect(localStorage.getItem(KEY)).toBe(raw);
});

function stage(requestId: string, source: 'agent' | 'manual' = 'agent') {
  const current = useTandemStore.getState();
  expect(current.stageTrial({
    requestId, expectedRevision: current.revision, question: 'Which?',
    candidateOne: FLAT_PROFILE, candidateTwo: { ...FLAT_PROFILE, air: 1 }, agentRationale: 'Compare air.',
  }, source).ok).toBe(true);
}
function complete(requestId: string, source: 'agent' | 'manual' = 'agent') {
  stage(requestId, source);
  useTandemStore.getState().recordFeedback('B', ['Clearer'], 'A private note');
}
function final(source: 'agent' | 'manual' = 'agent') {
  const current = useTandemStore.getState();
  expect(current.stageFinal({ requestId: 'final', expectedRevision: current.revision,
    profile: { ...FLAT_PROFILE, air: 1 }, explanation: 'Review this profile.' }, source).ok).toBe(true);
}

it('does not guess the actor of a legacy proposal from its request ID', async () => {
  useTandemStore.getState().markAudioReady('tandem demo loop');
  complete('first'); complete('second'); final();
  const envelope = JSON.parse(localStorage.getItem(KEY)!);
  envelope.state.stagedFinalProfile.requestId = 'manual-looking-legacy';
  delete envelope.state.stagedFinalProfile.source;
  localStorage.setItem(KEY, JSON.stringify(envelope));
  await useTandemStore.persist.rehydrate();
  expect(usePersistenceStatus.getState().issue).toBeNull();
  expect(useTandemStore.getState().stagedFinalProfile?.source).toBeUndefined();
  render(<TandemApp />);
  const panel = await screen.findByRole('region', { name: 'Final EQ profile' });
  expect(within(panel).getByText('Proposed', { exact: true })).toBeInTheDocument();
  expect(screen.queryByText('Manual proposed')).toBeNull();
});

it('labels a trusted manual proposal without implying an agent handled the session', async () => {
  useTandemStore.getState().markAudioReady('tandem demo loop');
  complete('first', 'manual'); complete('second', 'manual'); final('manual');
  render(<TandemApp />);
  const panel = await screen.findByRole('region', { name: 'Final EQ profile' });
  expect(within(panel).getByText('Manual proposed')).toBeInTheDocument();
  expect(screen.queryByText('Agent staged')).toBeNull();
});

it.each(['mapping', 'profile', 'feedback', 'timeline', 'proposal'])('rejects damaged nested %s data', async (field) => {
  useTandemStore.getState().markAudioReady('tandem demo loop');
  complete('first'); complete('second'); final();
  const data = JSON.parse(localStorage.getItem(KEY)!);
  if (field === 'mapping') data.state.completedTrials[0].mapping = { A: 'one', B: 'one' };
  if (field === 'profile') data.state.completedTrials[0].candidateOne.air = 30;
  if (field === 'feedback') data.state.completedTrials[0].feedback.tags = [null];
  if (field === 'timeline') data.state.timeline[0].actor = null;
  if (field === 'proposal') data.state.stagedFinalProfile.profile.air = '1';
  useTandemStore.getState().beginSession();
  const raw = JSON.stringify(data);
  localStorage.setItem(KEY, raw);
  await useTandemStore.persist.rehydrate();
  expect(useTandemStore.getState()).toMatchObject({ status: 'setup', completedTrials: [] });
  expect(usePersistenceStatus.getState().issue).toBe('invalid');
  expect(localStorage.getItem(KEY)).toBe(raw);
});

it('roundtrips every supported workflow phase, never restores audio readiness, and supports old sessions without fingerprints', async () => {
  const reload = async () => {
    const original = JSON.parse(localStorage.getItem(KEY)!).state;
    await useTandemStore.persist.rehydrate();
    expect(useTandemStore.getState()).toMatchObject({ ...original, audioReady: false });
    expect(usePersistenceStatus.getState().issue).toBeNull();
    useTandemStore.getState().markAudioReady('local audio');
  };
  await reload();
  await reload();
  stage('first'); await reload();
  useTandemStore.getState().recordFeedback('A', [], ''); await reload();
  complete('second'); await reload();
  final(); await reload();
  useTandemStore.getState().approveFinal(); await reload();
  useTandemStore.getState().saveApprovedProfile(); await reload();
  expect(useTandemStore.getState().approvedProfileSaved).toBe(true);
  expect(useTandemStore.getState().audioFingerprint).toBeUndefined();
});

it('strips unexpected action properties and forces edited audioReady flags off on reload', async () => {
  localStorage.setItem(KEY, saved({ ...freshSession(), audioReady: true, beginSession: 'not a function' }));
  await useTandemStore.persist.rehydrate();
  expect(useTandemStore.getState().audioReady).toBe(false);
  expect(typeof useTandemStore.getState().beginSession).toBe('function');
});

it.each(['QuotaExceededError', 'SecurityError'])('keeps feedback, approval, export and repeated save working in memory on %s', async (name) => {
  useTandemStore.getState().markAudioReady('local audio', 'private-fingerprint');
  const previous = localStorage.getItem(KEY);
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Synthetic failure', name); });
  complete('first'); complete('second'); final();
  useTandemStore.getState().approveFinal();
  useTandemStore.getState().saveApprovedProfile();
  useTandemStore.getState().saveApprovedProfile();
  expect(useTandemStore.getState()).toMatchObject({ status: 'approved', approvedProfileSaved: true });
  expect(useTandemStore.getState().completedTrials).toHaveLength(2);
  expect(usePersistenceStatus.getState().issue).toBe('write_failed');
  expect(localStorage.getItem(KEY)).toBe(previous);
  const exported = JSON.parse(JSON.stringify(exportableSession(useTandemStore.getState())));
  expect(exported.completedTrials).toHaveLength(2);
  expect(exported).not.toHaveProperty('audioFingerprint');
  expect(exported).not.toHaveProperty('processedRequestIds');
  expect(exported).not.toHaveProperty('recoveryData');
  render(<TandemApp />);
  expect(await screen.findByRole('button', { name: 'Save approved profile' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: 'Saved locally' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Save approved profile' }));
  expect(screen.queryByText('Approved profile saved locally by the human.')).toBeNull();
  write.mockRestore();
  fireEvent.click(screen.getByRole('button', { name: 'Save approved profile' }));
  expect(await screen.findByRole('button', { name: 'Saved locally' })).toBeDisabled();
  expect(screen.queryByRole('alert')).toBeNull();
  expect(JSON.parse(localStorage.getItem(KEY)!).state.completedTrials).toHaveLength(2);
});

it('does not erase the previous saved session before a reset that cannot be saved', () => {
  useTandemStore.getState().markAudioReady('tandem demo loop');
  complete('first');
  const previous = localStorage.getItem(KEY);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
  useTandemStore.getState().clearPersistedSession();
  expect(useTandemStore.getState()).toMatchObject({ status: 'setup', completedTrials: [] });
  expect(localStorage.getItem(KEY)).toBe(previous);
  expect(usePersistenceStatus.getState().issue).toBe('write_failed');
});

it.each(['getItem', 'getter'])('handles unreadable storage (%s) without overwriting an unknown saved session', async (failure) => {
  const previous = localStorage.getItem(KEY);
  const storage = localStorage;
  const read = failure === 'getItem'
    ? vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); })
    : vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
  await expect(useTandemStore.persist.rehydrate()).resolves.toBeUndefined();
  expect(usePersistenceStatus.getState().issue).toBe('unavailable');
  expect(() => useTandemStore.getState().markAudioReady('tandem demo loop')).not.toThrow();
  read.mockRestore();
  expect(storage.getItem(KEY)).toBe(previous);
});

it('handles denied removal without throwing or removing the saved data', () => {
  const previous = localStorage.getItem(KEY);
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
  expect(() => sessionStorage.removeItem(KEY)).not.toThrow();
  expect(localStorage.getItem(KEY)).toBe(previous);
  expect(usePersistenceStatus.getState().issue).toBe('write_failed');
});

it('preserves damaged data when New session is cancelled and replaces only after confirmation', async () => {
  const raw = '{damaged';
  localStorage.setItem(KEY, raw);
  await useTandemStore.persist.rehydrate();
  render(<TandemApp />);
  fireEvent.click(await screen.findByRole('button', { name: 'New session' }));
  fireEvent.click(screen.getByRole('button', { name: 'Keep this session' }));
  expect(localStorage.getItem(KEY)).toBe(raw);
  expect(screen.queryByRole('region', { name: 'New session confirmation' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'New session' }));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Start new session' })));
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.getByRole('button', { name: 'Load demo audio' })).toBeEnabled();
  expect(JSON.parse(localStorage.getItem(KEY)!).state.status).toBe('setup');
});

it('does not treat a redacted JSON export as an importable persisted session', async () => {
  useTandemStore.getState().markAudioReady('local audio', 'private-fingerprint');
  stage('pending');
  const exported = exportableSession(useTandemStore.getState());
  expect(exported.activeTrial).not.toHaveProperty('mapping');
  expect(exported).not.toHaveProperty('audioFingerprint');
  const raw = JSON.stringify(exported);
  useTandemStore.getState().beginSession();
  localStorage.setItem(KEY, raw);
  await useTandemStore.persist.rehydrate();
  expect(usePersistenceStatus.getState().issue).toBe('invalid');
  expect(localStorage.getItem(KEY)).toBe(raw);
});
