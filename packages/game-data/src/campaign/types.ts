import type { MatchResult, Team as SimulatorTeam } from '@maiden/simulator';
import type { CricketFormat, MaidenTeam, PlayerCard } from '../team/types.js';

export type FixtureStage = 'GROUP' | 'SEMIFINAL' | 'FINAL';

export type FixtureStatus = 'SCHEDULED' | 'COMPLETED';

export type CampaignStatus =
  'NOT_STARTED' | 'GROUP_STAGE' | 'KNOCKOUT' | 'FINAL' | 'COMPLETED' | 'ELIMINATED';

export interface CampaignOpponent {
  readonly opponentId: string;
  readonly historicalTeamId: string;
  readonly historicalTournamentId: string;
  readonly year: number;
  readonly format: CricketFormat;
  readonly displayName: string;
  readonly team: SimulatorTeam;
  readonly roster: readonly PlayerCard[];
}

export interface ThrashingConfig {
  readonly winByRuns: number;
  readonly winByWickets: number;
  readonly minBallsRemaining: number;
}

export interface FormatCampaignRules {
  readonly groupTeams: number;
  readonly qualifiers: number;
  readonly matchesPerTeam: number;
  readonly thrashing: ThrashingConfig;
}

export interface PointsConfig {
  readonly win: number;
  readonly tie: number;
  readonly loss: number;
}

export interface CampaignRulesConfig {
  readonly version: string;
  readonly points: PointsConfig;
  readonly tieBreakerOrder: readonly string[];
  readonly ODI: FormatCampaignRules;
  readonly T20: FormatCampaignRules;
}

export interface CampaignMatchRecord {
  readonly fixtureId: string;
  readonly stage: FixtureStage;
  readonly matchNumber: number;
  readonly matchSeed: number;
  readonly homeTeamId: string;
  readonly awayTeamId: string;
  readonly homeTeamName: string;
  readonly awayTeamName: string;
  readonly winnerId: string | null; // null on tie
  readonly winnerName: string | null;
  readonly isTie: boolean;
  readonly userInvolved: boolean;
  readonly userWon: boolean;
  readonly homeScore: { readonly runs: number; readonly wickets: number; readonly balls: number };
  readonly awayScore: { readonly runs: number; readonly wickets: number; readonly balls: number };
  readonly userScore?: { readonly runs: number; readonly wickets: number; readonly balls: number };
  readonly opponentScore?: {
    readonly runs: number;
    readonly wickets: number;
    readonly balls: number;
  };
  readonly marginType: 'RUNS' | 'WICKETS' | 'TIE';
  readonly marginValue: number;
  readonly ballsRemaining: number;
  readonly isThrashing: boolean;
  readonly simulationVersion: string;
  readonly configVersion: string;
  readonly fullResult?: MatchResult;
  readonly summaryText: string;
}

export interface Fixture {
  readonly fixtureId: string;
  readonly stage: FixtureStage;
  readonly matchNumber: number;
  readonly round: number;
  readonly homeTeamId: string;
  readonly awayTeamId: string;
  readonly homeTeamName: string;
  readonly awayTeamName: string;
  readonly status: FixtureStatus;
  readonly matchSeed: number;
  readonly isUserMatch: boolean;
  readonly result?: CampaignMatchRecord;
}

export interface Standing {
  readonly teamId: string;
  readonly teamName: string;
  readonly isUser: boolean;
  readonly played: number;
  readonly wins: number;
  readonly losses: number;
  readonly ties: number;
  readonly points: number;
  readonly runsFor: number;
  readonly runsAgainst: number;
  readonly wicketsFor: number;
  readonly wicketsAgainst: number;
  readonly ballsFor: number;
  readonly ballsAgainst: number;
  readonly runDifferential: number;
  readonly qualified: boolean;
  readonly position: number;
}

export interface Standings {
  readonly table: readonly Standing[];
  readonly recalculatedAtFixtureIndex: number;
}

export interface CampaignAchievement {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly unlocked: boolean;
}

export interface CampaignAchievementsResult {
  readonly champion: boolean;
  readonly invincible: boolean;
  readonly goldenInvincible: boolean;
  readonly achievements: readonly CampaignAchievement[];
}

export interface CampaignResult {
  readonly status: 'CHAMPION' | 'ELIMINATED';
  readonly champion: boolean;
  readonly invincible: boolean;
  readonly goldenInvincible: boolean;
  readonly matchesPlayed: number;
  readonly wins: number;
  readonly losses: number;
  readonly ties: number;
  readonly runsScored: number;
  readonly runsConceded: number;
  readonly runDifferential: number;
  readonly wicketsTaken: number;
  readonly wicketsLost: number;
  readonly qualificationStageReached: 'GROUP' | 'SEMIFINAL' | 'FINAL' | 'CHAMPION';
  readonly finalOpponentId?: string;
  readonly finalOpponentName?: string;
  readonly finalMatch?: CampaignMatchRecord;
  readonly achievements: readonly CampaignAchievement[];
  readonly rulesVersion: string;
  readonly completedAt: string;
}

export interface CampaignState {
  readonly schemaVersion: number;
  readonly campaignId: string;
  readonly format: CricketFormat;
  readonly seed: number;
  readonly campaignRulesVersion: string;
  readonly userTeam: MaidenTeam;
  readonly opponents: readonly CampaignOpponent[];
  readonly fixtures: readonly Fixture[];
  readonly currentFixtureIndex: number;
  readonly completedMatches: readonly CampaignMatchRecord[];
  readonly standings: Standings;
  readonly status: CampaignStatus;
  readonly result: CampaignResult | null;
}
