/**
 * Innings engine (§5 Layer 2 / §27): simulate one complete innings — score,
 * wickets, legal balls, strike rotation, batting order, bowler rotation, over
 * transitions and termination. The delivery generator is injectable (§72) so
 * rules can be tested independently of probability.
 */
import type { SeededRandom } from './random.js';
import type { DeliveryContext, MatchState } from '../models/delivery.js';
import type {
  BatterScore,
  BowlerScore,
  DeliverySimulator,
  FallOfWicket,
  InningsInput,
  InningsResult,
  MatchEvent,
} from '../models/innings.js';
import type { PlayerContext } from '../models/player.js';
import { isBowler } from '../models/player.js';
import { FORMAT_CONFIG, phaseForOver } from '../config/formats.js';
import { chooseBowler, hasBowlingCapacity } from '../rules/bowling.js';
import { shouldRotateOnRuns } from '../rules/strike.js';
import { simulateDelivery } from './delivery-engine.js';
import { formatScore } from '../format.js';
import { InvalidRatingError, InvalidTeamError, SimulationInvariantError } from '../errors.js';

export function validatePlayerRatings(players: readonly PlayerContext[]): void {
  for (const p of players) {
    if (!Number.isFinite(p.batRating) || p.batRating < 0 || p.batRating > 99) {
      throw new InvalidRatingError(`Invalid batRating for ${p.id}: ${p.batRating}`);
    }
    if (p.bowlRating !== null && (p.bowlRating < 0 || p.bowlRating > 99)) {
      throw new InvalidRatingError(`Invalid bowlRating for ${p.id}: ${p.bowlRating}`);
    }
  }
}

