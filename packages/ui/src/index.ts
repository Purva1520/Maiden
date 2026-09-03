/**
 * @maiden/ui — reusable visual components for Maiden.
 *
 * Phase 0 status: STRUCTURAL PLACEHOLDER ONLY.
 *
 * The Maiden design system does not exist yet. Real components (PlayerCard,
 * Scoreboard, DraftCard, RollCard, MatchFeed, CampaignMap, etc.) belong to the
 * frontend phase (Phase 10) and are intentionally NOT built here. This single
 * placeholder exists only to verify the package can be imported and type-checked.
 */
import type { ReactElement } from 'react';
import { createElement } from 'react';

/** Package identifier, used by smoke tests to confirm the package is importable. */
export const UI_PACKAGE = '@maiden/ui' as const;

/** Minimal placeholder component. Not part of the future design system. */
export function Placeholder(): ReactElement {
  return createElement('div', null, 'Maiden UI placeholder');
}
