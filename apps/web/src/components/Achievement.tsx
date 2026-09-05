/** Displays one campaign achievement (§40). Evaluation lives in the engine. */
export function Achievement({
  name,
  description,
  golden = false,
}: {
  name: string;
  description: string;
  golden?: boolean;
}): React.ReactElement {
  return (
    <div className={`achievement ${golden ? 'golden' : ''}`} role="status">
      <div className="badge">{name}</div>
      <div className="desc">{description}</div>
    </div>
  );
}
