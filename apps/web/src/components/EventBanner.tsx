import type { DeliveryFeedback } from '../presentation/match/eventText.js';

const MILESTONE_LABEL: Record<string, string> = {
  FIFTY: 'FIFTY',
  CENTURY: 'CENTURY',
  FIVE_WICKETS: 'FIVE-FOR',
};

/**
 * Full-bleed flash reserved for the highest-weight moments (§10, §19, §60):
 * wickets and milestones. Ordinary boundaries are emphasized in-line by
 * DeliveryReveal, not with a screen interruption.
 */
export function EventBanner({
  feedback,
  revealKey,
}: {
  feedback: DeliveryFeedback | null;
  revealKey: number | string;
}): React.ReactElement | null {
  if (!feedback) return null;
  const milestone = feedback.milestone;
  if (!feedback.isWicket && !milestone) return null;

  const label = milestone ? MILESTONE_LABEL[milestone.kind] : 'WICKET';
  const cls = feedback.isWicket ? 'wicket' : 'six';
  return (
    <div className="event-overlay" aria-hidden="true">
      <div key={revealKey} className={`event-pop ${cls}`}>
        {label}
      </div>
    </div>
  );
}
