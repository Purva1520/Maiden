import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../state/store.js';
import { api, ApiError } from '../lib/api.js';
import { RollCard } from '../components/RollCard.js';
import { Loading, ErrorState } from '../components/Feedback.js';

/** Roll screen (§13, §14). The roll is the deterministic Phase 8 result. */
export function Roll(): React.ReactElement {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const rolling = useRef(false);
  const gs = state.gameState;

  useEffect(() => {
    if (!gs) {
      navigate('/format', { replace: true });
      return;
    }
    // Execute the roll exactly once (§14).
    if (gs.rolledTeams.length === 0 && !rolling.current) {
      rolling.current = true;
      api
        .roll(gs)
        .then((next) => dispatch({ type: 'SET_GAME_STATE', gameState: next }))
        .catch((e: ApiError) => setError(e.message));
    }
  }, [gs, dispatch, navigate]);

  const poolCounts = useMemo(() => {
    const counts = new Map<string, number>();
    if (gs) {
      for (const c of gs.availablePool) {
        const k = `${c.tournamentId}__${c.teamName}`;
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
    }
    return counts;
  }, [gs]);

  if (error)
    return (
      <ErrorState
        message={error}
        onRetry={() => location.reload()}
        backTo="/format"
        backLabel="Back to formats"
      />
    );
  if (!gs || gs.rolledTeams.length === 0) return <Loading message="Rolling historical squads…" />;

  return (
    <main className="screen">
      <div className="container">
        <div className="eyebrow">Step 2 · {gs.format}</div>
        <div className="row spread wrap mb-5">
          <h1 style={{ fontSize: 36 }}>Your roll</h1>
          <span className="faint mono">seed {gs.seed}</span>
        </div>

        <div className="roll-grid">
          {gs.rolledTeams.map((t, i) => (
            <RollCard
              key={t.tournamentId + t.teamName}
              team={t}
              index={i}
              reveal
              poolCount={poolCounts.get(`${t.tournamentId}__${t.teamName}`)}
            />
          ))}
        </div>

        <div className="panel panel-pad mt-5 row spread wrap gap-4">
          <div>
            <div className="panel-title">Combined player pool</div>
            <div className="stat" style={{ fontSize: 30, color: 'var(--text-strong)' }}>
              {gs.availablePool.length}{' '}
              <span className="muted" style={{ fontSize: 15 }}>
                players
              </span>
            </div>
          </div>
          <Link to="/draft" className="btn btn-primary btn-lg">
            Enter Draft
          </Link>
        </div>
      </div>
    </main>
  );
}
