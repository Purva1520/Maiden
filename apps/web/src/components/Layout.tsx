import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

const STEPS: { label: string; match: string[] }[] = [
  { label: 'Roll', match: ['/roll'] },
  { label: 'Draft', match: ['/draft'] },
  { label: 'XI', match: ['/xi'] },
  { label: 'Campaign', match: ['/campaign'] },
  { label: 'Match', match: ['/match', '/scorecard', '/result'] },
];

/** Top bar with wordmark and phase progress (§56). */
export function Layout({ children }: { children: ReactNode }): React.ReactElement {
  const { pathname } = useLocation();
  const activeIndex = STEPS.findIndex((s) => s.match.some((m) => pathname.startsWith(m)));

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="container topbar-inner">
          <Link to="/" className="wordmark">
            MAI<span>DEN</span>
          </Link>
          {activeIndex >= 0 && (
            <nav className="progress" aria-label="Progress">
              {STEPS.map((s, i) => (
                <span key={s.label} className="row gap-1">
                  {i > 0 && (
                    <span className="progress-sep" aria-hidden="true">
                      ›
                    </span>
                  )}
                  <span
                    className={`progress-step ${
                      i === activeIndex ? 'active' : i < activeIndex ? 'done' : ''
                    }`}
                    aria-current={i === activeIndex ? 'step' : undefined}
                  >
                    {s.label}
                  </span>
                </span>
              ))}
            </nav>
          )}
        </div>
      </header>
      {children}
    </div>
  );
}
