/**
 * Maiden game API (Phase 10).
 *
 * Stateless endpoints over the Phase 8/9 domain engine. The browser holds the
 * canonical serializable game/campaign state and posts it back for each
 * transition; the server never keeps session state. All cricket/game rules live
 * in @maiden/game-data — these routes only marshal domain calls (§49, §52).
 */
import type { FastifyInstance } from 'fastify';
import {
  ODI_YEARS,
  T20_YEARS,
  getTeamRules,
  createGame,
  rollTeams,
  selectPlayerInDraft,
  removePlayerInDraft,
  replacePlayerInDraft,
  setCaptainInDraft,
  setBattingOrderInDraft,
  validateDraft,
  finalizeXI,
  createCampaign,
  startCampaign,
  playNextMatch,
  loadCampaignRules,
  type CricketFormat,
  type MaidenGameState,
  type MaidenTeam,
  type CampaignState,
} from '@maiden/game-data';

/** Narrow an unknown format string to CricketFormat, defaulting to ODI. */
function asFormat(value: unknown): CricketFormat {
  return value === 'T20' ? 'T20' : 'ODI';
}

/** Wrap a domain call so thrown Errors become clean HTTP 400s. */
function domain<T>(fn: () => T): { ok: true; value: T } | { ok: false; error: string } {
  try {
    return { ok: true, value: fn() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function registerGameRoutes(app: FastifyInstance): Promise<void> {
  // --- Configuration (formats, rules) -------------------------------------
  app.get('/api/config', async () => {
    const campaignRules = loadCampaignRules();
    return {
      formats: {
        ODI: {
          years: ODI_YEARS,
          editions: ODI_YEARS.length,
          overs: 50,
          rules: getTeamRules('ODI'),
        },
        T20: {
          years: T20_YEARS,
          editions: T20_YEARS.length,
          overs: 20,
          rules: getTeamRules('T20'),
        },
      },
      campaignRules,
    };
  });

  // --- Game / draft lifecycle ---------------------------------------------
  app.post('/api/game/create', async (req, reply) => {
    const body = req.body as { format?: unknown; seed?: unknown };
    const seed = Number(body.seed);
    const r = domain(() =>
      createGame(asFormat(body.format), Number.isFinite(seed) ? Math.trunc(seed) : Date.now()),
    );
    return r.ok ? r.value : reply.code(400).send({ error: r.error });
  });

  app.post('/api/game/roll', async (req, reply) => {
    const { state } = req.body as { state: MaidenGameState };
    const r = domain(() => rollTeams(state));
    return r.ok ? r.value : reply.code(400).send({ error: r.error });
  });

  app.post('/api/game/select', async (req, reply) => {
    const { state, cardId } = req.body as { state: MaidenGameState; cardId: string };
    const r = domain(() => selectPlayerInDraft(state, cardId));
    return r.ok ? r.value : reply.code(400).send({ error: r.error });
  });

  app.post('/api/game/remove', async (req, reply) => {
    const { state, cardId } = req.body as { state: MaidenGameState; cardId: string };
    const r = domain(() => removePlayerInDraft(state, cardId));
    return r.ok ? r.value : reply.code(400).send({ error: r.error });
  });

  app.post('/api/game/replace', async (req, reply) => {
    const { state, outCardId, inCardId } = req.body as {
      state: MaidenGameState;
      outCardId: string;
      inCardId: string;
    };
    const r = domain(() => replacePlayerInDraft(state, outCardId, inCardId));
    return r.ok ? r.value : reply.code(400).send({ error: r.error });
  });

  app.post('/api/game/captain', async (req, reply) => {
    const { state, cardId } = req.body as { state: MaidenGameState; cardId: string };
    const r = domain(() => setCaptainInDraft(state, cardId));
    return r.ok ? r.value : reply.code(400).send({ error: r.error });
  });

  app.post('/api/game/batting-order', async (req, reply) => {
    const { state, order } = req.body as { state: MaidenGameState; order: string[] };
    const r = domain(() => setBattingOrderInDraft(state, order));
    return r.ok ? r.value : reply.code(400).send({ error: r.error });
  });

  app.post('/api/game/validate', async (req, reply) => {
    const { state } = req.body as { state: MaidenGameState };
    const r = domain(() => validateDraft(state));
    return r.ok ? r.value : reply.code(400).send({ error: r.error });
  });

  app.post('/api/game/finalize', async (req, reply) => {
    const { state, teamName } = req.body as { state: MaidenGameState; teamName?: string };
    const r = domain(() => finalizeXI(state, teamName ?? 'Maiden XI'));
    return r.ok ? r.value : reply.code(400).send({ error: r.error });
  });

  // --- Campaign lifecycle --------------------------------------------------
  app.post('/api/campaign/create', async (req, reply) => {
    const body = req.body as { team: MaidenTeam; format?: unknown; seed?: unknown };
    const seed = Number(body.seed);
    const r = domain(() =>
      createCampaign(
        body.team,
        asFormat(body.format),
        Number.isFinite(seed) ? Math.trunc(seed) : 0,
      ),
    );
    return r.ok ? r.value : reply.code(400).send({ error: r.error });
  });

  app.post('/api/campaign/start', async (req, reply) => {
    const { state } = req.body as { state: CampaignState };
    const r = domain(() => startCampaign(state));
    return r.ok ? r.value : reply.code(400).send({ error: r.error });
  });

  app.post('/api/campaign/play-next', async (req, reply) => {
    const { state } = req.body as { state: CampaignState };
    const r = domain(() => playNextMatch(state));
    return r.ok ? r.value : reply.code(400).send({ error: r.error });
  });
}
