import { describe, it, expect } from 'vitest';
import { UI_PACKAGE, Placeholder } from './index.js';

describe('@maiden/ui (placeholder)', () => {
  it('is importable', () => {
    expect(UI_PACKAGE).toBe('@maiden/ui');
    expect(typeof Placeholder).toBe('function');
  });
});
