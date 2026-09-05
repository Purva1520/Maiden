import type { PlayerRole } from '../lib/domain.js';
import { ROLE_SHORT, roleLabel } from '../lib/roles.js';

/** Compact, consistent role indicator used everywhere (§17). */
export function RoleChip({ role }: { role: PlayerRole }): React.ReactElement {
  return (
    <span className={`role-chip role-${role}`} title={roleLabel(role)} aria-label={roleLabel(role)}>
      <span className="role-dot" aria-hidden="true" />
      {ROLE_SHORT[role]}
    </span>
  );
}
