import type { BatterLive } from '../lib/matchView.js';
import { formatStrikeRate } from '../lib/format.js';

/** Current batter statistics (§31). */
export function BatterCard({
  batter,
  striker = false,
}: {
  batter: BatterLive | null;
  striker?: boolean;
}): React.ReactElement {
  if (!batter) return <div className="pcard muted">—</div>;
  return (
    <div className="pcard">
      <div className="who">
        <span className="nm">
          {batter.name}
          {striker && (
            <span className="striker" title="On strike" aria-label="on strike">
              ★
            </span>
          )}
        </span>
        <span className="mono" style={{ fontWeight: 700 }}>
          {batter.runs} <span className="muted">({batter.balls})</span>
        </span>
      </div>
      <div className="line">
        <div>
          4s <b>{batter.fours}</b>
        </div>
        <div>
          6s <b>{batter.sixes}</b>
        </div>
        <div>
          SR <b>{formatStrikeRate(batter.runs, batter.balls)}</b>
        </div>
      </div>
    </div>
  );
}