export function simulateInnings(
  input: InningsInput,
  rng: SeededRandom,
  deliverySim: DeliverySimulator = simulateDelivery,
): InningsResult {
  const cfg = FORMAT_CONFIG[input.format];
  const battingPlayers = input.battingTeam.players;
  const bowlingPlayers = input.bowlingTeam.players;

  validatePlayerRatings(battingPlayers);
  validatePlayerRatings(bowlingPlayers);
  if (battingPlayers.length < 2) {
    throw new InvalidTeamError('A batting team needs at least 2 players');
  }

  const bowlCapable = bowlingPlayers.filter(isBowler);
  const maxBowlerBalls = cfg.maxOversPerBowler * cfg.ballsPerOver;
  if (!hasBowlingCapacity(bowlCapable.length, maxBowlerBalls, cfg.maxBalls)) {
    throw new InvalidTeamError(
      `${input.bowlingTeam.name} lacks bowling capacity for a ${input.format} innings`,
    );
  }

  const batters: BatterScore[] = battingPlayers.map((p) => ({
    playerId: p.id,
    name: p.name,
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    dismissed: false,
    dismissalBowler: null,
    batted: false,
  }));
  const bowlers: BowlerScore[] = bowlCapable.map((p) => ({
    playerId: p.id,
    name: p.name,
    balls: 0,
    runs: 0,
    wickets: 0,
    maidens: 0,
  }));
  const bowlerPlayerById = new Map(bowlingPlayers.map((p) => [p.id, p] as const));

  const events: MatchEvent[] = [];
  const fallOfWickets: FallOfWicket[] = [];

  let runs = 0;
  let wickets = 0;
  let legalBalls = 0;
  let strikerIdx = 0;
  let nonStrikerIdx = 1;
  let nextBatterIdx = 2;
  let lastBowlerId: string | null = null;
  let targetReached = false;
  let allOut = false;
  let inningsOver = false;

  batters[0]!.batted = true;
  batters[1]!.batted = true;

  events.push({
    type: 'INNINGS_START',
    inningsNumber: input.inningsNumber,
    battingTeam: input.battingTeam.name,
    bowlingTeam: input.bowlingTeam.name,
    target: input.target,
  });

  for (let overIndex = 0; !inningsOver && legalBalls < cfg.maxBalls; overIndex++) {
    const bowlerScore = chooseBowler(bowlers, maxBowlerBalls, lastBowlerId);
    const bowlerPlayer = bowlerPlayerById.get(bowlerScore.playerId);
    if (!bowlerPlayer) throw new SimulationInvariantError('Bowler player missing');
    lastBowlerId = bowlerScore.playerId;
    const phase = phaseForOver(input.format, overIndex);
    const overRunsStart = bowlerScore.runs;
    const overBallsStart = bowlerScore.balls;

    events.push({ type: 'OVER_START', over: overIndex, bowler: bowlerPlayer.name, phase });

    for (let ball = 0; ball < cfg.ballsPerOver; ball++) {
      const strikerPlayer = battingPlayers[strikerIdx]!;
      const strikerScore = batters[strikerIdx]!;

      const ballsRemaining = cfg.maxBalls - legalBalls;
      const matchState: MatchState = {
        legalBalls,
        wicketsLost: wickets,
        maxBalls: cfg.maxBalls,
        target: input.target,
        runsRequired: input.target !== null ? Math.max(0, input.target - runs) : null,
        ballsRemaining: input.target !== null ? ballsRemaining : null,
      };
      const ctx: DeliveryContext = {
        batter: strikerPlayer,
        bowler: bowlerPlayer,
        phase,
        format: input.format,
        matchState,
      };
      const res = deliverySim(ctx, rng);

      legalBalls += 1;
      strikerScore.balls += 1;
      bowlerScore.balls += 1;
      runs += res.totalRuns;
      strikerScore.runs += res.batterRuns;
      bowlerScore.runs += res.totalRuns; // v1: all runs charged to the bowler
      if (res.outcome === 'FOUR') strikerScore.fours += 1;
      if (res.outcome === 'SIX') strikerScore.sixes += 1;

      events.push({
        type: 'DELIVERY',
        inningsNumber: input.inningsNumber,
        over: overIndex,
        ball: ball + 1,
        batter: strikerPlayer.name,
        bowler: bowlerPlayer.name,
        outcome: res.outcome,
        runs: res.totalRuns,
        scoreAfter: formatScore(runs, wickets),
      });

      if (res.wicket) {
        wickets += 1;
        strikerScore.dismissed = true;
        strikerScore.dismissalBowler = bowlerScore.playerId;
        bowlerScore.wickets += 1;
        fallOfWickets.push({
          wicketNumber: wickets,
          score: runs,
          legalBalls,
          batterId: strikerPlayer.id,
          batterName: strikerPlayer.name,
        });
        events.push({
          type: 'WICKET',
          inningsNumber: input.inningsNumber,
          over: overIndex,
          ball: ball + 1,
          batter: strikerPlayer.name,
          bowler: bowlerPlayer.name,
          score: formatScore(runs, wickets),
        });

        if (nextBatterIdx < battingPlayers.length) {
          strikerIdx = nextBatterIdx;
          batters[strikerIdx]!.batted = true;
          nextBatterIdx += 1;
        } else {
          allOut = true;
          inningsOver = true;
          break;
        }
      } else if (shouldRotateOnRuns(res.totalRuns)) {
        [strikerIdx, nonStrikerIdx] = [nonStrikerIdx, strikerIdx];
      }

      if (input.target !== null && runs >= input.target) {
        targetReached = true;
        inningsOver = true;
        break;
      }
    }

    // Maiden: full over with zero runs conceded.
    if (
      bowlerScore.balls - overBallsStart === cfg.ballsPerOver &&
      bowlerScore.runs === overRunsStart
    ) {
      bowlerScore.maidens += 1;
    }

    if (!inningsOver) {
      [strikerIdx, nonStrikerIdx] = [nonStrikerIdx, strikerIdx];
      events.push({ type: 'OVER_END', over: overIndex, score: formatScore(runs, wickets) });
    }
  }

  events.push({
    type: 'INNINGS_END',
    inningsNumber: input.inningsNumber,
    score: formatScore(runs, wickets),
    legalBalls,
  });

  // Invariant checks (§94).
  if (runs < 0 || wickets < 0 || legalBalls < 0 || legalBalls > cfg.maxBalls) {
    throw new SimulationInvariantError('Innings produced invalid state');
  }

  return {
    inningsNumber: input.inningsNumber,
    battingTeamId: input.battingTeam.id,
    battingTeamName: input.battingTeam.name,
    bowlingTeamId: input.bowlingTeam.id,
    runs,
    wickets,
    legalBalls,
    allOut,
    targetReached,
    battingCard: batters,
    bowlingCard: bowlers.filter((b) => b.balls > 0),
    fallOfWickets,
    events,
  };
}
