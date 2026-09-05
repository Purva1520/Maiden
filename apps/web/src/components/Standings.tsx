import type { Standings as StandingsData } from '../lib/domain.js';

/** Group standings table (§26). Rendered from Phase 9 standings; no recompute. */
export function Standings({
  standings,
  qualifiers,
}: {
  standings: StandingsData | null;
  qualifiers: number;
}): React.ReactElement {
  if (!standings || standings.table.length === 0) {
    return <div className="empty-state">Standings appear once the group stage begins.</div>;
  }
  return (
    <table className="standings">
      <thead>
        <tr>
          <th>#</th>
          <th>Team</th>
          <th>P</th>
          <th>W</th>
          <th>L</th>
          <th>Pts</th>
          <th>RD</th>
        </tr>
      </thead>
      <tbody>
        {standings.table.map((s, i) => (
          <tr
            key={s.teamId}
            className={`${s.isUser ? 'user' : ''} ${i < qualifiers ? 'qual' : ''} ${
              i === qualifiers ? 'qbar' : ''
            }`}
          >
            <td>{i + 1}</td>
            <td className="team">
              {s.isUser ? '★ ' : ''}
              {s.teamName}
            </td>
            <td>{s.played}</td>
            <td>{s.wins}</td>
            <td>{s.losses}</td>
            <td>
              <b>{s.points}</b>
            </td>
            <td>{s.runDifferential > 0 ? `+${s.runDifferential}` : s.runDifferential}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
