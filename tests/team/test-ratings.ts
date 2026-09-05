import { describe, expect, it } from 'vitest';
import { resolveCardRating } from '../../team/ratings.js';
import { buildPlayerPool } from '../../team/squadBuilder.js';
import type { HistoricalTeamReference } from '../../team/types.js';

/**
 * Regression tests for the squad-name -> Phase 5 rating bridge (§18/§95).
 *
 * The curated squads store full names ("Steve Smith") while ratings_v1.json stores
 * scorecard names ("SPD Smith"); the resolver matches within the (tournament, team)
 * group by surname + first initial. These tests lock in that a real modern squad
 * actually attaches ratings, rather than silently falling back to role defaults.
 */
describe('rating linkage (squad name -> Phase 5 rating)', () => {
  it('resolves scorecard-style rating names from full squad names', () => {
    // "David Warner" (squad) must resolve to "DA Warner" (ratings) for Australia 2019.
    const r = resolveCardRating('ODI_WC_2019', 'Australia', 'David Warner');
    expect(r).not.toBeNull();
    expect(typeof r!.batRating === 'number' || r!.batRating === null).toBe(true);
    // Warner is a specialist batter with a real Phase 5 rating.
    expect(r!.batRating).toBeGreaterThan(0);
  });

  it('attaches non-null ratings to most of a rated modern squad', () => {
    const rolled: HistoricalTeamReference[] = [
      {
        tournamentId: 'ODI_WC_2019',
        year: 2019,
        format: 'ODI',
        teamName: 'Australia',
        displayName: 'Australia 2019',
      },
    ];
    const pool = buildPlayerPool(rolled);
    expect(pool.length).toBeGreaterThanOrEqual(11);
    const rated = pool.filter((c) => c.batRating !== null || c.bowlRating !== null);
    // Before the fix this was 0; the modern squad should now be almost fully rated.
    expect(rated.length).toBeGreaterThanOrEqual(Math.ceil(pool.length * 0.7));
  });

  it('returns null for an unknown team group (falls back to role ratings)', () => {
    expect(resolveCardRating('ODI_WC_2019', 'Atlantis', 'Nobody Here')).toBeNull();
  });
});
