import type {
  CampaignAchievement,
  CampaignAchievementsResult,
  CampaignMatchRecord,
  FormatCampaignRules,
  ThrashingConfig,
} from './types.js';

/**
 * Checks whether a single victory satisfies Maiden's "thrashing" rule (§46–§49, §128).
 *
 * Rules:
 * - Win by runs: marginRuns >= configured threshold
 * - Win by wickets: marginWickets >= configured threshold AND ballsRemaining >= configured threshold
 */
export function isMatchThrashing(
  record: Pick<CampaignMatchRecord, 'userWon' | 'marginType' | 'marginValue' | 'ballsRemaining'>,
  config: ThrashingConfig,
): boolean {
  if (!record.userWon) {
    return false;
  }

  if (record.marginType === 'RUNS') {
    return record.marginValue >= config.winByRuns;
  }

  if (record.marginType === 'WICKETS') {
    return (
      record.marginValue >= config.winByWickets && record.ballsRemaining >= config.minBallsRemaining
    );
  }

  return false;
}

/**
 * Pure evaluation of campaign achievements based on completed user matches (§43–§51, §95–§97, §126–§131).
 *
 * Definitions:
 * 1. Champion: User won the tournament Final.
 * 2. Invincible: User won EVERY campaign match required (all group matches + semifinal + final).
 *    A single loss or tie breaks Invincible.
 * 3. Golden Invincible: User is Invincible AND every single victory is a Thrashing.
 *    A single narrow win breaks Golden Invincible.
 */
export function evaluateCampaignAchievements(
  userMatches: readonly CampaignMatchRecord[],
  formatRules: FormatCampaignRules,
  userWonFinal: boolean,
): CampaignAchievementsResult {
  const totalRequiredMatches = formatRules.matchesPerTeam + 2; // 7 group + 1 SF + 1 Final = 9

  // Champion: Won the final
  const champion = userWonFinal;

  // Invincible: Won all required campaign matches without a single loss or tie
  const allMatchesWon =
    userMatches.length >= totalRequiredMatches && userMatches.every((m) => m.userWon === true);
  const invincible = champion && allMatchesWon;

  // Golden Invincible: Invincible AND every victory was a thrashing
  const allThrashed =
    invincible && userMatches.every((m) => isMatchThrashing(m, formatRules.thrashing));
  const goldenInvincible = invincible && allThrashed;

  const achievements: CampaignAchievement[] = [
    {
      id: 'champion',
      name: 'World Cup Champion',
      description: 'Won the Maiden World Cup tournament final.',
      unlocked: champion,
    },
    {
      id: 'invincible',
      name: 'Invincible',
      description: 'Won every campaign match from group stage to the final without defeat.',
      unlocked: invincible,
    },
    {
      id: 'golden_invincible',
      name: 'Golden Invincible',
      description: 'Won every campaign match by thrashing the opposition.',
      unlocked: goldenInvincible,
    },
  ];

  return {
    champion,
    invincible,
    goldenInvincible,
    achievements,
  };
}
