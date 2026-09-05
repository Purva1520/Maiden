import type { BallItem } from '../lib/matchView.js';
import { formatOvers } from '../lib/format.js';

function badge(b: BallItem): { cls: string; text: string } {
  if (b.outcome === 'WICKET') return { cls: 'wkt', text: 'W' };
  if (b.outcome === 'FOUR') return { cls: 'four', text: '4' };
  if (b.outcome === 'SIX') return { cls: 'six', text: '6' };
  if (b.runs === 0) return { cls: 'dot', text: '•' };
  return { cls: '', text: String(b.runs) };
}

function describe(b: BallItem): string {
  const ov = `${formatOvers(b.over * 6 + b.ball)}`;
  if (b.outcome === 'WICKET') return `${ov} — ${b.batter} b ${b.bowler}, OUT`;
  if (b.outcome === 'FOUR') return `${ov} — ${b.batter}, four`;
  if (b.outcome === 'SIX') return `${ov} — ${b.batter}, six`;
  if (b.runs === 0) return `${ov} — ${b.batter}, no run`;
  return `${ov} — ${b.batter}, ${b.runs} run${b.runs > 1 ? 's' : ''}`;
}

/** Chronological delivery feed (§33). Uses only real event data. */
export function BallFeed({ feed }: { feed: readonly BallItem[] }): React.ReactElement {
  if (feed.length === 0) return <div className="empty-state">No balls yet.</div>;
  return (
    <div className="ballfeed" role="log" aria-label="Ball by ball">
      {feed.map((b) => {
        const bg = badge(b);
        return (
          <div className="ball-row" key={b.key}>
            <span className="ball-ov">
              {b.over}.{b.ball}
            </span>
            <span className={`ball-badge ${bg.cls}`}>{bg.text}</span>
            <span className="ball-desc">{describe(b)}</span>
          </div>
        );
      })}
    </div>
  );
}
