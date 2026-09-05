import fs from 'node:fs';
import path from 'node:path';

/**
 * Rating attachment for historical player cards (Phase 8 §18/§95, Phase 9 §14–§17).
 *
 * The curated World Cup squads (Wikipedia-sourced) store full display names
 * ("David Warner"), while the Phase 5 ratings (`ratings_v1.json`, Cricsheet-sourced)
 * store scorecard-style names ("DA Warner"). A naive name-slug join therefore fails
 * for almost every modern player even though the rating exists.
 *
 * This module bridges the two by resolving within a single `(tournamentId, team)`
 * group — a small, bounded set (~15 players) where a surname + first-initial match is
 * unambiguous. Measured coverage: ~98% of squad cards link to a rating row and every
 * available non-null rating is recovered (older pre-~2000 editions have no ball-by-ball
 * data and remain genuinely unrated).
 */

export interface CardRating {
  readonly batRating: number | null;
  readonly bowlRating: number | null;
}

interface RatingRow {
  readonly surname: string;
  readonly firstInitial: string;
  readonly slug: string;
  readonly batRating: number | null;
  readonly bowlRating: number | null;
}

interface RawRatingEntry {
  player: string;
  team: string;
  tournamentId: string;
  batRating: number | null;
  bowlRating: number | null;
}

/** Lowercased ASCII tokens of a name, punctuation stripped. */
function tokenize(name: string): string[] {
  const clean = name
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[.'`]/g, ' ');
  return clean.split(/[^a-z0-9]+/).filter((t) => t.length > 0);
}

function groupKey(tournamentId: string, team: string): string {
  return `${tournamentId}||${team.toLowerCase()}`;
}

let cachedIndex: Map<string, RatingRow[]> | null = null;

function findRatingsFile(): string | null {
  let curr = process.cwd();
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(curr, 'data', 'processed', 'ratings_v1.json');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(curr);
    if (parent === curr) break;
    curr = parent;
  }
  return null;
}

function loadIndex(): Map<string, RatingRow[]> {
  if (cachedIndex) return cachedIndex;
  const index = new Map<string, RatingRow[]>();
  const file = findRatingsFile();
  if (file) {
    try {
      const rows: RawRatingEntry[] = JSON.parse(fs.readFileSync(file, 'utf-8'));
      for (const r of rows) {
        const toks = tokenize(r.player);
        if (toks.length === 0) continue;
        const surname = toks[toks.length - 1]!;
        const firstInitial = toks[0]![0]!;
        const row: RatingRow = {
          surname,
          firstInitial,
          slug: toks.join('_'),
          batRating: r.batRating,
          bowlRating: r.bowlRating,
        };
        const key = groupKey(r.tournamentId, r.team);
        const bucket = index.get(key);
        if (bucket) bucket.push(row);
        else index.set(key, [row]);
      }
    } catch {
      // Corrupt or missing ratings file: resolver returns null (role fallbacks apply).
    }
  }
  cachedIndex = index;
  return index;
}

/**
 * Resolves the Phase 5 rating for a squad player within its `(tournamentId, team)`
 * group. Returns null when no confident match exists, in which case callers fall back
 * to role-based ratings.
 *
 * Match precedence (within the team group only, so ambiguity is minimal):
 *   1. Exact normalized-name (slug) match.
 *   2. Surname + first-initial, uniquely.
 *   3. Surname alone, uniquely.
 */
export function resolveCardRating(
  tournamentId: string,
  team: string,
  playerName: string,
): CardRating | null {
  const group = loadIndex().get(groupKey(tournamentId, team));
  if (!group || group.length === 0) return null;

  const toks = tokenize(playerName);
  if (toks.length === 0) return null;
  const surname = toks[toks.length - 1]!;
  const firstInitial = toks[0]![0]!;
  const slug = toks.join('_');

  const exact = group.find((r) => r.slug === slug);
  if (exact) return { batRating: exact.batRating, bowlRating: exact.bowlRating };

  const bySurnameInitial = group.filter(
    (r) => r.surname === surname && r.firstInitial === firstInitial,
  );
  if (bySurnameInitial.length === 1) {
    const r = bySurnameInitial[0]!;
    return { batRating: r.batRating, bowlRating: r.bowlRating };
  }

  const bySurname = group.filter((r) => r.surname === surname);
  if (bySurname.length === 1) {
    const r = bySurname[0]!;
    return { batRating: r.batRating, bowlRating: r.bowlRating };
  }

  return null;
}

/** Test/tooling helper to reset the memoized index (e.g. when the data file changes). */
export function resetRatingsIndex(): void {
  cachedIndex = null;
}
