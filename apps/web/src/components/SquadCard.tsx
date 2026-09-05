import type { HistoricalTeamReference } from '../lib/domain.js';

/** Compact historical-squad context chip for the draft (§60). */
export function SquadCard({
  team,
  poolCount,
  selectedCount = 0,
}: {
  team: HistoricalTeamReference;
  poolCount: number;
  selectedCount?: number;
}): React.ReactElement {
  return (
    <div className="squad-card" title={`${team.teamName} ${team.year}`}>
      <span className="sc-year mono">{team.year}</span>
      <span className="sc-team">{team.teamName}</span>
      <span className="sc-count mono">
        {selectedCount > 0 ? `${selectedCount} picked · ` : ''}
        {poolCount} avail.
      </span>
    </div>
  );
}
