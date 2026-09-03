import { describe, it, expect } from 'vitest';
import { SIMULATOR_PACKAGE, simulatorReady } from './index.js';

describe('@maiden/simulator (placeholder)', () => {
  it('is importable and reports ready', () => {
    expect(simulatorReady()).toBe(true);
    expect(SIMULATOR_PACKAGE).toBe('@maiden/simulator');
  });
});
