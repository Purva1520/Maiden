import type { BowlerLive } from '../lib/matchView.js';
import { formatOvers, formatEconomy } from '../lib/format.js';

/** Current bowler statistics (§32). Overs shown as legal-ball cricket format. */
export function BowlerCard({ bowler }: { bowler: BowlerLive | null }): React.ReactElement {
  if (!bowler) return <div className="pcard muted">—</div>;
  return (
    <div className="pcard">
      <div className="who">
        <span className="nm">{bowler.name}</span>
        <span className="mono" style={{ fontWeight: 700 }}>
          {bowler.wickets}/{bowler.runs}
        </span>
      </div>
      <div className="line">
        <div>
          O <b>{formatOvers(bowler.balls)}</b>
        </div>
        <div>
          W <b>{bowler.wickets}</b>
        </div>
        <div>
          Econ <b>{formatEconomy(bowler.runs, bowler.balls)}</b>
        </div>
      </div>
    </div>
  );
}
