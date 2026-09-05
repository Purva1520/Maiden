/**
 * CLI for `pnpm simulate` (§63). Human-readable formatter over the engine's
 * structured result. Presentation only — no simulation logic lives here.
 *
 * Usage: tsx src/cli.ts [--format odi|t20] [--seed N] [--full]
 */
import { simulateMatch } from './core/match-engine.js';
import { australiaXI, indiaXI } from './fixtures.js';
import { formatEconomy, formatOvers, formatScore, formatStrikeRate } from './format.js';
import type { CricketFormat } from './models/delivery.js';
import type { BatterScore, BowlerScore, InningsResult } from './models/innings.js';
import type { MatchResult } from './models/match.js';

interface Args {
  format: CricketFormat;
  seed: number;
  full: boolean;
}

function parseArgs(argv: readonly string[]): Args {
  let format: CricketFormat = 'ODI';
  let seed = 849273;
  let full = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--format') {
      const v = (argv[++i] ?? '').toUpperCase();
      format = v === 'T20' ? 'T20' : 'ODI';
    } else if (a === '--seed') {
      const n = Number(argv[++i]);
      if (Number.isFinite(n)) seed = Math.trunc(n);
    } else if (a === '--full') {
      full = true;
    }
  }
  return { format, seed, full };
}

function topScorer(inn: InningsResult): BatterScore | null {
  let best: BatterScore | null = null;
  for (const b of inn.battingCard) {
    if (b.batted && (best === null || b.runs > best.runs)) best = b;
  }
  return best;
}

function bestBowler(inn: InningsResult): BowlerScore | null {
  let best: BowlerScore | null = null;
  for (const b of inn.bowlingCard) {
    if (
      best === null ||
      b.wickets > best.wickets ||
      (b.wickets === best.wickets && b.runs < best.runs)
    ) {
      best = b;
    }
  }
  return best;
}

function inningsSummary(inn: InningsResult): string {
  const lines = [
    `${inn.battingTeamName} ${formatScore(inn.runs, inn.wickets)} (${formatOvers(inn.legalBalls)})`,
  ];
  const ts = topScorer(inn);
  if (ts) lines.push(`  Top scorer: ${ts.name} ${ts.runs} (${ts.balls})`);
  const bb = bestBowler(inn);
  if (bb)
    lines.push(`  Best bowler: ${bb.name} ${bb.wickets}/${bb.runs} (${formatOvers(bb.balls)})`);
  return lines.join('\n');
}

function fullScorecard(inn: InningsResult): string {
  const lines: string[] = [
    `\n${inn.battingTeamName} — ${formatScore(inn.runs, inn.wickets)} (${formatOvers(inn.legalBalls)})`,
  ];
  lines.push('  Batting                       R    B   4s  6s   SR      Out');
  for (const b of inn.battingCard) {
    if (!b.batted) continue;
    const sr = formatStrikeRate(b.runs, b.balls) ?? '-';
    const out = b.dismissed ? `b ${b.dismissalBowler ?? ''}` : 'not out';
    lines.push(
      `  ${b.name.padEnd(26)} ${String(b.runs).padStart(3)} ${String(b.balls).padStart(4)} ` +
        `${String(b.fours).padStart(3)} ${String(b.sixes).padStart(3)} ${sr.padStart(6)}   ${out}`,
    );
  }
  lines.push('  Bowling                       O     M    R    W   Econ');
  for (const bw of inn.bowlingCard) {
    const econ = formatEconomy(bw.runs, bw.balls) ?? '-';
    lines.push(
      `  ${bw.name.padEnd(26)} ${formatOvers(bw.balls).padStart(5)} ${String(bw.maidens).padStart(4)} ` +
        `${String(bw.runs).padStart(4)} ${String(bw.wickets).padStart(4)} ${econ.padStart(6)}`,
    );
  }
  if (inn.fallOfWickets.length) {
    lines.push(
      '  Fall of wickets: ' +
        inn.fallOfWickets
          .map(
            (f) => `${f.score}/${f.wicketNumber} (${f.batterName}, ${formatOvers(f.legalBalls)})`,
          )
          .join('  '),
    );
  }
  return lines.join('\n');
}

function render(match: MatchResult, full: boolean): string {
  const out: string[] = [
    'MAIDEN SIMULATOR',
    '================',
    '',
    `Format: ${match.format}`,
    `Seed: ${match.seed}  |  simulation ${match.simulationVersion} / config ${match.configVersion}`,
    '',
    `${match.teamA.name} vs ${match.teamB.name}`,
    '',
    'TOSS',
    `${match.toss.winnerName} won the toss and chose to ${match.toss.decision}.`,
    '',
    '1ST INNINGS',
    inningsSummary(match.innings1),
    '',
    '2ND INNINGS',
    inningsSummary(match.innings2),
  ];
  if (full) {
    out.push(fullScorecard(match.innings1));
    out.push(fullScorecard(match.innings2));
  }
  out.push('', 'RESULT', '='.repeat(30), match.result.text);
  return out.join('\n');
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const match = simulateMatch({
    format: args.format,
    teamA: indiaXI,
    teamB: australiaXI,
    seed: args.seed,
  });
  console.log(render(match, args.full));
}

main();
