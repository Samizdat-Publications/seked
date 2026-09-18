/**
 * Where the reader's key is kept. Nothing here touches the network and nothing
 * here carries a real key: the one below is a string typed for the test.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KEY_NAME, forgetReaderKey, readerKey, setReaderKey } from './runner';

/** Local storage as a browser would have it, since vitest runs in Node. */
function fakeStorage(): Storage {
  const held = new Map<string, string>();
  return {
    get length() {
      return held.size;
    },
    clear: () => held.clear(),
    getItem: (k: string) => held.get(k) ?? null,
    key: (i: number) => [...held.keys()][i] ?? null,
    removeItem: (k: string) => void held.delete(k),
    setItem: (k: string, v: string) => void held.set(k, v),
  } as Storage;
}

beforeEach(() => {
  vi.stubGlobal('localStorage', fakeStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the reader’s key', () => {
  it('is kept in this browser under one name, and forgotten on request', () => {
    expect(readerKey()).toBeNull();
    setReaderKey('  a-key-the-reader-typed  ');
    expect(localStorage.getItem(KEY_NAME)).toBe('a-key-the-reader-typed');
    expect(readerKey()).toBe('a-key-the-reader-typed');
    forgetReaderKey();
    expect(readerKey()).toBeNull();
  });

  it('treats an empty field as no key at all rather than as a key of no characters', () => {
    setReaderKey('   ');
    expect(readerKey()).toBeNull();
  });

  it('says nothing when the browser has no storage to keep it in', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(readerKey()).toBeNull();
    expect(() => setReaderKey('a-key')).not.toThrow();
  });
});
