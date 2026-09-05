#!/usr/bin/env node
/**
 * Maiden Campaign CLI: Complete World Cup Tournament Runner (§58–§62).
 *
 * Usage:
 *   pnpm campaign
 *   npx tsx scripts/campaign.ts --format ODI --seed 42
 *   npx tsx scripts/campaign.ts --format T20 --seed 999
 */
import {
  createCampaign,
  startCampaign,
  playNextMatch,
  validateCampaign,
} from '../campaign/campaign.js';
import type { Standing } from '../campaign/types.js';
import {
  createGame,
  finalizeXI,
  rollTeams,
  selectPlayerInDraft,
  setCaptainInDraft,
} from '../team/gameState.js';
import { isBowlingOption, isTopOrderCapable } from '../team/bowlingOptions.js';
import type { CricketFormat, MaidenTeam, PlayerCard } from '../team/types.js';

function parseArgs(): { format: CricketFormat; seed: number } {
  const args = process.argv.slice(2);
  let format: CricketFormat = 'ODI';
  let seed = 42;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--format' && args[i + 1]) {
      const f = args[i + 1]!.toUpperCase();
      if (f === 'ODI' || f === 'T20') {
        format = f;
      }
      i++;
    } else if (arg === '--seed' && args[i + 1]) {
      const s = parseInt(args[i + 1]!, 10);
      if (!Number.isNaN(s)) {
        seed = s;
      }
      i++;
    }
  }

  return { format, seed };
}

function buildUserTeam(format: CricketFormat, seed: number): MaidenTeam {
  let state = createGame(format, seed);
  state = rollTeams(state);

  const pool = state.availablePool;
  const selected: PlayerCard[] = [];
  const selectedCanonical = new Set<string>();

  const canAdd = (p: PlayerCard) => !selectedCanonical.has(p.playerId);
  const add = (p: PlayerCard) => {
    selected.push(p);
    selectedCanonical.add(p.playerId);
  };

  // 1. Pick 1 Wicketkeeper
  const wk = pool.find((p) => p.wicketkeeper && canAdd(p));
  if (wk) add(wk);

  // 2. Pick at least 5 bowling options
  for (const p of pool.filter((c) => isBowlingOption(c) && canAdd(c))) {
    if (selected.filter((c) => isBowlingOption(c)).length >= 5) break;
    add(p);
  }

  // 3. Pick at least 2 top-order capable players
  for (const p of pool.filter((c) => isTopOrderCapable(c) && canAdd(c))) {
    if (selected.filter((c) => isTopOrderCapable(c)).length >= 2) break;
    add(p);
  }

  // 4. Fill remaining slots up to 11
  for (const p of pool.filter((c) => canAdd(c))) {
    if (selected.length >= 11) break;
    add(p);
  }

  for (const p of selected) {
    state = selectPlayerInDraft(state, p.cardId);
  }

  const captain = selected[0]!;
  state = setCaptainInDraft(state, captain.cardId);

  const { team } = finalizeXI(state, 'Maiden Legends XI');
  return team;
}

function formatScore(
  score: { runs: number; wickets: number; balls: number },
  maxOvers: number,
): string {
  const overs = Math.floor(score.balls / 6);
  const remainingBalls = score.balls % 6;
  const oversStr = remainingBalls > 0 ? `${overs}.${remainingBalls}` : `${overs}`;
  return `${score.runs}/${score.wickets} (${oversStr}/${maxOvers} ov)`;
}

function printStandingsTable(standings: readonly Standing[]): void {
  console.log('\n  Pos  Team                        P   W   L   T  Pts   RunDiff  Status');
  console.log('  -----------------------------------------------------------------------');
  for (const s of standings) {
    const pos = String(s.position).padStart(2);
    const name = (s.isUser ? `★ ${s.teamName}` : `  ${s.teamName}`).padEnd(26);
    const p = String(s.played).padStart(2);
    const w = String(s.wins).padStart(2);
    const l = String(s.losses).padStart(2);
    const t = String(s.ties).padStart(2);
    const pts = String(s.points).padStart(3);
    const diffSign = s.runDifferential > 0 ? `+${s.runDifferential}` : `${s.runDifferential}`;
    const diff = diffSign.padStart(8);
    const status = s.qualified ? 'QUALIFIED' : s.played === 7 ? 'ELIMINATED' : 'In Contention';
    console.log(`  ${pos}  ${name}  ${p}  ${w}  ${l}  ${t}  ${pts}  ${diff}  ${status}`);
  }
}

