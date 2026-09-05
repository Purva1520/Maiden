/**
 * Historical identity & rarity for presentation (§41–§46). Pure, presentation
 * only — nothing here changes ratings, selection legality, or match outcomes.
 */
import type { CricketFormat, PlayerCard } from '../../lib/domain.js';

export interface BadgeInfo {
  competition: string;
  year: number;
  format: CricketFormat;
}

export function badgeInfo(format: CricketFormat, year: number): BadgeInfo {
  return {
    competition: format === 'T20' ? 'T20 World Cup' : 'World Cup',
    year,
    format,
  };
}

export type Rarity = 'STANDARD' | 'LEGEND';

/**
 * Phase 11 **presentation-only** rarity classification (§44, §46).
 *
 * The Phase 5/8 data models carry no `legend` attribute, so rarity is a documented
 * visual tier — NOT a hidden rating boost and NOT used by any gameplay rule. A card
 * reads as LEGEND when its Phase 5 peak skill is elite; the thresholds below are the
 * documented rule. Changing them changes nothing but the border/badge treatment.
 */
export const LEGEND_BAT_THRESHOLD = 90;
export const LEGEND_BOWL_THRESHOLD = 88;

export function rarity(player: Pick<PlayerCard, 'batRating' | 'bowlRating'>): Rarity {
  const bat = player.batRating ?? 0;
  const bowl = player.bowlRating ?? 0;
  return bat >= LEGEND_BAT_THRESHOLD || bowl >= LEGEND_BOWL_THRESHOLD ? 'LEGEND' : 'STANDARD';
}

export function isLegend(player: Pick<PlayerCard, 'batRating' | 'bowlRating'>): boolean {
  return rarity(player) === 'LEGEND';
}
