import { SeededRandom } from '@maiden/simulator';
import { loadWorldCupData, slugifyPlayerName } from '../team/squadBuilder.js';
import { isBowlingOption, isTopOrderCapable } from '../team/bowlingOptions.js';
import { createDefaultBattingOrder } from '../team/battingOrder.js';
import { toSimulatorTeam } from '../team/adapter.js';
import { validateXI } from '../team/xiValidator.js';
import { BASE_TEAM_RULES } from '../team/rules.js';
import type { CricketFormat, MaidenTeam, PlayerCard, PlayerRole } from '../team/types.js';
import type { CampaignOpponent } from './types.js';
import { InvalidOpponentError } from './rules.js';
import { buildFormation } from '../team/formation.js';

/**
 * Builds an automatic, balanced, and legal Playing XI from a historical tournament squad (§14–§17).
 *
 * Algorithm:
 * 1. Requires exactly 11 players.
 * 2. Selects 1 primary Wicketkeeper (metadata `wicketkeeper === true`).
 * 3. Selects 3-4 specialist batters (`role === 'BAT'`).
 * 4. Selects 3-4 specialist bowlers (`role === 'BOWL'`).
 * 5. Selects 2-3 all-rounders (`role === 'ALLROUNDER'`).
 * 6. Ensures ≥ 5 bowling options and ≥ 2 top-order capable.
 * 7. Deduplicates by canonical `playerId`.
 * 8. Creates cricket-sensible batting order (1–11).
 * 9. Adapts to simulation-ready Team.
 */
export function buildOpponentXI(
  candidateCards: readonly PlayerCard[],
  teamName: string,
  year: number,
  format: CricketFormat,
): { simulatorTeam: import('@maiden/simulator').Team; roster: readonly PlayerCard[] } {
  const selected: PlayerCard[] = [];
  const selectedCanonical = new Set<string>();

  const canAdd = (p: PlayerCard) => !selectedCanonical.has(p.playerId);
  const add = (p: PlayerCard) => {
    selected.push(p);
    selectedCanonical.add(p.playerId);
  };

  // 1. Pick 1 Wicketkeeper
  const wk = candidateCards.find((p) => p.wicketkeeper && canAdd(p));
  if (wk) {
    add(wk);
  }

  // 2. Pick top-order specialist batters (target 3)
  const topOrderBats = candidateCards.filter((p) => p.role === 'BAT' && canAdd(p));
  for (const b of topOrderBats) {
    if (selected.filter((p) => isTopOrderCapable(p)).length >= 3) break;
    add(b);
  }

  // 3. Pick specialist bowlers (target 4)
  const bowlers = candidateCards.filter((p) => p.role === 'BOWL' && canAdd(p));
  for (const b of bowlers) {
    if (selected.filter((p) => p.role === 'BOWL').length >= 4) break;
    add(b);
  }

  // 4. Pick all-rounders (target 2)
  const allrounders = candidateCards.filter((p) => p.role === 'ALLROUNDER' && canAdd(p));
  for (const a of allrounders) {
    if (selected.filter((p) => p.role === 'ALLROUNDER').length >= 2) break;
    add(a);
  }

  // 5. Fill remaining slots to reach 11 players, ensuring >= 5 bowling options
  for (const p of candidateCards) {
    if (selected.length >= 11) break;
    if (!canAdd(p)) continue;

    const bowlingCount = selected.filter((s) => isBowlingOption(s)).length;
    if (bowlingCount < 5 && !isBowlingOption(p)) {
      continue;
    }
    add(p);
  }

  // If still fewer than 11, add any remaining available players
  if (selected.length < 11) {
    for (const p of candidateCards) {
      if (selected.length >= 11) break;
      if (canAdd(p)) add(p);
    }
  }

  if (selected.length < 11) {
    throw new InvalidOpponentError(
      `Historical squad ${teamName} (${year}) only has ${selected.length} valid unique players; 11 required.`,
    );
  }

  // Batting order
  const battingOrder = createDefaultBattingOrder(selected);
  const captain = selected.find((p) => p.wicketkeeper) || selected[0]!;

  const validation = validateXI(selected, captain.cardId, battingOrder, BASE_TEAM_RULES);
  if (!validation.valid) {
    throw new InvalidOpponentError(
      `Failed to build legal opponent XI for ${teamName} (${year}): ${validation.errors.join('; ')}`,
    );
  }

  const formation = buildFormation(selected, battingOrder);
  const maidenTeam: MaidenTeam = {
    teamId: `opp_${slugifyPlayerName(teamName)}_${year}`,
    name: `${teamName} ${year}`,
    format,
    players: selected,
    captainId: captain.cardId,
    battingOrder,
    bowlingOptions: selected.filter(isBowlingOption).map((p) => p.cardId),
    formation,
    validation,
  };

  const simulatorTeam = toSimulatorTeam(maidenTeam);

  return {
    simulatorTeam,
    roster: selected,
  };
}

