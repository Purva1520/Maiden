import { formatScore } from '../lib/format.js';

interface Props {
  userTeamName: string;
  opponentName: string;
  userWon: boolean;
  isTie: boolean;
  marginText: string;
  userRuns: number;
  userWickets: number;
  oppRuns: number;
  oppWickets: number;
}

/** High-emotion match result hero (§39). */
export function ResultScreen({
  userTeamName,
  opponentName,
  userWon,
  isTie,
  marginText,
  userRuns,
  userWickets,
  oppRuns,
  oppWickets,
}: Props): React.ReactElement {
  const verdict = isTie ? 'TIED' : userWon ? 'WON' : 'LOST';
  const tone = isTie ? '' : userWon ? 'won' : 'lost';
  return (
    <div className="result-hero">
      <div className="eyebrow">{userTeamName}</div>
      <div className={`result-verdict ${tone}`}>{verdict}</div>
      <div className="result-margin">{marginText}</div>
      <div className="result-teams">
        {userTeamName} {formatScore(userRuns, userWickets)} · {opponentName}{' '}
        {formatScore(oppRuns, oppWickets)}
      </div>
    </div>
  );
}
