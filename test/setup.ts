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

beforeEach(() => {
  localStorage.clear();
});
