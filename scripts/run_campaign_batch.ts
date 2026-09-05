#!/usr/bin/env node
/**
 * Batch Campaign Evaluator: Simulates 100 deterministic campaigns (50 ODI, 50 T20) (§62–§64).
 *
 * Usage:
 *   npx tsx scripts/run_campaign_batch.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCampaign, playEntireCampaign, validateCampaign } from '../campaign/campaign.js';
import {
  createGame,
  finalizeXI,
  rollTeams,
  selectPlayerInDraft,
  setCaptainInDraft,
} from '../team/gameState.js';
import { isBowlingOption, isTopOrderCapable } from '../team/bowlingOptions.js';
import type { CricketFormat, MaidenTeam, PlayerCard } from '../team/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function buildDraftedTeam(format: CricketFormat, seed: number): MaidenTeam {
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

  // 2. Pick at least 5 bowling options (specialist bowlers / allrounders / part-timers)
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

  const { team } = finalizeXI(state, `Maiden Squad #${seed}`);
  return team;
}

interface CampaignSummary {
  seed: number;
  format: CricketFormat;
  status: string;
  stageReached: string;
  wins: number;
  losses: number;
  ties: number;
  runsScored: number;
  runsConceded: number;
  runDifferential: number;
  champion: boolean;
  invincible: boolean;
  goldenInvincible: boolean;
  finalStandingPosition: number;
}

interface FormatAggregate {
  total: number;
  champions: number;
  runnersUp: number;
  semifinalists: number;
  groupExits: number;
  invincibles: number;
  goldenInvincibles: number;
  totalWins: number;
  totalLosses: number;
  totalTies: number;
  totalRunsScored: number;
  totalRunsConceded: number;
  qualificationRate: number;
  championRate: number;
  invincibleRate: number;
  goldenInvincibleRate: number;
}

export function runBatchSimulation(campaignsPerFormat = 50): void {
  console.log(
    `Starting Batch Simulation: ${campaignsPerFormat * 2} total campaigns (${campaignsPerFormat} ODI, ${campaignsPerFormat} T20)...`,
  );
  const startTime = Date.now();

  const formats: CricketFormat[] = ['ODI', 'T20'];
  const allResults: CampaignSummary[] = [];

  const aggregates: Record<CricketFormat, FormatAggregate> = {
    ODI: {
      total: 0,
      champions: 0,
      runnersUp: 0,
      semifinalists: 0,
      groupExits: 0,
      invincibles: 0,
      goldenInvincibles: 0,
      totalWins: 0,
      totalLosses: 0,
      totalTies: 0,
      totalRunsScored: 0,
      totalRunsConceded: 0,
      qualificationRate: 0,
      championRate: 0,
      invincibleRate: 0,
      goldenInvincibleRate: 0,
    },
    T20: {
      total: 0,
      champions: 0,
      runnersUp: 0,
      semifinalists: 0,
      groupExits: 0,
      invincibles: 0,
      goldenInvincibles: 0,
      totalWins: 0,
      totalLosses: 0,
      totalTies: 0,
      totalRunsScored: 0,
      totalRunsConceded: 0,
      qualificationRate: 0,
      championRate: 0,
      invincibleRate: 0,
      goldenInvincibleRate: 0,
    },
  };

  let campaignCount = 0;

  for (const format of formats) {
    const agg = aggregates[format];

    for (let i = 1; i <= campaignsPerFormat; i++) {
      const seed = 10000 + (format === 'ODI' ? 1000 : 2000) + i;
      campaignCount++;

      const userTeam = buildDraftedTeam(format, seed);
      const state = createCampaign(userTeam, format, seed);
      const finalState = playEntireCampaign(state);

      const validation = validateCampaign(finalState);
      if (!validation.valid) {
        throw new Error(
          `Integrity violation in campaign seed ${seed}: ${validation.errors.join('; ')}`,
        );
      }

      const res = finalState.result!;
      const userStanding = finalState.standings.table.find((s) => s.teamId === userTeam.teamId)!;

      const isChampion = res.champion;
      const isRunnerUp = !res.champion && res.qualificationStageReached === 'FINAL';
      const isSemiFinalist = res.qualificationStageReached === 'SEMIFINAL';
      const isGroupExit = res.qualificationStageReached === 'GROUP';

      agg.total += 1;
      if (isChampion) agg.champions += 1;
      if (isRunnerUp) agg.runnersUp += 1;
      if (isSemiFinalist) agg.semifinalists += 1;
      if (isGroupExit) agg.groupExits += 1;
      if (res.invincible) agg.invincibles += 1;
      if (res.goldenInvincible) agg.goldenInvincibles += 1;

      agg.totalWins += res.wins;
      agg.totalLosses += res.losses;
      agg.totalTies += res.ties;
      agg.totalRunsScored += res.runsScored;
      agg.totalRunsConceded += res.runsConceded;

      allResults.push({
        seed,
        format,
        status: res.status,
        stageReached: res.qualificationStageReached,
        wins: res.wins,
        losses: res.losses,
        ties: res.ties,
        runsScored: res.runsScored,
        runsConceded: res.runsConceded,
        runDifferential: res.runDifferential,
        champion: res.champion,
        invincible: res.invincible,
        goldenInvincible: res.goldenInvincible,
        finalStandingPosition: userStanding.position,
      });

      if (campaignCount % 10 === 0 || campaignCount === campaignsPerFormat * 2) {
        process.stdout.write(
          `  Completed ${campaignCount} / ${campaignsPerFormat * 2} campaigns...\r`,
        );
      }
    }

    agg.qualificationRate = (agg.total - agg.groupExits) / agg.total;
    agg.championRate = agg.champions / agg.total;
    agg.invincibleRate = agg.invincibles / agg.total;
    agg.goldenInvincibleRate = agg.goldenInvincibles / agg.total;
  }

  const durationMs = Date.now() - startTime;
  console.log(`\nCompleted ${campaignCount} campaigns in ${(durationMs / 1000).toFixed(2)}s`);

  const report = {
    meta: {
      generatedAt: new Date().toISOString(),
      generator: 'scripts/run_campaign_batch.ts',
      rulesVersion: 'v1.0.0',
      totalCampaigns: allResults.length,
      durationSeconds: Number((durationMs / 1000).toFixed(2)),
    },
    aggregates: {
      ODI: {
        ...aggregates.ODI,
        avgRunsScoredPerMatch: Number(
          (
            aggregates.ODI.totalRunsScored /
            (aggregates.ODI.totalWins + aggregates.ODI.totalLosses + aggregates.ODI.totalTies)
          ).toFixed(1),
        ),
        avgRunsConcededPerMatch: Number(
          (
            aggregates.ODI.totalRunsConceded /
            (aggregates.ODI.totalWins + aggregates.ODI.totalLosses + aggregates.ODI.totalTies)
          ).toFixed(1),
        ),
      },
      T20: {
        ...aggregates.T20,
        avgRunsScoredPerMatch: Number(
          (
            aggregates.T20.totalRunsScored /
            (aggregates.T20.totalWins + aggregates.T20.totalLosses + aggregates.T20.totalTies)
          ).toFixed(1),
        ),
        avgRunsConcededPerMatch: Number(
          (
            aggregates.T20.totalRunsConceded /
            (aggregates.T20.totalWins + aggregates.T20.totalLosses + aggregates.T20.totalTies)
          ).toFixed(1),
        ),
      },
      overall: {
        totalCampaigns: allResults.length,
        totalChampions: aggregates.ODI.champions + aggregates.T20.champions,
        overallChampionRate:
          (aggregates.ODI.champions + aggregates.T20.champions) / allResults.length,
        overallInvincibles: aggregates.ODI.invincibles + aggregates.T20.invincibles,
        overallInvincibleRate:
          (aggregates.ODI.invincibles + aggregates.T20.invincibles) / allResults.length,
        overallGoldenInvincibles:
          aggregates.ODI.goldenInvincibles + aggregates.T20.goldenInvincibles,
        overallGoldenInvincibleRate:
          (aggregates.ODI.goldenInvincibles + aggregates.T20.goldenInvincibles) / allResults.length,
        overallQualificationRate:
          (aggregates.ODI.total -
            aggregates.ODI.groupExits +
            (aggregates.T20.total - aggregates.T20.groupExits)) /
          allResults.length,
      },
    },
    sampleCampaigns: allResults.slice(0, 15),
  };

  const outputPath = path.resolve(__dirname, '../data/processed/campaign_test_report_v1.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');

  console.log(`\nReport successfully written to: ${outputPath}`);
  console.log('\nSummary:');
  console.log(
    `  ODI Qualification Rate: ${(aggregates.ODI.qualificationRate * 100).toFixed(1)}% | Champion Rate: ${(aggregates.ODI.championRate * 100).toFixed(1)}% | Invincible: ${aggregates.ODI.invincibles}`,
  );
  console.log(
    `  T20 Qualification Rate: ${(aggregates.T20.qualificationRate * 100).toFixed(1)}% | Champion Rate: ${(aggregates.T20.championRate * 100).toFixed(1)}% | Invincible: ${aggregates.T20.invincibles}`,
  );
  console.log(
    `  Overall Champion Rate:  ${(report.aggregates.overall.overallChampionRate * 100).toFixed(1)}%`,
  );
}

if (process.argv[1]?.endsWith('run_campaign_batch.ts')) {
  runBatchSimulation(50);
}
