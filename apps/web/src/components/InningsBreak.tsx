import type { InningsResult } from '../lib/domain.js';
import { formatOvers, formatScore, formatOvers as ov } from '../lib/format.js';

function topBatter(innings: InningsResult): string | null {
  const b = [...innings.battingCard].filter((x) => x.batted).sort((a, z) => z.runs - a.runs)[0];
  return b ? `${b.name} ${b.runs} (${b.balls})` : null;
}
function bestBowler(innings: InningsResult): string | null {
  const b = [...innings.bowlingCard]
    .filter((x) => x.balls > 0)
    .sort((a, z) => z.wickets - a.wickets || a.runs - z.runs)[0];
  return b ? `${b.name} ${b.wickets}/${b.runs} (${ov(b.balls)})` : null;
}

/** Innings-break transition (§26–§28). Only real engine statistics. */
export function InningsBreak({
  innings,
  target,
  chasingTeamName,
}: {
  innings: InningsResult;
  target: number;
  chasingTeamName: string;
}): React.ReactElement {
  const tb = topBatter(innings);
  const bb = bestBowler(innings);
  return (
    <div className="break-panel innings" role="status">
      <div className="eyebrow">Innings break</div>
      <div className="break-score stat">
        {innings.battingTeamName} {formatScore(innings.runs, innings.wickets)}
        <span className="muted" style={{ fontSize: 15 }}>
          {' '}
          ({formatOvers(innings.legalBalls)})
        </span>
      </div>

      <div className="break-lines mt-4">
        {tb && (
          <div>
            <span className="faint">Top scorer</span> <b>{tb}</b>
          </div>
        )}
        {bb && (
          <div>
            <span className="faint">Best bowling</span> <b>{bb}</b>
          </div>
        )}
      </div>

      <div className="target-callout mt-5">
        <span className="muted">{chasingTeamName} need</span>
        <span className="target-runs stat">{target}</span>
        <span className="muted">to win</span>
      </div>
    </div>
  );
}
