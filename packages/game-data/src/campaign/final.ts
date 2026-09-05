import type { CampaignMatchRecord } from './types.js';

/**
 * Resolves the championship outcome from the final match (§42, §43, §71, §72, §95).
 */
export function resolveChampionship(
  finalRecord: CampaignMatchRecord,
  userTeamId: string,
): { championId: string; championName: string; userIsChampion: boolean } {
  const championId = finalRecord.winnerId || finalRecord.homeTeamId;
  const championName = finalRecord.winnerName || finalRecord.homeTeamName;
  const userIsChampion = championId === userTeamId;

  return {
    championId,
    championName,
    userIsChampion,
  };
}
