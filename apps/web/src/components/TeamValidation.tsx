import type { XIValidationResult } from '../lib/domain.js';

function Check({
  ok,
  label,
  count,
}: {
  ok: boolean;
  label: string;
  count?: string;
}): React.ReactElement {
  return (
    <div className="check-row">
      <span className={`check-icon ${ok ? 'check-pass' : 'check-fail'}`} aria-hidden="true">
        {ok ? '✓' : '✕'}
      </span>
      <span className="check-label">{label}</span>
      {count && <span className="check-count">{count}</span>}
      <span className="sr-only">{ok ? 'requirement met' : 'requirement not met'}</span>
    </div>
  );
}

/** Maps the Phase 8 validator output to UI (§21). Never re-implements the rules. */
export function TeamValidation({
  validation,
  hasPlayers,
}: {
  validation: XIValidationResult | null;
  hasPlayers: boolean;
}): React.ReactElement {
  if (!validation) {
    return <div className="empty-state">Select players to see validation.</div>;
  }
  const c = validation.checks;
  return (
    <div>
      <Check
        ok={c.playerCount.valid}
        label="Eleven players"
        count={`${c.playerCount.actual}/${c.playerCount.required}`}
      />
      <Check
        ok={c.wicketkeeper.valid}
        label="Wicketkeeper"
        count={`${c.wicketkeeper.count}/${c.wicketkeeper.required}`}
      />
      <Check
        ok={c.bowlingOptions.valid}
        label="Bowling options"
        count={`${c.bowlingOptions.actual}/${c.bowlingOptions.required}`}
      />
      <Check
        ok={c.topOrder.valid}
        label="Top-order cover"
        count={`${c.topOrder.actual}/${c.topOrder.required}`}
      />
      <Check ok={c.duplicatePlayers.valid} label="No duplicate players" />
      <Check ok={c.captain.valid} label="Captain chosen" />

      {validation.warnings.length > 0 && (
        <ul className="mt-3 muted" style={{ fontSize: 12.5, paddingLeft: 18 }}>
          {validation.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      <div
        className={`status-banner mt-4 ${validation.valid ? 'status-ready' : 'status-incomplete'}`}
        role="status"
      >
        {validation.valid
          ? 'XI Ready'
          : hasPlayers
            ? (validation.errors[0] ?? 'Incomplete XI')
            : 'Draft in progress'}
      </div>
    </div>
  );
}
