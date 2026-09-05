import type { MatchView } from '../lib/matchView.js';
import { formatOvers, formatScore } from '../lib/format.js';

/** Live score panel (§30). All values come from the match state. */
export function Scoreboard({ view }: { view: MatchView }): React.ReactElement {
  const chasing = view.inningsNumber === 2;
  return (
    <div className="scoreboard" role="group" aria-label="Scoreboard">
      <div className="sb-main">
        <div>
          <div className="sb-team">{view.battingTeamName}</div>
          <div className="muted" style={{ fontSize: 12 }}>
            v {view.bowlingTeamName} · {chasing ? '2nd innings' : '1st innings'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="sb-score">{formatScore(view.runs, view.wickets)}</div>
          <div className="sb-overs">{formatOvers(view.legalBalls)} ov</div>
        </div>
      </div>
      <div className="sb-meta">
        <div className="sb-chip">
          <span className="k">Run rate</span>
          <span className="v">{view.crr.toFixed(2)}</span>
        </div>
        {chasing && view.target !== null && (
          <>
            <div className="sb-chip">
              <span className="k">Target</span>
              <span className="v sb-target">{view.target}</span>
            </div>
            <div className="sb-chip">
              <span className="k">Need</span>
              <span className="v">
                {view.runsRequired} off {view.ballsRemaining}
              </span>
            </div>
            {view.rrr !== null && (
              <div className="sb-chip">
                <span className="k">Req. rate</span>
                <span className="v">{view.rrr.toFixed(2)}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
