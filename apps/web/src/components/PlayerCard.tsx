import type { PlayerCard as PlayerCardData } from '../lib/domain.js';
import { formatRating } from '../lib/format.js';
import { isLegend } from '../presentation/players/historicalIdentity.js';
import { RoleChip } from './RoleChip.js';
import { HistoricalBadge } from './HistoricalBadge.js';

interface Props {
  player: PlayerCardData;
  selected?: boolean;
  onSelect?: (cardId: string) => void;
  disabled?: boolean;
  actionLabel?: string;
}

/**
 * One historical player card (§16, §39, §40). Name dominates; ratings support;
 * the historical badge and Legend treatment reinforce Maiden's premise. Legend
 * is presentation-only (§44) — it never affects ratings or legality.
 */
export function PlayerCard({
  player,
  selected = false,
  onSelect,
  disabled = false,
  actionLabel,
}: Props): React.ReactElement {
  const showBowl =
    player.role === 'BOWL' || player.role === 'ALLROUNDER' || player.bowlRating !== null;
  const clickable = Boolean(onSelect) && !selected && !disabled;
  const legend = isLegend(player);

  const Wrapper = clickable ? 'button' : 'div';
  return (
    <Wrapper
      className={`player-card ${selected ? 'is-selected' : ''} ${legend ? 'is-legend' : ''}`}
      onClick={clickable ? () => onSelect?.(player.cardId) : undefined}
      disabled={clickable ? disabled : undefined}
      aria-pressed={onSelect ? selected : undefined}
      type={clickable ? 'button' : undefined}
    >
      {selected && <span className="pc-selected-flag">Selected</span>}
      <div className="stack gap-2">
        <span className="pc-name">{player.playerName}</span>
        <div className="row gap-2 wrap">
          <RoleChip role={player.role} />
          {legend && (
            <span className="legend-tag" title="Legend — elite historical rating">
              ★ Legend
            </span>
          )}
        </div>
        <div className="row gap-2 wrap" style={{ alignItems: 'center' }}>
          <HistoricalBadge format={player.format} year={player.year} />
          <span className="pc-meta">{player.teamName}</span>
        </div>
      </div>
      <div className="pc-ratings">
        <div className="pc-rating">
          {player.batRating === null ? (
            <span className="val unrated">unrated</span>
          ) : (
            <span className="val">{formatRating(player.batRating)}</span>
          )}
          <span className="lbl">Bat</span>
        </div>
        {showBowl && (
          <div className="pc-rating">
            {player.bowlRating === null ? (
              <span className="val unrated">—</span>
            ) : (
              <span className="val">{formatRating(player.bowlRating)}</span>
            )}
            <span className="lbl">Bowl</span>
          </div>
        )}
      </div>
      {actionLabel && clickable && (
        <span className="pc-meta right" aria-hidden="true">
          {actionLabel}
        </span>
      )}
    </Wrapper>
  );
}
