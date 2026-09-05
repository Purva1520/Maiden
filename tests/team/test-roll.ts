import { describe, expect, it } from 'vitest';
import { rollHistoricalTeams, ODI_YEARS, T20_YEARS } from '../../team/squadBuilder.js';

describe('Roll Mechanic (§8–§14, §54, §72)', () => {
  it('reproduces the exact same rolled teams given the same format, seed, and config', () => {
    const seed = 849273;
    const roll1 = rollHistoricalTeams('ODI', seed);
    const roll2 = rollHistoricalTeams('ODI', seed);

    expect(roll1).toHaveLength(3);
    expect(roll2).toHaveLength(3);
    expect(roll1).toEqual(roll2);
  });

  it('produces different rolled teams with a different seed', () => {
    const roll1 = rollHistoricalTeams('ODI', 849273);
    const roll2 = rollHistoricalTeams('ODI', 999999);

    const keys1 = roll1.map((r) => `${r.teamName}_${r.year}`).join('|');
    const keys2 = roll2.map((r) => `${r.teamName}_${r.year}`).join('|');
    expect(keys1).not.toBe(keys2);
  });

  it('never produces duplicate historical team/tournament combinations in one roll by default', () => {
    for (const seed of [101, 202, 303, 404, 505, 849273]) {
      const roll = rollHistoricalTeams('ODI', seed, { numberOfTeams: 5 });
      const uniqueKeys = new Set(roll.map((r) => `${r.tournamentId}___${r.teamName}`));
      expect(uniqueKeys.size).toBe(5);
    }
  });

  it('strictly restricts ODI rolls to valid ODI World Cup editions', () => {
    const roll = rollHistoricalTeams('ODI', 12345, { numberOfTeams: 10 });
    for (const t of roll) {
      expect(t.format).toBe('ODI');
      expect(ODI_YEARS).toContain(t.year);
      expect(t.year).not.toBe(2024);
    }
  });

  it('strictly restricts T20 rolls to valid T20 World Cup editions', () => {
    const roll = rollHistoricalTeams('T20', 54321, { numberOfTeams: 5 });
    for (const t of roll) {
      expect(t.format).toBe('T20');
      expect(T20_YEARS).toContain(t.year);
      expect(t.year).not.toBe(2019);
    }
  });

  it('respects configurable numberOfTeams parameter', () => {
    const roll2 = rollHistoricalTeams('ODI', 42, { numberOfTeams: 2 });
    expect(roll2).toHaveLength(2);

    const roll4 = rollHistoricalTeams('ODI', 42, { numberOfTeams: 4 });
    expect(roll4).toHaveLength(4);
  });
});