export function runCampaignCLI(): void {
  const { format, seed } = parseArgs();
  const maxOvers = format === 'ODI' ? 50 : 20;

  console.log('='.repeat(75));
  console.log('        MAIDEN WORLD CUP CAMPAIGN ENGINE (PHASE 9)');
  console.log('='.repeat(75));
  console.log(`Format: ${format} | Seed: ${seed}`);

  const userTeam = buildUserTeam(format, seed);
  const captainName = userTeam.players.find((p) => p.cardId === userTeam.captainId)?.playerName;
  const f = userTeam.formation;
  console.log(`\nUser Team: ${userTeam.name} (${userTeam.format})`);
  console.log(
    `Formation: ${f.wicketkeepers.length} WK, ${f.bowlingOptions.length} bowling options ` +
      `(${f.specialistBowlers.length} specialist, ${f.allRounders.length} all-rounder) | Captain: ${captainName}`,
  );

  let state = createCampaign(userTeam, format, seed);
  state = startCampaign(state);

  console.log(`\nOpponents Drawn (${state.opponents.length} Historical Squads):`);
  state.opponents.forEach((o, i) => {
    console.log(`  ${i + 1}. ${o.displayName} (${o.historicalTournamentId})`);
  });

  // Group Stage
  console.log('\n' + '='.repeat(75));
  console.log('                     STAGE 1: GROUP ROUND-ROBIN');
  console.log('='.repeat(75));

  for (let round = 1; round <= 7; round++) {
    console.log(`\n>>> ROUND ${round} <<<`);
    state = playNextMatch(state);

    const roundMatches = state.completedMatches.filter(
      (m) => m.stage === 'GROUP' && Math.ceil(m.matchNumber / 4) === round,
    );

    for (const m of roundMatches) {
      const homeScore = formatScore(m.homeScore, maxOvers);
      const awayScore = formatScore(m.awayScore, maxOvers);
      const tag = m.userInvolved ? ' [USER MATCH]' : '';
      const thrashTag = m.isThrashing ? ' [THRASHING]' : '';
      console.log(
        `  Match ${m.matchNumber}: ${m.homeTeamName} (${homeScore}) vs ${m.awayTeamName} (${awayScore})${tag}`,
      );
      console.log(`    Result: ${m.summaryText}${thrashTag}`);
    }

    printStandingsTable(state.standings.table);
  }

  // Knockout Stage
  if (state.status === 'ELIMINATED') {
    console.log('\n' + '='.repeat(75));
    console.log('             CAMPAIGN TERMINATED — FAILED TO QUALIFY');
    console.log('='.repeat(75));
  } else {
    console.log('\n' + '='.repeat(75));
    console.log('                     STAGE 2: SEMIFINALS');
    console.log('='.repeat(75));

    state = playNextMatch(state);
    const sfMatches = state.completedMatches.filter((m) => m.stage === 'SEMIFINAL');
    for (const m of sfMatches) {
      const homeScore = formatScore(m.homeScore, maxOvers);
      const awayScore = formatScore(m.awayScore, maxOvers);
      const tag = m.userInvolved ? ' [USER MATCH]' : '';
      const thrashTag = m.isThrashing ? ' [THRASHING]' : '';
      console.log(
        `  SF Match ${m.matchNumber}: ${m.homeTeamName} (${homeScore}) vs ${m.awayTeamName} (${awayScore})${tag}`,
      );
      console.log(`    Result: ${m.summaryText}${thrashTag}`);
    }

    if (state.status === 'ELIMINATED') {
      console.log('\n' + '='.repeat(75));
      console.log('            CAMPAIGN TERMINATED — ELIMINATED IN SEMIFINALS');
      console.log('='.repeat(75));
    } else {
      console.log('\n' + '='.repeat(75));
      console.log('                       STAGE 3: THE FINAL');
      console.log('='.repeat(75));

      state = playNextMatch(state);
      const finalMatch = state.completedMatches.find((m) => m.stage === 'FINAL')!;
      const homeScore = formatScore(finalMatch.homeScore, maxOvers);
      const awayScore = formatScore(finalMatch.awayScore, maxOvers);
      const thrashTag = finalMatch.isThrashing ? ' [THRASHING]' : '';
      console.log(
        `  Final: ${finalMatch.homeTeamName} (${homeScore}) vs ${finalMatch.awayTeamName} (${awayScore})`,
      );
      console.log(`  Result: ${finalMatch.summaryText}${thrashTag}`);
    }
  }

  // Final Outcome & Achievements
  const res = state.result!;
  const validation = validateCampaign(state);

  console.log('\n' + '='.repeat(75));
  console.log('                   FINAL CAMPAIGN REPORT');
  console.log('='.repeat(75));
  console.log(`Status:                     ${res.status}`);
  console.log(`Stage Reached:              ${res.qualificationStageReached}`);
  console.log(
    `Matches Played:             ${res.matchesPlayed} (W: ${res.wins}, L: ${res.losses}, T: ${res.ties})`,
  );
  console.log(
    `Runs Scored / Conceded:     ${res.runsScored} / ${res.runsConceded} (Diff: ${res.runDifferential > 0 ? '+' : ''}${res.runDifferential})`,
  );
  console.log(`Wickets Lost / Taken:       ${res.wicketsLost} / ${res.wicketsTaken}`);
  console.log(`Integrity Validation:       ${validation.valid ? 'PASSED (0 errors)' : 'FAILED'}`);

  console.log('\nAchievements:');
  for (const a of res.achievements) {
    const check = a.unlocked ? '✓ UNLOCKED' : '✗ LOCKED';
    console.log(`  [${check}] ${a.name}: ${a.description}`);
  }

  console.log('='.repeat(75));
}

// Execute when run directly
if (process.argv[1]?.endsWith('campaign.ts')) {
  runCampaignCLI();
}
