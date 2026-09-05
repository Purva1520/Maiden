import { describe, expect, it } from 'vitest';
import { generateHistoricalOpponents, buildOpponentXI } from '../../campaign/opponentGenerator.js';
import { validateXI } from '../../team/xiValidator.js';
import { BASE_TEAM_RULES } from '../../team/rules.js';
import { createValidTestXI } from '../team/fixtures.js';

describe('Campaign Opponents (§17–§22, §73)', () => {
  it('generates 7 distinct legal opponents for ODI format', () => {
    const seed = 42;
    const opponents = generateHistoricalOpponents('ODI', seed, 7);

    expect(opponents).toHaveLength(7);

    const opponentIds = new Set<string>();
    const teamTournamentKeys = new Set<string>();

    for (const opp of opponents) {
      expect(opponentIds.has(opp.opponentId)).toBe(false);
      opponentIds.add(opp.opponentId);

      const ttKey = `${opp.historicalTournamentId}::${opp.historicalTeamId}`;
      expect(teamTournamentKeys.has(ttKey)).toBe(false);
      teamTournamentKeys.add(ttKey);

      expect(opp.format).toBe('ODI');
      expect(opp.roster).toHaveLength(11);
      expect(opp.team.players).toHaveLength(11);

      // Validate XI rules via Phase 8 validator
      const validation = validateXI(
        opp.roster,
        opp.roster[0]!.cardId,
        opp.roster.map((p) => p.cardId),
        BASE_TEAM_RULES,
      );
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.checks.wicketkeeper.count).toBeGreaterThanOrEqual(1);
      expect(validation.checks.bowlingOptions.actual).toBeGreaterThanOrEqual(5);
    }
  });

  it('generates 7 distinct legal opponents for T20 format', () => {
    const seed = 999;
    const opponents = generateHistoricalOpponents('T20', seed, 7);

    expect(opponents).toHaveLength(7);
    for (const opp of opponents) {
      expect(opp.format).toBe('T20');
      expect(opp.roster).toHaveLength(11);
      const validation = validateXI(
        opp.roster,
        opp.roster[0]!.cardId,
        opp.roster.map((p) => p.cardId),
        BASE_TEAM_RULES,
      );
      expect(validation.valid).toBe(true);
    }
  });

  it('generates deterministic opponents given the same seed', () => {
    const opps1 = generateHistoricalOpponents('ODI', 12345, 7);
    const opps2 = generateHistoricalOpponents('ODI', 12345, 7);

    expect(opps1.map((o) => o.opponentId)).toEqual(opps2.map((o) => o.opponentId));
    expect(opps1.map((o) => o.roster.map((p) => p.playerId))).toEqual(
      opps2.map((o) => o.roster.map((p) => p.playerId)),
    );
  });

  it('builds an opponent XI that adapts cleanly to SimulatorTeam', () => {
    const candidateCards = createValidTestXI();
    const { simulatorTeam, roster } = buildOpponentXI(candidateCards, 'Australia', 2007, 'ODI');

    expect(roster).toHaveLength(11);
    expect(simulatorTeam.players).toHaveLength(11);

    for (const player of simulatorTeam.players) {
      expect(typeof player.id).toBe('string');
      expect(typeof player.name).toBe('string');
      expect(typeof player.batRating).toBe('number');
      expect(player.batRating).toBeGreaterThanOrEqual(0);
      expect(player.batRating).toBeLessThanOrEqual(99);
      if (player.bowlRating !== null) {
        expect(player.bowlRating).toBeGreaterThanOrEqual(0);
        expect(player.bowlRating).toBeLessThanOrEqual(99);
      }
    }
  });
});
