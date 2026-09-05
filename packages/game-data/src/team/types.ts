export type CricketFormat = 'ODI' | 'T20';

export type PlayerRole = 'BAT' | 'BOWL' | 'ALLROUNDER' | 'WK';

export interface HistoricalTeamReference {
  readonly tournamentId: string;
  readonly year: number;
  readonly format: CricketFormat;
  readonly teamName: string;
  readonly displayName: string;
}

export interface PlayerCard {
  readonly playerId: string;
  readonly cardId: string;
  readonly playerName: string;
  readonly format: CricketFormat;
  readonly tournamentId: string;
  readonly year: number;
  readonly teamName: string;
  readonly role: PlayerRole;
  readonly wicketkeeper: boolean;
  readonly participated: boolean;
  readonly batRating: number | null;
  readonly bowlRating: number | null;
  readonly ratingVersion?: string;
}

export interface RollConfig {
  readonly numberOfTeams: number;
  readonly allowDuplicateHistoricalTeam: boolean;
  readonly allowDuplicatePlayerAcrossRolls: boolean;
}

export interface BowlingOption {
  readonly playerId: string;
  readonly cardId: string;
  readonly playerName: string;
  readonly bowlRating: number | null;
  readonly role: PlayerRole;
  readonly isSpecialist: boolean;
}

export interface XIFormation {
  readonly topOrder: readonly string[]; // cardIds at batting positions 1-2
  readonly middleOrder: readonly string[]; // cardIds at batting positions 3-5
  readonly lowerOrder: readonly string[]; // cardIds at batting positions 6-7
  readonly tail: readonly string[]; // cardIds at batting positions 8-11
  readonly wicketkeepers: readonly string[]; // cardIds
  readonly bowlingOptions: readonly string[]; // cardIds
  readonly specialistBowlers: readonly string[]; // cardIds
  readonly allRounders: readonly string[]; // cardIds
}

export interface ValidationCheckCount {
  readonly valid: boolean;
  readonly actual: number;
  readonly required: number;
}

export interface ValidationCheckSimple {
  readonly valid: boolean;
  readonly count?: number;
  readonly required?: number;
  readonly captainId?: string | null;
  readonly length?: number;
}

export interface XIValidationResult {
  readonly valid: boolean;
  readonly checks: {
    readonly playerCount: ValidationCheckCount;
    readonly wicketkeeper: {
      readonly valid: boolean;
      readonly count: number;
      readonly required: number;
    };
    readonly bowlingOptions: ValidationCheckCount;
    readonly topOrder: ValidationCheckCount;
    readonly duplicatePlayers: { readonly valid: boolean };
    readonly captain: { readonly valid: boolean; readonly captainId: string | null };
    readonly battingOrder: { readonly valid: boolean; readonly length: number };
  };
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

export interface MaidenTeam {
  readonly teamId: string;
  readonly name: string;
  readonly format: CricketFormat;
  readonly players: readonly PlayerCard[];
  readonly captainId: string;
  readonly battingOrder: readonly string[]; // cardIds in order 1..11
  readonly bowlingOptions: readonly string[]; // cardIds
  readonly formation: XIFormation;
  readonly validation: XIValidationResult;
}

export type GameStatus = 'ROLL_PENDING' | 'DRAFTING' | 'XI_IN_PROGRESS' | 'READY' | 'LOCKED';

export interface MaidenGameState {
  readonly schemaVersion: number;
  readonly gameId: string;
  readonly format: CricketFormat;
  readonly seed: number;
  readonly rollConfig: RollConfig;
  readonly rolledTeams: readonly HistoricalTeamReference[];
  readonly availablePool: readonly PlayerCard[];
  readonly selectedPlayerIds: readonly string[]; // cardIds
  readonly captainId: string | null; // cardId
  readonly battingOrder: readonly string[]; // cardIds in 1..11 order
  readonly status: GameStatus;
}
