/* eslint-disable react-refresh/only-export-components --
   This module intentionally co-exports the StoreProvider component with its
   useStore hook and clearSave helper; they belong together as the state API. */
/**
 * Canonical Maiden application state (§9) with versioned localStorage
 * persistence (§10). One source of truth; screens derive their view from it.
 * Game rules never live here — only the serializable domain state the engine
 * produced.
 */
import { createContext, useContext, useEffect, useReducer, useRef, type ReactNode } from 'react';
import type { CricketFormat, MaidenGameState, MaidenTeam, CampaignState } from '../lib/domain.js';

const SAVE_KEY = 'maiden_save_v1';
const SAVE_VERSION = 1;

export interface MaidenAppState {
  version: number;
  format: CricketFormat | null;
  seed: number | null;
  gameState: MaidenGameState | null;
  team: MaidenTeam | null;
  campaign: CampaignState | null;
  /** Index into campaign.completedMatches for the Match/Scorecard/Result view. */
  viewMatchIndex: number | null;
}

const EMPTY: MaidenAppState = {
  version: SAVE_VERSION,
  format: null,
  seed: null,
  gameState: null,
  team: null,
  campaign: null,
  viewMatchIndex: null,
};

type Action =
  | { type: 'SET_FORMAT'; format: CricketFormat }
  | { type: 'SET_GAME'; gameState: MaidenGameState; seed: number }
  | { type: 'SET_GAME_STATE'; gameState: MaidenGameState }
  | { type: 'SET_TEAM'; team: MaidenTeam }
  | { type: 'SET_CAMPAIGN'; campaign: CampaignState }
  | { type: 'VIEW_MATCH'; index: number | null }
  | { type: 'RESTORE'; state: MaidenAppState }
  | { type: 'RESET' };

function reducer(state: MaidenAppState, action: Action): MaidenAppState {
  switch (action.type) {
    case 'SET_FORMAT':
      return { ...state, format: action.format };
    case 'SET_GAME':
      return {
        ...state,
        gameState: action.gameState,
        seed: action.seed,
        team: null,
        campaign: null,
      };
    case 'SET_GAME_STATE':
      return { ...state, gameState: action.gameState };
    case 'SET_TEAM':
      return { ...state, team: action.team };
    case 'SET_CAMPAIGN':
      return { ...state, campaign: action.campaign };
    case 'VIEW_MATCH':
      return { ...state, viewMatchIndex: action.index };
    case 'RESTORE':
      return action.state;
    case 'RESET':
      return { ...EMPTY };
    default:
      return state;
  }
}

/** Remove heavy delivery-event arrays before persisting to keep under quota. */
function slimForStorage(state: MaidenAppState): MaidenAppState {
  if (!state.campaign) return state;
  const c = state.campaign as CampaignState;
  const strip = (m: unknown): unknown => {
    const rec = m as { fullResult?: unknown };
    if (!rec.fullResult) return m;
    const fr = rec.fullResult as {
      events?: unknown;
      innings1?: { events?: unknown };
      innings2?: { events?: unknown };
    };
    return {
      ...rec,
      fullResult: {
        ...fr,
        events: [],
        innings1: fr.innings1 ? { ...fr.innings1, events: [] } : fr.innings1,
        innings2: fr.innings2 ? { ...fr.innings2, events: [] } : fr.innings2,
      },
    };
  };
  return {
    ...state,
    campaign: {
      ...c,
      completedMatches: (c.completedMatches as unknown[]).map(strip),
    } as CampaignState,
  };
}

function loadSaved(): MaidenAppState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MaidenAppState;
    if (!parsed || parsed.version !== SAVE_VERSION) return null;
    return parsed;
  } catch {
    return null; // corrupted save -> start fresh (§10, §45)
  }
}

interface StoreValue {
  state: MaidenAppState;
  dispatch: React.Dispatch<Action>;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [state, dispatch] = useReducer(reducer, EMPTY, (init) => loadSaved() ?? init);
  const first = useRef(true);

  useEffect(() => {
    // Skip persisting the very first (freshly-restored) render.
    if (first.current) {
      first.current = false;
      return;
    }
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch {
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(slimForStorage(state)));
      } catch {
        /* storage unavailable — game still works in-memory */
      }
    }
  }, [state]);

  return <StoreContext.Provider value={{ state, dispatch }}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}
