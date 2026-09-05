import type { CricketFormat } from '../lib/domain.js';
import { badgeInfo } from '../presentation/players/historicalIdentity.js';

/** Compact, archival tournament badge (§41, §42). Generic over format + year. */
export function HistoricalBadge({
  format,
  year,
  size = 'sm',
}: {
  format: CricketFormat;
  year: number;
  size?: 'sm' | 'md';
}): React.ReactElement {
  const b = badgeInfo(format, year);
  return (
    <span className={`hbadge hbadge-${size}`} title={`${b.competition} ${b.year}`}>
      <span className="hbadge-comp">{b.competition}</span>
      <span className="hbadge-year mono">{b.year}</span>
    </span>
  );
}
