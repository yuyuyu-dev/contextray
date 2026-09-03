import { describe, expect, it } from 'vitest';
import { VERSION } from '../src/version.js';

describe('contextray', () => {
  it('exposes a version string', () => {
    expect(VERSION).toBe('0.1.0');
  });
});
