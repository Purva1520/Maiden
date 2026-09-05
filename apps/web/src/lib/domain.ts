/**
 * Domain type re-exports for the UI. These are `type`-only imports (erased at
 * build time), so no Node-only domain code enters the browser bundle — the UI
 * shares the exact Phase 8/9 contracts without duplicating them (§48, §49).
 */
export type {
  CricketFormat,
  PlayerCard,
  PlayerRole,
  HistoricalTeamReference,
  RollConfig,
  MaidenGameState,
  MaidenTeam,
  XIValidationResult,
  XIFormation,
  BowlingOption,
  GameStatus,
} from '@maiden/game-data';

export type {
  CampaignState,
  CampaignResult,
  CampaignMatchRecord,
  CampaignOpponent,
  Fixture,
  Standings,
  Standing,
  CampaignAchievement,
  CampaignAchievementsResult,
} from '@maiden/game-data';

export type {
  MatchResult,
  InningsResult,
  BatterScore,
  BowlerScore,
  FallOfWicket,
  MatchEvent,
  MatchResultDetail,
  DeliveryOutcome,
} from '@maiden/simulator';

/** Narrowed shape of a DELIVERY event (not exported from the simulator barrel). */
export interface DeliveryEventView {
  type: 'DELIVERY';
  inningsNumber: number;
  over: number;
  ball: number;
  batter: string;
  bowler: string;
  outcome: import('@maiden/simulator').DeliveryOutcome;
  runs: number;
  scoreAfter: string;
}
