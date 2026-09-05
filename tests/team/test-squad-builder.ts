import { describe, expect, it } from 'vitest';
import {
  buildPlayerPool,
  removePlayer,
  replacePlayer,
  selectPlayer,
} from '../../team/squadBuilder.js';
import type { HistoricalTeamReference, PlayerCard } from '../../team/types.js';
import { createTestPlayerCard } from './fixtures.js';

describe('Player Pool & Squad Selection (§15–§21, §73, §74, §96)', () => {
  const rolledTeams: HistoricalTeamReference[] = [
    {
      tournamentId: 'ODI_WC_2011',
      year: 2011,
      format: 'ODI',
      teamName: 'India',
      displayName: 'India 2011',
    },
    {
      tournamentId: 'ODI_WC_2003',
      year: 2003,
      format: 'ODI',
      teamName: 'India',
      displayName: 'India 2003',
    },
    {
      tournamentId: 'ODI_WC_2007',
      year: 2007,
      format: 'ODI',
      teamName: 'Australia',
      displayName: 'Australia 2007',
    },
  ];

  it('generates an available player pool preserving distinct cards across tournaments', () => {
    const pool = buildPlayerPool(rolledTeams);
    expect(pool.length).toBeGreaterThan(30);

    // Tendulkar appears in both India 2003 and India 2011
    const tendulkarCards = pool.filter((c) => c.playerId === 'sachin_tendulkar');
    expect(tendulkarCards.length).toBe(2);

    const card2003 = tendulkarCards.find((c) => c.year === 2003);
    const card2011 = tendulkarCards.find((c) => c.year === 2011);
    expect(card2003).toBeDefined();
    expect(card2011).toBeDefined();
    expect(card2003!.cardId).toBe('sachin_tendulkar__ODI_WC_2003');
    expect(card2011!.cardId).toBe('sachin_tendulkar__ODI_WC_2011');
  });

  it('selects a valid player from the pool', () => {
    const pool = buildPlayerPool(rolledTeams);
    const first = pool[0]!;

    const selected = selectPlayer([], pool, first.cardId);
    expect(selected).toHaveLength(1);
    expect(selected[0]!.cardId).toBe(first.cardId);
  });

  it('rejects selecting the same card twice', () => {
    const pool = buildPlayerPool(rolledTeams);
    const card = pool[0]!;
    const selected = selectPlayer([], pool, card.cardId);

    expect(() => selectPlayer(selected, pool, card.cardId)).toThrow(/PLAYER_ALREADY_SELECTED/);
  });

  it('rejects selecting two cards representing the same canonical person', () => {
    const card2003 = createTestPlayerCard({
      playerId: 'sachin_tendulkar',
      cardId: 'sachin_tendulkar__ODI_WC_2003',
      playerName: 'Sachin Tendulkar',
      year: 2003,
      tournamentId: 'ODI_WC_2003',
    });
    const card2011 = createTestPlayerCard({
      playerId: 'sachin_tendulkar',
      cardId: 'sachin_tendulkar__ODI_WC_2011',
      playerName: 'Sachin Tendulkar',
      year: 2011,
      tournamentId: 'ODI_WC_2011',
    });

    const pool: PlayerCard[] = [card2003, card2011];
    const selected = selectPlayer([], pool, card2003.cardId);

    expect(() => selectPlayer(selected, pool, card2011.cardId)).toThrow(/DUPLICATE_PLAYER/);
  });

  it('removes a selected player cleanly without mutating the pool', () => {
    const card = createTestPlayerCard({
      playerId: 'ms_dhoni',
      cardId: 'ms_dhoni__ODI_WC_2011',
      playerName: 'MS Dhoni',
    });
    const pool = [card];
    const selected = selectPlayer([], pool, card.cardId);
    expect(selected).toHaveLength(1);

    const afterRemove = removePlayer(selected, card.cardId);
    expect(afterRemove).toHaveLength(0);
  });

  it('replaces a player atomically and checks canonical identity', () => {
    const cardA = createTestPlayerCard({
      playerId: 'player_a',
      cardId: 'player_a__ODI_WC_2011',
      playerName: 'Player A',
    });
    const cardB = createTestPlayerCard({
      playerId: 'player_b',
      cardId: 'player_b__ODI_WC_2011',
      playerName: 'Player B',
    });
    const pool = [cardA, cardB];

    const selected = selectPlayer([], pool, cardA.cardId);
    const replaced = replacePlayer(selected, pool, cardA.cardId, cardB.cardId);

    expect(replaced).toHaveLength(1);
    expect(replaced[0]!.cardId).toBe(cardB.cardId);
  });
});
