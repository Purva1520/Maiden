/**
 * Match engine (§5 Layer 3 / §49): toss -> innings 1 -> innings 2 -> result.
 * Returns a clean immutable MatchResult with events, seed and versions (§61).
 */
import { SeededRandom } from './random.js';
import { simulateInnings, validatePlayerRatings } from './innings-engine.js';
import { simulateDelivery } from './delivery-engine.js';
import { FORMAT_CONFIG } from '../config/formats.js';
import { DEFAULT_SIMULATION_CONFIG, type SimulationConfig } from '../config/models.js';
import { hasBowlingCapacity } from '../rules/bowling.js';
import { isBowler, type Team } from '../models/player.js';
import type { DeliverySimulator, MatchEvent } from '../models/innings.js';
import type { CricketFormat } from '../models/delivery.js';
import type { MatchInput, MatchResult, MatchResultDetail, TossResult } from '../models/match.js';
import { InvalidFormatError, InvalidTeamError } from '../errors.js';

const VALID_FORMATS: readonly CricketFormat[] = ['ODI', 'T20'];

function validateTeam(team: Team, format: CricketFormat): void {
  if (team.players.length < 2) {
    throw new InvalidTeamError(`Team ${team.name} needs at least 2 players`);
  }
  validatePlayerRatings(team.players);
  const cfg = FORMAT_CONFIG[format];
  const bowlers = team.players.filter(isBowler).length;
  if (!hasBowlingCapacity(bowlers, cfg.maxOversPerBowler * cfg.ballsPerOver, cfg.maxBalls)) {
    throw new InvalidTeamError(`Team ${team.name} has too few bowlers for ${format}`);
  }
}

export function simulateMatch(
  input: MatchInput,
  deliverySim: DeliverySimulator = simulateDelivery,
  config: SimulationConfig = DEFAULT_SIMULATION_CONFIG,
): MatchResult {
  const { format, teamA, teamB, seed } = input;
  if (!VALID_FORMATS.includes(format)) {
    throw new InvalidFormatError(`Unsupported format: ${format}`);
  }
  if (!Number.isFinite(seed)) throw new InvalidFormatError(`Invalid seed: ${seed}`);
  validateTeam(teamA, format);
  validateTeam(teamB, format);

  const cfg = FORMAT_CONFIG[format];
  const rng = new SeededRandom(seed);

  // Toss.
  const tossWinner = rng.next() < 0.5 ? teamA : teamB;
  const decision: 'bat' | 'field' = rng.next() < cfg.batFirstProbability ? 'bat' : 'field';
  const toss: TossResult = {
    winnerId: tossWinner.id,
    winnerName: tossWinner.name,
    decision,
  };
  const other = tossWinner === teamA ? teamB : teamA;
  const battingFirst = decision === 'bat' ? tossWinner : other;
  const bowlingFirst = decision === 'bat' ? other : tossWinner;

  const events: MatchEvent[] = [
    { type: 'MATCH_START', format, teamA: teamA.name, teamB: teamB.name, seed },
    { type: 'TOSS', winner: tossWinner.name, decision },
  ];

  const model = config.formats[format];
  const innings1 = simulateInnings(
    {
      inningsNumber: 1,
      battingTeam: battingFirst,
      bowlingTeam: bowlingFirst,
      format,
      target: null,
    },
    rng,
    deliverySim,
    model,
  );
  const target = innings1.runs + 1;
  const innings2 = simulateInnings(
    { inningsNumber: 2, battingTeam: bowlingFirst, bowlingTeam: battingFirst, format, target },
    rng,
    deliverySim,
    model,
  );

  events.push(...innings1.events, ...innings2.events);

  const chasing = bowlingFirst;
  const defending = battingFirst;
  let result: MatchResultDetail;
  if (innings2.runs >= target) {
    const marginWickets = 10 - innings2.wickets;
    const ballsRemaining = cfg.maxBalls - innings2.legalBalls;
    result = {
      type: 'WIN_BY_WICKETS',
      winnerId: chasing.id,
      winnerName: chasing.name,
      marginRuns: null,
      marginWickets,
      ballsRemaining,
      text: `${chasing.name} won by ${marginWickets} wicket${marginWickets === 1 ? '' : 's'} with ${ballsRemaining} ball${ballsRemaining === 1 ? '' : 's'} remaining`,
    };
  } else if (innings2.runs === innings1.runs) {
    result = {
      type: 'TIE',
      winnerId: null,
      winnerName: null,
      marginRuns: null,
      marginWickets: null,
      ballsRemaining: null,
      text: 'Match tied',
    };
  } else {
    const marginRuns = innings1.runs - innings2.runs;
    result = {
      type: 'WIN_BY_RUNS',
      winnerId: defending.id,
      winnerName: defending.name,
      marginRuns,
      marginWickets: null,
      ballsRemaining: null,
      text: `${defending.name} won by ${marginRuns} run${marginRuns === 1 ? '' : 's'}`,
    };
  }

  events.push({ type: 'MATCH_END', result: result.text });

  return {
    format,
    teamA: { id: teamA.id, name: teamA.name },
    teamB: { id: teamB.id, name: teamB.name },
    toss,
    innings1,
    innings2,
    result,
    events,
    seed,
    simulationVersion: config.simulationVersion,
    configVersion: config.calibrationVersion,
  };
}
