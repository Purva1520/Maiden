import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../state/store.js';
import { api, ApiError } from '../lib/api.js';
import type { MaidenGameState, PlayerCard, XIValidationResult } from '../lib/domain.js';
import { PlayerPool } from '../components/PlayerPool.js';
import { SquadCard } from '../components/SquadCard.js';
import { XIBuilder } from '../components/XIBuilder.js';
import { TeamValidation } from '../components/TeamValidation.js';
import { ErrorState } from '../components/Feedback.js';

/** Draft screen (§15–§23). All mutations run through the Phase 8 engine. */
export function Draft(): React.ReactElement {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const gs = state.gameState;
  const [validation, setValidation] = useState<XIValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!gs || gs.rolledTeams.length === 0) navigate('/format', { replace: true });
  }, [gs, navigate]);

  const cardMap = useMemo(() => {
    const m = new Map<string, PlayerCard>();
    if (gs) for (const c of gs.availablePool) m.set(c.cardId, c);
    return m;
  }, [gs]);

  const orderedCards = useMemo(
    () =>
      gs ? gs.battingOrder.map((id) => cardMap.get(id)).filter((c): c is PlayerCard => !!c) : [],
    [gs, cardMap],
  );
  const selectedPlayerIds = useMemo(() => orderedCards.map((c) => c.playerId), [orderedCards]);

  // Live validation via the real validator (§19, §21).
  useEffect(() => {
    if (!gs || gs.selectedPlayerIds.length === 0) return;
    let cancelled = false;
    api
      .validate(gs)
      .then((v) => !cancelled && setValidation(v))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [gs]);

  const shownValidation = orderedCards.length === 0 ? null : validation;

  const run = useCallback(
    async (fn: (s: MaidenGameState) => Promise<MaidenGameState>) => {
      if (!gs || busy) return;
      setBusy(true);
      setError(null);
      try {
        const next = await fn(gs);
        dispatch({ type: 'SET_GAME_STATE', gameState: next });
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Action failed.');
      } finally {
        setBusy(false);
      }
    },
    [gs, busy, dispatch],
  );

  if (!gs) return <ErrorState message="No active draft." backTo="/format" backLabel="Start over" />;

  const xiSize = 11;

  return (
    <main className="screen">
      <div className="container">
        <div className="row spread wrap mb-4">
          <div>
            <div className="eyebrow">Step 3 · Draft</div>
            <h1 style={{ fontSize: 34 }}>Build your XI</h1>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-lg"
            disabled={!validation?.valid}
            onClick={() => navigate('/xi')}
          >
            Review XI →
          </button>
        </div>

        {error && (
          <div className="status-banner status-incomplete mb-4" role="alert">
            {error}
          </div>
        )}

        <div className="draft-cols">
          <section className="panel panel-pad">
            <div className="panel-title mb-4">
              Available pool · {gs.availablePool.length - orderedCards.length} of{' '}
              {gs.availablePool.length}
            </div>
            <div className="squad-summary">
              {gs.rolledTeams.map((t) => {
                const inTeam = (c: PlayerCard): boolean =>
                  c.tournamentId === t.tournamentId && c.teamName === t.teamName;
                return (
                  <SquadCard
                    key={t.tournamentId + t.teamName}
                    team={t}
                    poolCount={gs.availablePool.filter(inTeam).length}
                    selectedCount={orderedCards.filter(inTeam).length}
                  />
                );
              })}
            </div>
            <PlayerPool
              pool={gs.availablePool}
              selectedPlayerIds={selectedPlayerIds}
              onSelect={(cardId) => run((s) => api.select(s, cardId))}
            />
          </section>

          <aside className="stack gap-4" style={{ position: 'sticky', top: 72 }}>
            <div className="panel panel-pad">
              <XIBuilder
                ordered={orderedCards}
                xiSize={xiSize}
                captainId={gs.captainId}
                onRemove={(cardId) => run((s) => api.remove(s, cardId))}
                onSetCaptain={(cardId) => run((s) => api.setCaptain(s, cardId))}
                onReorder={(order) => run((s) => api.setBattingOrder(s, order))}
              />
            </div>
            <div className="panel panel-pad">
              <div className="panel-title mb-3">Team validation</div>
              <TeamValidation validation={shownValidation} hasPlayers={orderedCards.length > 0} />
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
