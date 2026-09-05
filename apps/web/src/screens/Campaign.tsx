import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../state/store.js';
import { api, ApiError, type GameConfig } from '../lib/api.js';
import { CampaignMap } from '../components/CampaignMap.js';
import { Standings } from '../components/Standings.js';
import { ErrorState } from '../components/Feedback.js';

function findLastUserMatch(completed: readonly { userInvolved: boolean }[]): number {
  for (let i = completed.length - 1; i >= 0; i--) if (completed[i]!.userInvolved) return i;
  return -1;
}

/** Campaign overview: journey, standings, record (§25, §26). */
export function Campaign(): React.ReactElement {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const campaign = state.campaign;
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!campaign) navigate('/', { replace: true });
  }, [campaign, navigate]);
  useEffect(() => {
    api
      .getConfig()
      .then(setConfig)
      .catch(() => undefined);
  }, []);

  if (!campaign) return <ErrorState message="No active campaign." />;

  const qualifiers = config?.campaignRules[campaign.format]?.qualifiers ?? 4;
  const userStanding = campaign.standings.table.find((s) => s.isUser);
  const done = campaign.status === 'COMPLETED' || campaign.status === 'ELIMINATED';

  const playNext = async (): Promise<void> => {
    setPlaying(true);
    setError(null);
    try {
      const next = await api.playNext(campaign);
      dispatch({ type: 'SET_CAMPAIGN', campaign: next });
      const idx = findLastUserMatch(next.completedMatches);
      if (idx >= 0) {
        dispatch({ type: 'VIEW_MATCH', index: idx });
        navigate('/match');
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not play the next match.');
    } finally {
      setPlaying(false);
    }
  };

  return (
    <main className="screen">
      <div className="container">
        <div className="row spread wrap mb-4">
          <div>
            <div className="eyebrow">Campaign · {campaign.format}</div>
            <h1 style={{ fontSize: 34 }}>{campaign.userTeam.name}</h1>
          </div>
          {userStanding && (
            <div className="row gap-5">
              <div className="sb-chip">
                <span className="k">Record</span>
                <span className="v">
                  {userStanding.wins}–{userStanding.losses}
                  {userStanding.ties > 0 ? `–${userStanding.ties}` : ''}
                </span>
              </div>
              <div className="sb-chip">
                <span className="k">Points</span>
                <span className="v">{userStanding.points}</span>
              </div>
              <div className="sb-chip">
                <span className="k">Position</span>
                <span className="v">
                  {campaign.standings.table.findIndex((s) => s.isUser) + 1}/
                  {campaign.standings.table.length}
                </span>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="status-banner status-incomplete mb-4" role="alert">
            {error}
          </div>
        )}

        {done && (
          <div
            className={`status-banner mb-4 ${campaign.result?.champion ? 'status-ready' : 'status-incomplete'}`}
          >
            {campaign.result?.champion ? 'Champion — campaign complete' : 'Campaign over'} ·{' '}
            <button
              className="btn btn-sm btn-subtle"
              type="button"
              onClick={() => {
                const idx = findLastUserMatch(campaign.completedMatches);
                dispatch({ type: 'VIEW_MATCH', index: idx });
                navigate('/result');
              }}
            >
              See result
            </button>
          </div>
        )}

        <div className="campaign-grid">
          <section className="panel panel-pad">
            <div className="panel-title mb-3">The road to the title</div>
            <CampaignMap
              campaign={campaign}
              onPlayNext={playNext}
              onViewMatch={(idx) => {
                dispatch({ type: 'VIEW_MATCH', index: idx });
                navigate('/result');
              }}
              playing={playing}
            />
          </section>
          <aside className="panel panel-pad" style={{ position: 'sticky', top: 72 }}>
            <div className="panel-title mb-3">Group standings</div>
            <Standings standings={campaign.standings} qualifiers={qualifiers} />
            <p className="faint mt-3" style={{ fontSize: 11.5 }}>
              Top {qualifiers} advance to the semifinals · dashed line marks the cut.
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}
