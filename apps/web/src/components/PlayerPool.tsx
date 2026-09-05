import { useMemo, useState } from 'react';
import type { PlayerCard as PlayerCardData, PlayerRole } from '../lib/domain.js';
import { PlayerCard } from './PlayerCard.js';

type Filter = 'ALL' | PlayerRole;
type Sort = 'ROLE' | 'NAME' | 'BAT' | 'BOWL';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'BAT', label: 'Batters' },
  { key: 'ALLROUNDER', label: 'All-rounders' },
  { key: 'WK', label: 'Keepers' },
  { key: 'BOWL', label: 'Bowlers' },
];

const ROLE_ORDER: Record<PlayerRole, number> = { BAT: 0, WK: 1, ALLROUNDER: 2, BOWL: 3 };

interface Props {
  pool: readonly PlayerCardData[];
  /** Canonical playerIds already used by the XI (one card per real player). */
  selectedPlayerIds: readonly string[];
  onSelect: (cardId: string) => void;
}

/** Searchable / filterable / sortable candidate pool (§18). */
export function PlayerPool({ pool, selectedPlayerIds, onSelect }: Props): React.ReactElement {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [sort, setSort] = useState<Sort>('ROLE');

  const selected = useMemo(() => new Set(selectedPlayerIds), [selectedPlayerIds]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = pool.filter((p) => {
      if (filter !== 'ALL' && p.role !== filter) return false;
      if (q && !p.playerName.toLowerCase().includes(q)) return false;
      return true;
    });
    list.sort((a, b) => {
      switch (sort) {
        case 'NAME':
          return a.playerName.localeCompare(b.playerName);
        case 'BAT':
          return (b.batRating ?? -1) - (a.batRating ?? -1);
        case 'BOWL':
          return (b.bowlRating ?? -1) - (a.bowlRating ?? -1);
        default:
          return (
            ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.playerName.localeCompare(b.playerName)
          );
      }
    });
    return list;
  }, [pool, query, filter, sort]);

  return (
    <div>
      <div className="searchbar mb-4">
        <input
          className="input"
          type="search"
          placeholder="Search players…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search players"
          style={{ flex: 1, minWidth: 160 }}
        />
        <select
          className="input"
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          aria-label="Sort players"
        >
          <option value="ROLE">Sort: Role</option>
          <option value="NAME">Sort: Name</option>
          <option value="BAT">Sort: Bat rating</option>
          <option value="BOWL">Sort: Bowl rating</option>
        </select>
      </div>
      <div className="searchbar mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`chip-toggle ${filter === f.key ? 'on' : ''}`}
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
          >
            {f.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="empty-state">No players match your filters.</div>
      ) : (
        <div className="grid" role="list">
          {shown.map((p) => (
            <div role="listitem" key={p.cardId}>
              <PlayerCard player={p} selected={selected.has(p.playerId)} onSelect={onSelect} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
