import { describe, it, expect } from 'vitest';
import { GAME_DATA_PACKAGE, listDatasets } from './index.js';

describe('@maiden/game-data (placeholder)', () => {
  it('is importable and exposes no datasets yet', () => {
    expect(GAME_DATA_PACKAGE).toBe('@maiden/game-data');
    expect(listDatasets()).toEqual([]);
  });
});
