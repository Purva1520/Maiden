import fs from 'node:fs';
import path from 'node:path';
import { SeededRandom } from '@maiden/simulator';
import { resolveCardRating } from './ratings.js';
import type {
  CricketFormat,
  HistoricalTeamReference,
  PlayerCard,
  PlayerRole,
  RollConfig,
} from './types.js';

export const ODI_YEARS: readonly number[] = [
  1975, 1979, 1983, 1987, 1992, 1996, 1999, 2003, 2007, 2011, 2015, 2019, 2023,
];

export const T20_YEARS: readonly number[] = [2007, 2009, 2010, 2012, 2014, 2016, 2021, 2022, 2024];

export const DEFAULT_ROLL_CONFIG: RollConfig = {
  numberOfTeams: 3,
  allowDuplicateHistoricalTeam: false,
  allowDuplicatePlayerAcrossRolls: true,
};

export function slugifyPlayerName(name: string): string {
  const clean = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’`]/g, '')
    .toLowerCase();
  const slug = clean.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return slug || 'player';
}

interface RawSquadEntry {
  tournament_id: string;
  year: number;
  format: string;
  team: string;
  player: string;
  role: string;
  wicketkeeper: boolean;
  participated: boolean;
  squad_order?: number;
}

interface RawTeamEntry {
  tournament_id: string;
  team_name: string;
}

interface RawTournamentEntry {
  tournament_id: string;
  year: number;
  format: string;
  display_name: string;
}

let cachedSquads: RawSquadEntry[] | null = null;
let cachedTeams: RawTeamEntry[] | null = null;
let cachedTournaments: RawTournamentEntry[] | null = null;

function findProjectRoot(): string {
  let curr = process.cwd();
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(curr, 'data', 'game', 'world_cups', 'curated_squads.json'))) {
      return curr;
    }
    const parent = path.dirname(curr);
    if (parent === curr) break;
    curr = parent;
  }
  return process.cwd();
}

export function loadWorldCupData(): {
  squads: RawSquadEntry[];
  teams: RawTeamEntry[];
  tournaments: RawTournamentEntry[];
} {
  if (cachedSquads && cachedTeams && cachedTournaments) {
    return {
      squads: cachedSquads,
      teams: cachedTeams,
      tournaments: cachedTournaments,
    };
  }

  const root = findProjectRoot();
  const squadsPath = path.join(root, 'data', 'game', 'world_cups', 'curated_squads.json');
  const teamsPath = path.join(root, 'data', 'game', 'world_cups', 'teams.json');
  const tournamentsPath = path.join(root, 'data', 'game', 'world_cups', 'tournaments.json');

  if (!fs.existsSync(squadsPath)) {
    throw new Error(`Cannot locate curated_squads.json at ${squadsPath}`);
  }

  cachedSquads = JSON.parse(fs.readFileSync(squadsPath, 'utf-8'));
  cachedTeams = JSON.parse(fs.readFileSync(teamsPath, 'utf-8'));
  cachedTournaments = JSON.parse(fs.readFileSync(tournamentsPath, 'utf-8'));

  return {
    squads: cachedSquads!,
    teams: cachedTeams!,
    tournaments: cachedTournaments!,
  };
}

/**
 * Validates that the requested format and year exist in the canonical historical universe.
 */
export function isValidTournamentEdition(format: CricketFormat, year: number): boolean {
  if (format === 'ODI') {
    return ODI_YEARS.includes(year);
  }
  if (format === 'T20') {
    return T20_YEARS.includes(year);
  }
  return false;
}

/**
 * Rolls historical World Cup teams deterministically using a game seed (§8–§14).
 *
 * Rules:
 * 1. Uses SeededRandom (never Math.random).
 * 2. Format is mandatory ('ODI' | 'T20').
 * 3. Does not roll the same historical team/tournament combination twice by default.
 * 4. India 2011 and India 2023 are valid distinct editions.
 */
export function rollHistoricalTeams(
  format: CricketFormat,
  seed: number,
  customConfig?: Partial<RollConfig>,
): HistoricalTeamReference[] {
  if (format !== 'ODI' && format !== 'T20') {
    throw new Error(`Invalid format for roll: ${format} (must be 'ODI' or 'T20')`);
  }

  const config: RollConfig = {
    ...DEFAULT_ROLL_CONFIG,
    ...customConfig,
  };

  const { teams, tournaments } = loadWorldCupData();
  const tournMap = new Map(tournaments.map((t) => [t.tournament_id, t]));

  // Filter candidate teams matching format
  const candidates: HistoricalTeamReference[] = [];
  for (const t of teams) {
    const tourn = tournMap.get(t.tournament_id);
    if (!tourn) continue;
    if (tourn.format !== format) continue;
    if (!isValidTournamentEdition(format, tourn.year)) continue;

    candidates.push({
      tournamentId: t.tournament_id,
      year: tourn.year,
      format,
      teamName: t.team_name,
      displayName: `${t.team_name} ${tourn.year}`,
    });
  }

  // Sort candidates deterministically before random sampling
  candidates.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.teamName.localeCompare(b.teamName);
  });

  if (candidates.length < config.numberOfTeams) {
    throw new Error(
      `Insufficient historical teams in ${format} universe (found ${candidates.length}, need ${config.numberOfTeams})`,
    );
  }

  const rng = new SeededRandom(seed);
  const pool = [...candidates];
  const rolled: HistoricalTeamReference[] = [];

  for (let i = 0; i < config.numberOfTeams; i++) {
    const idx = rng.nextInt(pool.length);
    const selected = pool[idx];
    if (!selected) break;

    rolled.push(selected);

    if (!config.allowDuplicateHistoricalTeam) {
      pool.splice(idx, 1);
    }
  }

  return rolled;
}

/**
 * Builds the combined player pool from rolled historical teams (§15–§19, §55–§58).
 *
 * Rules:
 * 1. Each card identity is `${playerId}__${tournamentId}`.
 * 2. Sachin Tendulkar 2003 and Sachin Tendulkar 2011 produce two distinct cards in pool.
 * 3. All canonical squad members are included (participated flag preserved).
 * 4. Pool is sorted deterministically: year -> teamName -> playerName -> cardId.
 */
export function buildPlayerPool(
  rolledTeams: readonly HistoricalTeamReference[],
  customSquads?: RawSquadEntry[],
): PlayerCard[] {
  const { squads } = loadWorldCupData();
  const allSquads = customSquads ?? squads;

  const targetTeams = new Set(
    rolledTeams.map((t) => `${t.tournamentId}___${t.teamName.toLowerCase()}`),
  );

  const cards: PlayerCard[] = [];

  for (const s of allSquads) {
    const key = `${s.tournament_id}___${s.team.toLowerCase()}`;
    if (!targetTeams.has(key)) {
      continue;
    }

    const playerId = slugifyPlayerName(s.player);
    const cardId = `${playerId}__${s.tournament_id}`;
    const role = (s.role.toUpperCase() as PlayerRole) || 'BAT';

    const rating = resolveCardRating(s.tournament_id, s.team, s.player);
    const batRating = rating?.batRating ?? null;
    const bowlRating = rating?.bowlRating ?? null;

    cards.push({
      playerId,
      cardId,
      playerName: s.player,
      format: s.format as CricketFormat,
      tournamentId: s.tournament_id,
      year: s.year,
      teamName: s.team,
      role,
      wicketkeeper: Boolean(s.wicketkeeper),
      participated: Boolean(s.participated),
      batRating,
      bowlRating,
      ratingVersion: 'v1',
    });
  }

  // Deterministic sort: year -> teamName -> playerName -> cardId
  cards.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    const teamCmp = a.teamName.localeCompare(b.teamName);
    if (teamCmp !== 0) return teamCmp;
    const nameCmp = a.playerName.localeCompare(b.playerName);
    if (nameCmp !== 0) return nameCmp;
    return a.cardId.localeCompare(b.cardId);
  });

  return cards;
}

/**
 * Selects a player card into the playing XI (§20–§21).
 *
 * Enforces:
 * - Card must exist in available pool.
 * - Card must not already be selected.
 * - Canonical real-world player (`playerId`) must not already be selected.
 */
export function selectPlayer(
  selectedCards: readonly PlayerCard[],
  pool: readonly PlayerCard[],
  cardId: string,
): PlayerCard[] {
  const card = pool.find((c) => c.cardId === cardId);
  if (!card) {
    throw new Error(
      `Player card ${cardId} is not available in the drafted pool (PLAYER_NOT_IN_POOL).`,
    );
  }

  if (selectedCards.some((c) => c.cardId === cardId)) {
    throw new Error(
      `Player card ${cardId} is already selected in the playing XI (PLAYER_ALREADY_SELECTED).`,
    );
  }

  if (selectedCards.some((c) => c.playerId === card.playerId)) {
    const existing = selectedCards.find((c) => c.playerId === card.playerId);
    throw new Error(
      `Canonical identity conflict: ${card.playerName} is already selected via ${existing?.cardId} (DUPLICATE_PLAYER).`,
    );
  }

  return [...selectedCards, card];
}

/**
 * Removes a player card from the playing XI (§20).
 */
export function removePlayer(selectedCards: readonly PlayerCard[], cardId: string): PlayerCard[] {
  const next = selectedCards.filter((c) => c.cardId !== cardId);
  if (next.length === selectedCards.length) {
    throw new Error(`Cannot remove player ${cardId}: player is not in selected XI.`);
  }
  return next;
}

/**
 * Atomically replaces one selected player with another from the pool (§51).
 */
export function replacePlayer(
  selectedCards: readonly PlayerCard[],
  pool: readonly PlayerCard[],
  outCardId: string,
  inCardId: string,
): PlayerCard[] {
  if (outCardId === inCardId) {
    return [...selectedCards];
  }
  const filtered = removePlayer(selectedCards, outCardId);
  return selectPlayer(filtered, pool, inCardId);
}
