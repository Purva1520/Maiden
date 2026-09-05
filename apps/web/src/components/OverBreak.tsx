import type { BatterLive, BowlerLive } from '../lib/matchView.js';
import { formatOvers, formatScore } from '../lib/format.js';

/** End-of-over transition with the over's sequence and current state (§20, §21). */
export function OverBreak({
  overNumber,
  sequence,
  runsThisOver,
  battingTeamName,
  runs,
  wickets,
  legalBalls,
  striker,
  nonStriker,
  bowler,
}: {
  overNumber: number;
  sequence: readonly string[];
  runsThisOver: number;
  battingTeamName: string;
  runs: number;
  wickets: number;
  legalBalls: number;
  striker: BatterLive | null;
  nonStriker: BatterLive | null;
  bowler: BowlerLive | null;
}): React.ReactElement {
  return (
    <div className="break-panel" role="status">
      <div className="eyebrow">End of over {overNumber}</div>
      <div className="break-score stat">
        {battingTeamName} {formatScore(runs, wickets)}
        <span className="muted" style={{ fontSize: 15 }}>
          {' '}
          ({formatOvers(legalBalls)})
        </span>
      </div>

      <div className="over-seq mt-3">
        {sequence.map((s, i) => (
          <span
            key={i}
            className={`over-ball ${s === 'W' ? 'wkt' : s === '4' || s === '6' ? 'bnd' : s === '0' ? 'dot' : ''}`}
          >
            {s === '0' ? '•' : s}
          </span>
        ))}
        <span className="over-total mono">= {runsThisOver}</span>
      </div>

      <div className="break-lines mt-4">
        {striker && (
          <div>
            <b>{striker.name}</b>{' '}
            <span className="mono">
              {striker.runs}* ({striker.balls})
            </span>
          </div>
        )}
        {nonStriker && (
          <div>
            <b>{nonStriker.name}</b>{' '}
            <span className="mono">
              {nonStriker.runs}* ({nonStriker.balls})
            </span>
          </div>
        )}
        {bowler && (
          <div className="muted mt-2">
            {bowler.name}{' '}
            <span className="mono">
              {bowler.wickets}/{bowler.runs}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
