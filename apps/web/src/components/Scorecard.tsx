import type { InningsResult, MatchResult } from '../lib/domain.js';
import { formatOvers, formatScore, formatStrikeRate, formatEconomy } from '../lib/format.js';

function InningsCard({ innings }: { innings: InningsResult }): React.ReactElement {
  const bowlerName = new Map(innings.bowlingCard.map((b) => [b.playerId, b.name]));
  const batted = innings.battingCard.filter((b) => b.batted);
  return (
    <div className="panel panel-pad mb-4">
      <div className="panel-head">
        <h3 style={{ fontSize: 18 }}>{innings.battingTeamName}</h3>
        <span className="stat" style={{ fontSize: 18 }}>
          {formatScore(innings.runs, innings.wickets)} ({formatOvers(innings.legalBalls)})
        </span>
      </div>

      <div className="sc-scroll">
        <table className="sc-table">
          <thead>
            <tr>
              <th>Batter</th>
              <th style={{ textAlign: 'left' }}>Dismissal</th>
              <th>R</th>
              <th>B</th>
              <th>4s</th>
              <th>6s</th>
              <th>SR</th>
            </tr>
          </thead>
          <tbody>
            {batted.map((b) => (
              <tr key={b.playerId}>
                <td className="nm">{b.name}</td>
                <td className="dismissal">
                  {b.dismissed
                    ? `b ${b.dismissalBowler ? (bowlerName.get(b.dismissalBowler) ?? b.dismissalBowler) : ''}`
                    : 'not out'}
                </td>
                <td>
                  <b>{b.runs}</b>
                </td>
                <td>{b.balls}</td>
                <td>{b.fours}</td>
                <td>{b.sixes}</td>
                <td>{formatStrikeRate(b.runs, b.balls)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {innings.fallOfWickets.length > 0 && (
        <p className="muted mt-3" style={{ fontSize: 12 }}>
          <b className="faint">Fall:</b>{' '}
          {innings.fallOfWickets
            .map(
              (f) => `${f.score}/${f.wicketNumber} (${f.batterName}, ${formatOvers(f.legalBalls)})`,
            )
            .join('  ·  ')}
        </p>
      )}

      <div className="sc-scroll mt-4">
        <table className="sc-table">
          <thead>
            <tr>
              <th>Bowler</th>
              <th>O</th>
              <th>M</th>
              <th>R</th>
              <th>W</th>
              <th>Econ</th>
            </tr>
          </thead>
          <tbody>
            {innings.bowlingCard
              .filter((b) => b.balls > 0)
              .map((b) => (
                <tr key={b.playerId}>
                  <td className="nm">{b.name}</td>
                  <td>{formatOvers(b.balls)}</td>
                  <td>{b.maidens}</td>
                  <td>{b.runs}</td>
                  <td>
                    <b>{b.wickets}</b>
                  </td>
                  <td>{formatEconomy(b.runs, b.balls)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Full professional-style scorecard for a completed match (§37). */
export function Scorecard({ match }: { match: MatchResult }): React.ReactElement {
  return (
    <div>
      <div className="panel panel-pad mb-4 center">
        <div className="eyebrow">Result</div>
        <p style={{ fontSize: 17, marginTop: 6 }}>{match.result.text}</p>
      </div>
      <InningsCard innings={match.innings1} />
      <InningsCard innings={match.innings2} />
    </div>
  );
}
