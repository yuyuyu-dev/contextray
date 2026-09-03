import { describe, expect, it } from 'vitest';
import { VERSION } from '../src/version.js';

describe('ctxray', () => {
  it('exposes a version string', () => {
    expect(VERSION).toBe('0.1.0');
  });
});
