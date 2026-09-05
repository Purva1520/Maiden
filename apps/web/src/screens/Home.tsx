import { Link } from 'react-router-dom';
import { useStore, clearSave } from '../state/store.js';

/** Landing screen (§11). */
export function Home(): React.ReactElement {
  const { state, dispatch } = useStore();
  const hasGame = Boolean(state.gameState || state.campaign);

  return (
    <main className="center-screen">
      <div style={{ maxWidth: 560, textAlign: 'center' }}>
        <div className="eyebrow mb-3">Historical Cricket · Strategy</div>
        <h1 style={{ fontSize: 76, letterSpacing: '0.06em' }}>
          MAI<span style={{ color: 'var(--gold)' }}>DEN</span>
        </h1>
        <p className="muted mt-4" style={{ fontSize: 17, lineHeight: 1.6 }}>
          Build your XI from cricket history. Survive the campaign.
          <br />
          Become <span style={{ color: 'var(--gold-soft)' }}>Invincible</span>.
        </p>

        <div className="row gap-3 mt-6" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
          {hasGame ? (
            <>
              <Link
                to={
                  state.campaign
                    ? '/campaign'
                    : state.gameState?.rolledTeams.length
                      ? '/draft'
                      : '/format'
                }
                className="btn btn-primary btn-lg"
              >
                Resume Game
              </Link>
              <button
                type="button"
                className="btn btn-ghost btn-lg"
                onClick={() => {
                  clearSave();
                  dispatch({ type: 'RESET' });
                }}
              >
                New Game
              </button>
            </>
          ) : (
            <Link to="/format" className="btn btn-primary btn-lg">
              Play Maiden
            </Link>
          )}
        </div>

        <div className="panel panel-pad mt-6" style={{ textAlign: 'left' }}>
          <div className="panel-title mb-3">How it works</div>
          <ol className="muted" style={{ paddingLeft: 20, lineHeight: 1.9, fontSize: 14 }}>
            <li>Roll three historical World Cup squads.</li>
            <li>Draft a legal Playing XI from the combined pool.</li>
            <li>Set your captain and batting order.</li>
            <li>Fight through a World Cup campaign, match by match.</li>
            <li>Win every match to become Invincible — dominate to go Golden.</li>
          </ol>
        </div>
        <p className="faint mt-5" style={{ fontSize: 11 }}>
          Maiden v1 · deterministic historical simulation
        </p>
      </div>
    </main>
  );
}
