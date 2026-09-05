import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../state/store.js';
import { api, ApiError, type GameConfig } from '../lib/api.js';
import type { CricketFormat } from '../lib/domain.js';
import { Loading, ErrorState } from '../components/Feedback.js';

/** Format selection (§12). Reads edition counts from the real config. */
export function FormatSelection(): React.ReactElement {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [choice, setChoice] = useState<CricketFormat>(state.format ?? 'ODI');

  useEffect(() => {
    api
      .getConfig()
      .then(setConfig)
      .catch((e: ApiError) => setError(e.message));
  }, []);

  const start = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const seed = Math.floor(Math.random() * 1_000_000_000);
      dispatch({ type: 'SET_FORMAT', format: choice });
      const gameState = await api.createGame(choice, seed);
      dispatch({ type: 'SET_GAME', gameState, seed });
      navigate('/roll');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not start a new game.');
      setBusy(false);
    }
  };

  if (error && !config) return <ErrorState message={error} onRetry={() => location.reload()} />;
  if (!config) return <Loading message="Loading formats…" />;

  const cards: { key: CricketFormat; blurb: string }[] = [
    { key: 'ODI', blurb: '50-over cricket · longer, tactical campaigns' },
    { key: 'T20', blurb: '20-over cricket · higher volatility, faster games' },
  ];

  return (
    <main className="screen">
      <div className="container" style={{ maxWidth: 760 }}>
        <div className="eyebrow">Step 1</div>
        <h1 className="mb-5" style={{ fontSize: 36 }}>
          Choose your format
        </h1>
        <div className="grid grid-2">
          {cards.map(({ key, blurb }) => {
            const f = config.formats[key];
            return (
              <button
                key={key}
                type="button"
                className={`panel panel-pad ${choice === key ? '' : ''}`}
                onClick={() => setChoice(key)}
                aria-pressed={choice === key}
                style={{
                  textAlign: 'left',
                  cursor: 'pointer',
                  borderColor: choice === key ? 'var(--gold)' : undefined,
                  boxShadow: choice === key ? '0 0 0 1px var(--gold-dim)' : undefined,
                }}
              >
                <div className="row spread">
                  <h2 style={{ fontSize: 30 }}>{key}</h2>
                  <span
                    className="check-icon"
                    style={{
                      background: choice === key ? 'var(--gold)' : 'transparent',
                      color: '#201704',
                      border: '1px solid var(--line)',
                    }}
                    aria-hidden="true"
                  >
                    {choice === key ? '✓' : ''}
                  </span>
                </div>
                <p className="muted mt-2">{blurb}</p>
                <div className="row gap-5 mt-4">
                  <div className="sb-chip">
                    <span className="k">Editions</span>
                    <span className="v">{f.editions}</span>
                  </div>
                  <div className="sb-chip">
                    <span className="k">Overs</span>
                    <span className="v">{f.overs}</span>
                  </div>
                  <div className="sb-chip">
                    <span className="k">XI</span>
                    <span className="v">{f.rules.xiSize}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {error && (
          <p className="mt-4" style={{ color: 'var(--loss)' }}>
            {error}
          </p>
        )}

        <div className="row gap-3 mt-6">
          <button type="button" className="btn btn-primary btn-lg" onClick={start} disabled={busy}>
            {busy ? 'Starting…' : 'Continue'}
          </button>
        </div>
      </div>
    </main>
  );
}
