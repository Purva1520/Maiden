import { useState } from 'react';
import type { PlayerCard } from '../lib/domain.js';
import { RoleChip } from './RoleChip.js';

interface Props {
  /** Selected cards in batting order (position 1..N). */
  ordered: readonly PlayerCard[];
  xiSize: number;
  captainId: string | null;
  onRemove: (cardId: string) => void;
  onSetCaptain: (cardId: string) => void;
  onReorder: (newOrder: string[]) => void;
  editable?: boolean;
}

/** Displays and edits the selected XI as a batting lineup (§20, §23). */
export function XIBuilder({
  ordered,
  xiSize,
  captainId,
  onRemove,
  onSetCaptain,
  onReorder,
  editable = true,
}: Props): React.ReactElement {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const move = (from: number, to: number): void => {
    if (to < 0 || to >= ordered.length || from === to) return;
    const ids = ordered.map((c) => c.cardId);
    const [m] = ids.splice(from, 1);
    ids.splice(to, 0, m!);
    onReorder(ids);
  };

  return (
    <div>
      <div className="panel-head">
        <span className="panel-title">Playing XI</span>
        <span className="xi-count">
          {ordered.length}
          <span className="muted" style={{ fontSize: 15 }}>
            /{xiSize}
          </span>
        </span>
      </div>

      {ordered.length === 0 ? (
        <div className="empty-state">No players selected yet.</div>
      ) : (
        <ol className="xi-list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {ordered.map((card, i) => (
            <li
              key={card.cardId}
              className={`xi-row ${dragIndex === i ? 'dragging' : ''}`}
              draggable={editable}
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex !== null) move(dragIndex, i);
                setDragIndex(null);
              }}
              onDragEnd={() => setDragIndex(null)}
            >
              <span className="xi-pos">{i + 1}</span>
              <span className="xi-name">
                {card.playerName}
                {captainId === card.cardId && (
                  <span className="cap" title="Captain">
                    (C)
                  </span>
                )}
                <span style={{ marginLeft: 8 }}>
                  <RoleChip role={card.role} />
                </span>
              </span>

              {editable ? (
                <span className="row gap-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-subtle"
                    onClick={() => onSetCaptain(card.cardId)}
                    disabled={captainId === card.cardId}
                    aria-label={`Make ${card.playerName} captain`}
                  >
                    {captainId === card.cardId ? 'Captain' : 'Make C'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() => onRemove(card.cardId)}
                    aria-label={`Remove ${card.playerName}`}
                  >
                    ✕
                  </button>
                </span>
              ) : (
                <span />
              )}

              {editable ? (
                <span className="row gap-1" aria-hidden="false">
                  <button
                    type="button"
                    className="xi-handle"
                    onClick={() => move(i, i - 1)}
                    aria-label={`Move ${card.playerName} up`}
                    disabled={i === 0}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="xi-handle"
                    onClick={() => move(i, i + 1)}
                    aria-label={`Move ${card.playerName} down`}
                    disabled={i === ordered.length - 1}
                  >
                    ↓
                  </button>
                </span>
              ) : (
                <span />
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
