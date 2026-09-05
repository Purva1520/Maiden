/**
 * Typed client for the Maiden game API (§48, §52, §53). The browser holds the
 * canonical serializable state and posts it back for each transition; all game
 * rules run server-side in the Phase 8/9 engine.
 */
import type {
  CricketFormat,
  MaidenGameState,
  MaidenTeam,
  XIValidationResult,
  CampaignState,
  PlayerCard,
} from './domain.js';

const BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:3000';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Cannot reach the Maiden server. Is the API running?', 0);
  }
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new ApiError(msg, res.status);
  }
  return (await res.json()) as T;
}

async function get<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`);
  } catch {
    throw new ApiError('Cannot reach the Maiden server. Is the API running?', 0);
  }
  if (!res.ok) throw new ApiError(`Request failed (${res.status})`, res.status);
  return (await res.json()) as T;
}

export interface FormatConfig {
  years: number[];
  editions: number;
  overs: number;
  rules: {
    xiSize: number;
    minWicketkeepers: number;
    minBowlingOptions: number;
    minTopOrder: number;
  };
}
export interface GameConfig {
  formats: Record<CricketFormat, FormatConfig>;
  campaignRules: {
    version: string;
    points: { win: number; tie: number; loss: number };
    ODI: { groupTeams: number; qualifiers: number; matchesPerTeam: number };
    T20: { groupTeams: number; qualifiers: number; matchesPerTeam: number };
  };
}

export const api = {
  getConfig: () => get<GameConfig>('/api/config'),

  createGame: (format: CricketFormat, seed: number) =>
    post<MaidenGameState>('/api/game/create', { format, seed }),
  roll: (state: MaidenGameState) => post<MaidenGameState>('/api/game/roll', { state }),
  select: (state: MaidenGameState, cardId: string) =>
    post<MaidenGameState>('/api/game/select', { state, cardId }),
  remove: (state: MaidenGameState, cardId: string) =>
    post<MaidenGameState>('/api/game/remove', { state, cardId }),
  replace: (state: MaidenGameState, outCardId: string, inCardId: string) =>
    post<MaidenGameState>('/api/game/replace', { state, outCardId, inCardId }),
  setCaptain: (state: MaidenGameState, cardId: string) =>
    post<MaidenGameState>('/api/game/captain', { state, cardId }),
  setBattingOrder: (state: MaidenGameState, order: string[]) =>
    post<MaidenGameState>('/api/game/batting-order', { state, order }),
  validate: (state: MaidenGameState) => post<XIValidationResult>('/api/game/validate', { state }),
  finalize: (state: MaidenGameState, teamName: string) =>
    post<{ state: MaidenGameState; team: MaidenTeam }>('/api/game/finalize', { state, teamName }),

  createCampaign: (team: MaidenTeam, format: CricketFormat, seed: number) =>
    post<CampaignState>('/api/campaign/create', { team, format, seed }),
  startCampaign: (state: CampaignState) => post<CampaignState>('/api/campaign/start', { state }),
  playNext: (state: CampaignState) => post<CampaignState>('/api/campaign/play-next', { state }),
};

export type { PlayerCard };
