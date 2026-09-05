import type { HistoricalTeamReference } from '../lib/domain.js';

interface Props {
  team: HistoricalTeamReference;
  poolCount?: number;
  index?: number;
  reveal?: boolean;
}

/** One rolled historical World Cup team (§13). */
export function RollCard({
  team,
  poolCount,
  index = 0,
  reveal = false,
}: Props): React.ReactElement {
  return (
    <article
      className={`roll-card ${reveal ? 'reveal' : ''}`}
      style={reveal ? { animationDelay: `${index * 0.18}s` } : undefined}
    >
      <div>
        <div className="year">{team.year}</div>
        <div className="edition">
          {team.format === 'ODI' ? 'ICC World Cup' : 'ICC T20 World Cup'}
        </div>
      </div>
      <div>
        <div className="team">{team.teamName}</div>
        {typeof poolCount === 'number' && <div className="pool">{poolCount} squad players</div>}
      </div>
    </article>
  );
}
