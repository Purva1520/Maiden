import { Link } from 'react-router-dom';

/** Polished loading state (§44). */
export function Loading({ message = 'Loading…' }: { message?: string }): React.ReactElement {
  return (
    <div className="loading-wrap" role="status" aria-live="polite">
      <div className="spinner" aria-hidden="true" />
      <div className="msg">{message}</div>
    </div>
  );
}

/** Readable error state with recovery (§45). Never shows raw stack traces. */
export function ErrorState({
  message,
  onRetry,
  backTo = '/',
  backLabel = 'Return home',
}: {
  message: string;
  onRetry?: () => void;
  backTo?: string;
  backLabel?: string;
}): React.ReactElement {
  return (
    <div className="loading-wrap">
      <p style={{ maxWidth: 420 }}>{message}</p>
      <div className="row gap-3">
        {onRetry && (
          <button type="button" className="btn btn-primary" onClick={onRetry}>
            Try again
          </button>
        )}
        <Link to={backTo} className="btn btn-ghost">
          {backLabel}
        </Link>
      </div>
    </div>
  );
}
