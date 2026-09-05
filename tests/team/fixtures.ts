/**
 * Explicit test fixtures for team building tests (§71).
 *
 * Clearly labeled as TEST FIXTURES — not canonical records.
 */
import type { HistoricalTeamReference, PlayerCard } from '../../team/types.js';

export const testRolledTeams: HistoricalTeamReference[] = [
  {
    tournamentId: 'ODI_WC_2011',
    year: 2011,
    format: 'ODI',
    teamName: 'India',
    displayName: 'India 2011',
  },
  {
    tournamentId: 'ODI_WC_2007',
    year: 2007,
    format: 'ODI',
    teamName: 'Australia',
    displayName: 'Australia 2007',
  },
  {
    tournamentId: 'ODI_WC_1999',
    year: 1999,
    format: 'ODI',
    teamName: 'Pakistan',
    displayName: 'Pakistan 1999',
  },
];

export function createTestPlayerCard(
  partial: Partial<PlayerCard> & { playerId: string; cardId: string; playerName: string },
): PlayerCard {
  return {
    format: 'ODI',
    tournamentId: 'ODI_WC_2011',
    year: 2011,
    teamName: 'India',
    role: 'BAT',
    wicketkeeper: false,
    participated: true,
    batRating: 85,
    bowlRating: null,
    ratingVersion: 'v1',
    ...partial,
  };
}

/**
 * Creates a valid, balanced test XI satisfying all hard constraints:
 * - Exactly 11 players
 * - 1 wicketkeeper (Dhoni)
 * - 6 bowling options (Zaheer, Harbhajan, Munaf, Yuvraj, Watson, McGrath)
 * - 3 top order capable (Tendulkar, Sehwag, Ponting)
 * - Unique canonical player IDs
 */
export function createValidTestXI(): PlayerCard[] {
  return [
    createTestPlayerCard({
      playerId: 'virender_sehwag',
      cardId: 'virender_sehwag__ODI_WC_2011',
      playerName: 'Virender Sehwag',
      role: 'BAT',
      batRating: 88,
      bowlRating: null,
    }),
    createTestPlayerCard({
      playerId: 'sachin_tendulkar',
      cardId: 'sachin_tendulkar__ODI_WC_2011',
      playerName: 'Sachin Tendulkar',
      role: 'BAT',
      batRating: 95,
      bowlRating: 42,
    }),
    createTestPlayerCard({
      playerId: 'ricky_ponting',
      cardId: 'ricky_ponting__ODI_WC_2007',
      playerName: 'Ricky Ponting',
      year: 2007,
      tournamentId: 'ODI_WC_2007',
      teamName: 'Australia',
      role: 'BAT',
      batRating: 92,
      bowlRating: null,
    }),
    createTestPlayerCard({
      playerId: 'yuvraj_singh',
      cardId: 'yuvraj_singh__ODI_WC_2011',
      playerName: 'Yuvraj Singh',
      role: 'ALLROUNDER',
      batRating: 86,
      bowlRating: 78,
    }),
    createTestPlayerCard({
      playerId: 'ms_dhoni',
      cardId: 'ms_dhoni__ODI_WC_2011',
      playerName: 'MS Dhoni',
      role: 'WK',
      wicketkeeper: true,
      batRating: 89,
      bowlRating: null,
    }),
    createTestPlayerCard({
      playerId: 'shane_watson',
      cardId: 'shane_watson__ODI_WC_2007',
      playerName: 'Shane Watson',
      year: 2007,
      tournamentId: 'ODI_WC_2007',
      teamName: 'Australia',
      role: 'ALLROUNDER',
      batRating: 80,
      bowlRating: 82,
    }),
    createTestPlayerCard({
      playerId: 'harbhajan_singh',
      cardId: 'harbhajan_singh__ODI_WC_2011',
      playerName: 'Harbhajan Singh',
      role: 'BOWL',
      batRating: 35,
      bowlRating: 84,
    }),
    createTestPlayerCard({
      playerId: 'zaheer_khan',
      cardId: 'zaheer_khan__ODI_WC_2011',
      playerName: 'Zaheer Khan',
      role: 'BOWL',
      batRating: 25,
      bowlRating: 89,
    }),
    createTestPlayerCard({
      playerId: 'glenn_mcgrath',
      cardId: 'glenn_mcgrath__ODI_WC_2007',
      playerName: 'Glenn McGrath',
      year: 2007,
      tournamentId: 'ODI_WC_2007',
      teamName: 'Australia',
      role: 'BOWL',
      batRating: 15,
      bowlRating: 94,
    }),
    createTestPlayerCard({
      playerId: 'munaf_patel',
      cardId: 'munaf_patel__ODI_WC_2011',
      playerName: 'Munaf Patel',
      role: 'BOWL',
      batRating: 18,
      bowlRating: 81,
    }),
    createTestPlayerCard({
      playerId: 'shoaib_akhtar',
      cardId: 'shoaib_akhtar__ODI_WC_1999',
      playerName: 'Shoaib Akhtar',
      year: 1999,
      tournamentId: 'ODI_WC_1999',
      teamName: 'Pakistan',
      role: 'BOWL',
      batRating: 20,
      bowlRating: 91,
    }),
  ];
}
