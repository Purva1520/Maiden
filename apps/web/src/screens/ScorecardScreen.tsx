import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../state/store.js';
import type { MatchResult } from '../lib/domain.js';
import { Scorecard } from '../components/Scorecard.js';
import { ErrorState } from '../components/Feedback.js';

/** Full scorecard screen (§37, §38). */
export function ScorecardScreen(): React.ReactElement {
  const { state } = useStore();
  const navigate = useNavigate();
  const campaign = state.campaign;
  const idx = state.viewMatchIndex;
  const record = campaign && idx !== null ? campaign.completedMatches[idx] : undefined;
  const match = record?.fullResult as MatchResult | undefined;

  useEffect(() => {
    if (!campaign || idx === null) navigate('/campaign', { replace: true });
  }, [campaign, idx, navigate]);

  if (!record || !match) {
    return (
      <ErrorState
        message="Scorecard unavailable for this match."
        backTo="/campaign"
        backLabel="Back to campaign"
      />
    );
  }

  return (
    <main className="screen">
      <div className="container" style={{ maxWidth: 820 }}>
        <div className="row spread wrap mb-4">
          <div>
            <div className="eyebrow">Scorecard</div>
            <h1 style={{ fontSize: 30 }}>
              {record.homeTeamName} v {record.awayTeamName}
            </h1>
          </div>
          <div className="row gap-3">
            <button type="button" className="btn btn-ghost" onClick={() => navigate('/match')}>
              ← Match
            </button>
            <button type="button" className="btn btn-primary" onClick={() => navigate('/result')}>
              Result →
            </button>
          </div>
        </div>
        <Scorecard match={match} />
      </div>
    </main>
  );
}
