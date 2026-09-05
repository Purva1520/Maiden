import type { BallItem } from '../lib/matchView.js';
import type { DeliveryFeedback } from '../presentation/match/eventText.js';
import { formatOvers } from '../lib/format.js';

const MILESTONE_LABEL: Record<string, string> = {
  FIFTY: 'FIFTY',
  CENTURY: 'CENTURY',
  FIVE_WICKETS: 'FIVE WICKETS',
};

/**
 * The delivery story (§7, §9, §14): over.ball · bowler → batter, then the
 * outcome and a supporting line. Intensity drives the visual weight.
 */
export function DeliveryReveal({
  ball,
  feedback,
}: {
  ball: BallItem;
  feedback: DeliveryFeedback;
}): React.ReactElement {
  return (
    <div className={`delivery-reveal intensity-${feedback.intensity}`} aria-live="polite">
      <div className="dr-context">
        <span className="dr-ovnum mono">{formatOvers(ball.over * 6 + ball.ball)}</span>
        <span className="dr-matchup">
          <span className="dr-bowler">{ball.bowler}</span>
          <span className="dr-to">to</span>
          <span className="dr-batter">{ball.batter}</span>
        </span>
      </div>

      <div
        key={`${ball.key}`}
        className={`dr-outcome ${feedback.isWicket ? 'wkt' : feedback.isBoundary ? 'boundary' : 'run'}`}
      >
        {feedback.headline}
      </div>

      {feedback.milestone && (
        <div className="dr-milestone" role="status">
          {MILESTONE_LABEL[feedback.milestone.kind]} · {feedback.milestone.name}
          {feedback.milestone.runs !== undefined && (
            <span className="mono">
              {' '}
              {feedback.milestone.runs} ({feedback.milestone.balls})
            </span>
          )}
        </div>
      )}

      {feedback.detail && <div className="dr-detail">{feedback.detail}</div>}
    </div>
  );
}
