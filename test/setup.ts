import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';

class TestCrypto {
  randomUUID() {
    return `00000000-0000-4000-8000-${Math.random().toString().slice(2, 14).padEnd(12, '0')}`;
  }
}

if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, 'crypto', { value: new TestCrypto(), configurable: true });
}

// Node 26 exposes a separate global localStorage. Keep the tests pointed at
// jsdom's browser storage, including when a test spies on the window getter.
const domWindow = (globalThis as unknown as { jsdom: { window: Window } }).jsdom.window;
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  get: () => domWindow.localStorage,
});

beforeEach(() => {
  localStorage.clear();
});
