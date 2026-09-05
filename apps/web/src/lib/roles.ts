/** Centralized role display (§17). The same role system everywhere. */
import type { PlayerRole } from './domain.js';

export const ROLE_LABEL: Record<PlayerRole, string> = {
  BAT: 'Batter',
  BOWL: 'Bowler',
  ALLROUNDER: 'All-rounder',
  WK: 'Wicketkeeper',
};

export const ROLE_SHORT: Record<PlayerRole, string> = {
  BAT: 'BAT',
  BOWL: 'BOWL',
  ALLROUNDER: 'AR',
  WK: 'WK',
};

export function roleLabel(role: PlayerRole): string {
  return ROLE_LABEL[role] ?? role;
}
