/**
 * TEST FIXTURE teams for the CLI and tests.
 *
 * !!! THESE RATINGS ARE TEST FIXTURES — NOT Maiden historical ratings. !!!
 * They are invented purely to exercise the engine and must never be treated as,
 * or committed as, Phase 5 Maiden ratings (§64).
 */
import type { PlayerContext, Team } from './models/player.js';

function p(
  id: string,
  name: string,
  batRating: number,
  bowlRating: number | null,
  batStyle?: PlayerContext['batStyle'],
): PlayerContext {
  return batStyle
    ? { id, name, batRating, bowlRating, batStyle }
    : { id, name, batRating, bowlRating };
}

export const indiaXI: Team = {
  id: 'IND_FIXTURE',
  name: 'India XI',
  players: [
    p('ind1', 'R Sharma', 88, null, 'AGGRESSOR'),
    p('ind2', 'S Gill', 82, null),
    p('ind3', 'V Kohli', 90, null, 'ANCHOR'),
    p('ind4', 'S Iyer', 84, 45),
    p('ind5', 'KL Rahul', 83, null),
    p('ind6', 'H Pandya', 78, 82, 'AGGRESSOR'),
    p('ind7', 'R Jadeja', 74, 84),
    p('ind8', 'K Yadav', 42, 86),
    p('ind9', 'M Shami', 34, 88),
    p('ind10', 'J Bumrah', 24, 90),
    p('ind11', 'Mohammed Siraj', 20, 85),
  ],
};

export const australiaXI: Team = {
  id: 'AUS_FIXTURE',
  name: 'Australia XI',
  players: [
    p('aus1', 'D Warner', 86, null, 'AGGRESSOR'),
    p('aus2', 'T Head', 85, 40, 'AGGRESSOR'),
    p('aus3', 'M Marsh', 80, 74),
    p('aus4', 'S Smith', 89, null, 'ANCHOR'),
    p('aus5', 'M Labuschagne', 82, 55),
    p('aus6', 'G Maxwell', 79, 78, 'AGGRESSOR'),
    p('aus7', 'A Carey', 75, null),
    p('aus8', 'P Cummins', 44, 87),
    p('aus9', 'M Starc', 40, 88),
    p('aus10', 'A Zampa', 30, 85),
    p('aus11', 'J Hazlewood', 22, 86),
  ],
};
