import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore, clearSave } from '../state/store.js';
import { ResultScreen } from '../components/ResultScreen.js';
import { Achievement } from '../components/Achievement.js';
import { ErrorState } from '../components/Feedback.js';

function lastUserMatchIndex(completed: readonly { userInvolved: boolean }[]): number {
  for (let i = completed.length - 1; i >= 0; i--) if (completed[i]!.userInvolved) return i;
  return -1;
}

/** Match / campaign result and achievements (§39, §40, §41). */
export function Result(): React.ReactElement {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const campaign = state.campaign;
  const idx = state.viewMatchIndex;
  const record = campaign && idx !== null ? campaign.completedMatches[idx] : undefined;

  useEffect(() => {
    if (!campaign || idx === null) navigate('/campaign', { replace: true });
  }, [campaign, idx, navigate]);

  if (!campaign || !record) {
    return (
      <ErrorState message="No result to display." backTo="/campaign" backLabel="Back to campaign" />
    );
  }

  const userId = campaign.userTeam.teamId;
  const userIsHome = record.homeTeamId === userId;
  const opponentName = userIsHome ? record.awayTeamName : record.homeTeamName;
  const user = record.userScore ?? (userIsHome ? record.homeScore : record.awayScore);
  const opp = record.opponentScore ?? (userIsHome ? record.awayScore : record.homeScore);

  const campaignDone = Boolean(campaign.result);
  const isDecider = idx === lastUserMatchIndex(campaign.completedMatches);
  const showAchievements = campaignDone && isDecider;
  const res = campaign.result;

  return (
    <main className="screen">
      <div className="container" style={{ maxWidth: 680 }}>
        <ResultScreen
          userTeamName={campaign.userTeam.name}
          opponentName={opponentName}
          userWon={record.userWon}
          isTie={record.isTie}
          marginText={record.summaryText}
          userRuns={user.runs}
          userWickets={user.wickets}
          oppRuns={opp.runs}
          oppWickets={opp.wickets}
        />

        {showAchievements && res && (
          <div className="stack gap-4 mt-6">
            {res.champion && (
              <Achievement name="🏆 CHAMPION" description="You won the Maiden World Cup." />
            )}
            {res.invincible && (
              <Achievement
                name="🔥 INVINCIBLE"
                description="You won every required campaign match — group stage to final."
              />
            )}
            {res.goldenInvincible && (
              <Achievement
                name="👑 GOLDEN INVINCIBLE"
                description="Every single victory was a thrashing. Total domination."
                golden
              />
            )}
            {!res.champion && (
              <div className="panel panel-pad center">
                <div className="eyebrow">Campaign over</div>
                <p className="muted mt-2">
                  Eliminated at the {res.qualificationStageReached.toLowerCase()} stage. Final
                  record {res.wins}–{res.losses}
                  {res.ties > 0 ? `–${res.ties}` : ''}.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="row gap-3 mt-6" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/scorecard')}>
            Full scorecard
          </button>
          {campaignDone && isDecider ? (
            <>
              <Link to="/campaign" className="btn btn-subtle">
                Review campaign
              </Link>
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={() => {
                  clearSave();
                  dispatch({ type: 'RESET' });
                  navigate('/');
                }}
              >
                New Game
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={() => navigate('/campaign')}
            >
              Continue Campaign →
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
