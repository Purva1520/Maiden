#!/usr/bin/env node
/**
 * Maiden CLI: XI Builder, Roll Mechanic & Simulation Handoff (§68–§70, §103).
 *
 * Usage:
 *   npx tsx scripts/maiden-draft.ts
 *   npx tsx scripts/maiden-draft.ts --format ODI --seed 849273
 *   npx tsx scripts/maiden-draft.ts --format T20 --seed 54321
 */
import { australiaXI, formatOvers, simulateMatch } from '../packages/simulator/src/index.js';
import {
  createGame,
  finalizeXI,
  rollTeams,
  selectPlayerInDraft,
  setCaptainInDraft,
  validateDraft,
} from '../team/gameState.js';
import { toSimulatorTeam } from '../team/adapter.js';
import { isBowlingOption, isTopOrderCapable } from '../team/bowlingOptions.js';
import type { CricketFormat, PlayerCard } from '../team/types.js';

function parseArgs(): { format: CricketFormat; seed: number } {
  const args = process.argv.slice(2);
  let format: CricketFormat = 'ODI';
  let seed = 849273;

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

function draftLegalXI(pool: readonly PlayerCard[]): string[] {
  // Select a balanced, legal XI from the available pool:
  // - 1 Wicketkeeper
  // - At least 5 bowling options (including specialist bowlers and allrounders)
  // - At least 2 top-order capable players
  // - Distinct canonical player identities
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

  // 2. Pick top-order specialist batters (target 3)
  const topOrder = pool.filter((p) => isTopOrderCapable(p) && canAdd(p));
  for (const b of topOrder) {
    if (selected.filter((p) => isTopOrderCapable(p)).length >= 3) break;
    add(b);
  }

  // 3. Pick specialist bowlers (target 4)
  const bowlers = pool.filter((p) => p.role === 'BOWL' && canAdd(p));
  for (const b of bowlers) {
    if (selected.filter((p) => p.role === 'BOWL').length >= 4) break;
    add(b);
  }

  // 4. Pick all-rounders (target 2)
  const allrounders = pool.filter((p) => p.role === 'ALLROUNDER' && canAdd(p));
  for (const a of allrounders) {
    if (selected.filter((p) => p.role === 'ALLROUNDER').length >= 2) break;
    add(a);
  }

  // 5. Fill remaining slots to reach exactly 11 players, ensuring >= 5 bowling options
  for (const p of pool) {
    if (selected.length >= 11) break;
    if (!canAdd(p)) continue;

    const bowlingCount = selected.filter((s) => isBowlingOption(s)).length;
    if (bowlingCount < 5 && !isBowlingOption(p)) {
      continue; // prioritize bowling option if under requirement
    }
    add(p);
  }

  return selected.map((p) => p.cardId);
}

function main(): void {
  const { format, seed } = parseArgs();

  console.log(`\n======================================================`);
  console.log(`MAIDEN — XI BUILDER & CORE GAME ENGINE`);
  console.log(`======================================================`);
  console.log(`FORMAT: ${format}`);
  console.log(`SEED:   ${seed}\n`);

  // 1. Create and Roll
  let state = createGame(format, seed);
  state = rollTeams(state);

  console.log(`ROLL RESULTS`);
  console.log(`------------`);
  state.rolledTeams.forEach((t, i) => {
    console.log(`  ${i + 1}. ${t.teamName} (${t.year}) — [${t.tournamentId}]`);
  });
  console.log(`\nAVAILABLE PLAYER POOL: ${state.availablePool.length} players\n`);

  // 2. Draft XI
  const draftedCardIds = draftLegalXI(state.availablePool);
  for (const cardId of draftedCardIds) {
    state = selectPlayerInDraft(state, cardId);
  }

  // 3. Pick Captain (choose WK or premier batter/allrounder)
  const poolMap = new Map(state.availablePool.map((c) => [c.cardId, c]));
  const captainCandidate =
    state.selectedPlayerIds.find((id) => poolMap.get(id)?.wicketkeeper) ||
    state.selectedPlayerIds[0]!;
  state = setCaptainInDraft(state, captainCandidate);

  // 4. Display Selected XI & Batting Order
  console.log(`PLAYING XI (BATTING ORDER 1–11)`);
  console.log(`------------------------------------------------------`);
  state.battingOrder.forEach((cardId, idx) => {
    const p = poolMap.get(cardId)!;
    const isCapt = cardId === state.captainId ? ' (C)' : '';
    const isWk = p.wicketkeeper ? ' (WK)' : '';
    const bat = p.batRating !== null ? `BAT: ${p.batRating}` : 'BAT: unrated';
    const bowl = p.bowlRating !== null ? `BOWL: ${p.bowlRating}` : 'BOWL: —';
    const roleTag = `[${p.role}]`.padEnd(13);
    console.log(
      `  ${String(idx + 1).padStart(2)}. ${p.playerName}${isCapt}${isWk}`.padEnd(35) +
        `${roleTag} ${p.teamName} ${p.year}`.padEnd(28) +
        `  ${bat.padEnd(15)} | ${bowl}`,
    );
  });
  console.log();

  // 5. Validation Check
  const validation = validateDraft(state);
  console.log(`TEAM VALIDATION`);
  console.log(`---------------`);
  console.log(
    `  ${validation.checks.playerCount.valid ? '✓' : '✗'} Players:          ${validation.checks.playerCount.actual}/${validation.checks.playerCount.required}`,
  );
  console.log(
    `  ${validation.checks.wicketkeeper.valid ? '✓' : '✗'} Wicketkeepers:    ${validation.checks.wicketkeeper.count}/${validation.checks.wicketkeeper.required}`,
  );
  console.log(
    `  ${validation.checks.bowlingOptions.valid ? '✓' : '✗'} Bowling options:  ${validation.checks.bowlingOptions.actual}/${validation.checks.bowlingOptions.required}`,
  );
  console.log(
    `  ${validation.checks.topOrder.valid ? '✓' : '✗'} Top-order:        ${validation.checks.topOrder.actual}/${validation.checks.topOrder.required}`,
  );
  console.log(
    `  ${validation.checks.captain.valid ? '✓' : '✗'} Captain:          ${poolMap.get(state.captainId!)?.playerName}`,
  );
  console.log(
    `  ${validation.checks.battingOrder.valid ? '✓' : '✗'} Batting order:    ${validation.checks.battingOrder.valid ? 'Valid (11/11)' : 'Invalid'}`,
  );

  if (validation.warnings.length > 0) {
    console.log(`\n  Warnings:`);
    validation.warnings.forEach((w) => console.log(`    - ${w}`));
  }

  if (!validation.valid) {
    console.error(`\nValidation failed:`);
    validation.errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  // 6. Finalize XI
  const { team, state: readyState } = finalizeXI(state, `Maiden ${format} XI`);
  console.log(`\nSTATUS: ${readyState.status}`);

  // 7. Pass to Simulation Engine (Phase 6/7 Simulator Handoff)
  console.log(`\n======================================================`);
  console.log(`SIMULATOR HANDOFF (§46, §86)`);
  console.log(`======================================================`);
  console.log(`Simulating match between [${team.name}] and [${australiaXI.name}]...\n`);

  const simTeam = toSimulatorTeam(team);
  const matchResult = simulateMatch({
    format,
    teamA: simTeam,
    teamB: australiaXI,
    seed: seed + 100,
  });

  console.log(
    `TOSS: ${matchResult.toss.winnerName} won the toss and elected to ${matchResult.toss.decision}.\n`,
  );
  console.log(
    `INNINGS 1 (${matchResult.innings1.battingTeamName}): ${matchResult.innings1.runs}/${matchResult.innings1.wickets} (${formatOvers(matchResult.innings1.legalBalls)} ov)`,
  );
  console.log(
    `INNINGS 2 (${matchResult.innings2.battingTeamName}): ${matchResult.innings2.runs}/${matchResult.innings2.wickets} (${formatOvers(matchResult.innings2.legalBalls)} ov)\n`,
  );
  console.log(`RESULT: ${matchResult.result.text}`);
  console.log(`======================================================\n`);
}

main();
