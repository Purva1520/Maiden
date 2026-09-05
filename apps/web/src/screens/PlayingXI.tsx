import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../state/store.js';
import { api, ApiError } from '../lib/api.js';
import type { MaidenGameState, PlayerCard, XIValidationResult } from '../lib/domain.js';
import { XIBuilder } from '../components/XIBuilder.js';
import { ErrorState, Loading } from '../components/Feedback.js';

/** Finalize the XI and enter the campaign (§23, §24). */
export function PlayingXI(): React.ReactElement {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const gs = state.gameState;
  const [validation, setValidation] = useState<XIValidationResult | null>(null);
  const [teamName, setTeamName] = useState('Maiden Legends XI');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!gs || gs.selectedPlayerIds.length === 0) {
      navigate('/draft', { replace: true });
      return;
    }
    api
      .validate(gs)
      .then(setValidation)
      .catch(() => undefined);
  }, [gs, navigate]);

  const cardMap = useMemo(() => {
    const m = new Map<string, PlayerCard>();
    if (gs) for (const c of gs.availablePool) m.set(c.cardId, c);
    return m;
  }, [gs]);
  const ordered = useMemo(
    () =>
      gs ? gs.battingOrder.map((id) => cardMap.get(id)).filter((c): c is PlayerCard => !!c) : [],
    [gs, cardMap],
  );

  const run = useCallback(
    async (fn: (s: MaidenGameState) => Promise<MaidenGameState>) => {
      if (!gs) return;
      const next = await fn(gs);
      dispatch({ type: 'SET_GAME_STATE', gameState: next });
      api
        .validate(next)
        .then(setValidation)
        .catch(() => undefined);
    },
    [gs, dispatch],
  );

  const enterCampaign = async (): Promise<void> => {
    if (!gs || !state.format || state.seed === null) return;
    setBusy(true);
    setError(null);
    try {
      const { team } = await api.finalize(gs, teamName.trim() || 'Maiden XI');
      dispatch({ type: 'SET_TEAM', team });
      const created = await api.createCampaign(team, state.format, state.seed);
      const started = await api.startCampaign(created);
      dispatch({ type: 'SET_CAMPAIGN', campaign: started });
      navigate('/campaign');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not enter the campaign.');
      setBusy(false);
    }
  };

  if (!gs) return <ErrorState message="No active game." backTo="/format" backLabel="Start over" />;
  if (busy) return <Loading message="Preparing your campaign…" />;

  const captainName = ordered.find((c) => c.cardId === gs.captainId)?.playerName;

  return (
    <main className="screen">
      <div className="container" style={{ maxWidth: 720 }}>
        <div className="eyebrow">Step 4</div>
        <h1 className="mb-2" style={{ fontSize: 36 }}>
          Your XI
        </h1>
        <p className="muted mb-5">
          Set your batting order and captain. Once you enter the campaign, this XI is locked.
        </p>

        <div className="panel panel-pad mb-4">
          <label className="panel-title" htmlFor="teamname">
            Team name
          </label>
          <input
            id="teamname"
            className="input mt-2"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            style={{ width: '100%' }}
            maxLength={40}
          />
        </div>

        <div className="panel panel-pad mb-4">
          <XIBuilder
            ordered={ordered}
            xiSize={11}
            captainId={gs.captainId}
            onRemove={(cardId) => run((s) => api.remove(s, cardId))}
            onSetCaptain={(cardId) => run((s) => api.setCaptain(s, cardId))}
            onReorder={(order) => run((s) => api.setBattingOrder(s, order))}
          />
        </div>

        {error && (
          <div className="status-banner status-incomplete mb-4" role="alert">
            {error}
          </div>
        )}

        <div className="row spread wrap gap-3">
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/draft')}>
            ← Back to draft
          </button>
          <div className="row gap-4">
            {captainName && (
              <span className="muted">
                Captain: <b style={{ color: 'var(--gold-soft)' }}>{captainName}</b>
              </span>
            )}
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={enterCampaign}
              disabled={!validation?.valid}
            >
              Enter Campaign
            </button>
          </div>
        </div>
        {!validation?.valid && (
          <p className="faint mt-3" style={{ fontSize: 12.5 }}>
            Your XI must be valid before entering the campaign.
          </p>
        )}
      </div>
    </main>
  );
}