/**
 * Generates a diverse, deterministic list of historical opponents for a campaign (§12–§19, §83, §84).
 */
export function generateHistoricalOpponents(
  format: CricketFormat,
  seed: number,
  count: number,
  excludeTournTeams: ReadonlySet<string> = new Set(),
): CampaignOpponent[] {
  const { squads, teams, tournaments } = loadWorldCupData();
  const tournMap = new Map(tournaments.map((t) => [t.tournament_id, t]));

  // Find all available teams for this format
  interface CandidateTeam {
    tournamentId: string;
    teamName: string;
    year: number;
    key: string;
  }

  const candidateTeams: CandidateTeam[] = [];
  for (const t of teams) {
    const tourn = tournMap.get(t.tournament_id);
    if (!tourn) continue;
    if (tourn.format !== format) continue;

    const key = `${t.tournament_id}___${t.team_name.toLowerCase()}`;
    if (excludeTournTeams.has(key)) continue;

    candidateTeams.push({
      tournamentId: t.tournament_id,
      teamName: t.team_name,
      year: tourn.year,
      key,
    });
  }

  // Deterministic sort before shuffle
  candidateTeams.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.teamName.localeCompare(b.teamName);
  });

  const rng = new SeededRandom(seed);
  // Fisher-Yates shuffle
  const shuffled = [...candidateTeams];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    const tmp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = tmp;
  }

  const opponents: CampaignOpponent[] = [];
  const chosenKeys = new Set<string>();

  for (const c of shuffled) {
    if (opponents.length >= count) break;
    if (chosenKeys.has(c.key)) continue;

    // Filter squad for this team
    const rawSquad = squads.filter(
      (s) =>
        s.tournament_id === c.tournamentId && s.team.toLowerCase() === c.teamName.toLowerCase(),
    );
    if (rawSquad.length < 11) continue;

    const cards: PlayerCard[] = rawSquad.map((s) => {
      const playerId = slugifyPlayerName(s.player);
      const cardId = `${playerId}__${s.tournament_id}`;
      return {
        playerId,
        cardId,
        playerName: s.player,
        format,
        tournamentId: s.tournament_id,
        year: s.year,
        teamName: s.team,
        role: (s.role.toUpperCase() as PlayerRole) || 'BAT',
        wicketkeeper: Boolean(s.wicketkeeper),
        participated: Boolean(s.participated),
        batRating: null,
        bowlRating: null,
        ratingVersion: 'v1',
      };
    });

    try {
      const { simulatorTeam, roster } = buildOpponentXI(cards, c.teamName, c.year, format);
      const oppId = `opp_${slugifyPlayerName(c.teamName)}_${c.year}`;

      opponents.push({
        opponentId: oppId,
        historicalTeamId: c.teamName,
        historicalTournamentId: c.tournamentId,
        year: c.year,
        format,
        displayName: `${c.teamName} ${c.year}`,
        team: simulatorTeam,
        roster,
      });

      chosenKeys.add(c.key);
    } catch {
      // Squad didn't meet legal XI criteria, continue to next candidate
    }
  }

  if (opponents.length < count) {
    throw new InvalidOpponentError(
      `Could only generate ${opponents.length} valid historical opponents; ${count} required.`,
    );
  }

  return opponents;
}
