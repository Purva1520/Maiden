/**
 * Teams for calibration and differentiation tests (§41).
 *
 * The environment is calibrated with NEUTRAL flat teams (every batter and bowler
 * the same rating) so the realized distributions reflect the config, not team
 * skill (skill signal s = 0). Tiered teams are used only to check that ratings
 * still matter after calibration (§71).
 */
import type { PlayerContext, Team } from '../models/player.js';

/** A flat XI: 11 identical batters, `nBowlers` of them also bowl. */
export function flatTeam(
  id: string,
  name: string,
  batRating: number,
  bowlRating: number,
  nBowlers = 6,
): Team {
  const players: PlayerContext[] = [];
  for (let i = 0; i < 11; i++) {
    // Make the last nBowlers the bowlers (so the top order does not bowl).
    const isBowler = i >= 11 - nBowlers;
    players.push({
      id: `${id}_${i + 1}`,
      name: `${name} ${i + 1}`,
      batRating,
      bowlRating: isBowler ? bowlRating : null,
    });
  }
  return { id, name, players };
}

/** Neutral 72-rated teams used to tune the environment. */
export const NEUTRAL_A = flatTeam('NEUTRAL_A', 'Neutral A', 72, 72);
export const NEUTRAL_B = flatTeam('NEUTRAL_B', 'Neutral B', 72, 72);

/** Tiered teams for rating-differentiation tests (§71/§72). */
export const TIERS = {
  elite: flatTeam('ELITE', 'Elite', 90, 90),
  strong: flatTeam('STRONG', 'Strong', 80, 80),
  average: flatTeam('AVERAGE', 'Average', 70, 70),
  weak: flatTeam('WEAK', 'Weak', 55, 55),
} as const;
