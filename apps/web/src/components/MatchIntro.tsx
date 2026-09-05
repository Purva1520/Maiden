import type { MatchResultDetail } from '../lib/domain.js';

interface Toss {
  winnerName: string;
  decision: 'bat' | 'field';
}

/** Pre-match intro (§74–§76). Uses real fixture + toss data. */
export function MatchIntro({
  stageLabel,
  userTeamName,
  opponentName,
  toss,
  onSkip,
}: {
  stageLabel: string;
  userTeamName: string;
  opponentName: string;
  toss: Toss | null;
  onSkip?: () => void;
  result?: MatchResultDetail;
}): React.ReactElement {
  return (
    <div className="match-intro" role="status">
      <div className="eyebrow">{stageLabel}</div>
      <div className="mi-teams">
        <span className="mi-team">{userTeamName}</span>
        <span className="mi-vs">vs</span>
        <span className="mi-team">{opponentName}</span>
      </div>
      {toss && (
        <div className="mi-toss muted mt-4">
          {toss.winnerName} won the toss and chose to {toss.decision === 'bat' ? 'bat' : 'field'}.
        </div>
      )}
      {onSkip && (
        <button type="button" className="btn btn-ghost btn-sm mt-5" onClick={onSkip}>
          Skip intro
        </button>
      )}
    </div>
  );
}
