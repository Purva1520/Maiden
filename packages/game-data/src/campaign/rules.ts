import fs from 'node:fs';
import path from 'node:path';
import type { CricketFormat } from '../team/types.js';
import type { CampaignRulesConfig, FormatCampaignRules } from './types.js';

export const CAMPAIGN_RULES_VERSION = 'v1';

export const DEFAULT_CAMPAIGN_RULES: CampaignRulesConfig = {
  version: 'v1',
  points: {
    win: 2,
    tie: 1,
    loss: 0,
  },
  tieBreakerOrder: ['POINTS', 'RUN_DIFFERENTIAL', 'WINS', 'TEAM_ID'],
  ODI: {
    groupTeams: 8,
    qualifiers: 4,
    matchesPerTeam: 7,
    thrashing: {
      winByRuns: 50,
      winByWickets: 6,
      minBallsRemaining: 30,
    },
  },
  T20: {
    groupTeams: 8,
    qualifiers: 4,
    matchesPerTeam: 7,
    thrashing: {
      winByRuns: 30,
      winByWickets: 6,
      minBallsRemaining: 24,
    },
  },
};

function findProjectRoot(): string {
  let curr = process.cwd();
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(curr, 'data', 'game', 'campaign', 'campaign_rules_v1.json'))) {
      return curr;
    }
    const parent = path.dirname(curr);
    if (parent === curr) break;
    curr = parent;
  }
  return process.cwd();
}

let cachedConfig: CampaignRulesConfig | null = null;

export function loadCampaignRules(version: string = CAMPAIGN_RULES_VERSION): CampaignRulesConfig {
  if (version !== CAMPAIGN_RULES_VERSION) {
    throw new UnsupportedCampaignVersionError(
      `Unsupported campaign rules version: ${version} (supported: ${CAMPAIGN_RULES_VERSION})`,
    );
  }

  if (cachedConfig) {
    return cachedConfig;
  }

  const root = findProjectRoot();
  const filePath = path.join(root, 'data', 'game', 'campaign', `campaign_rules_${version}.json`);

  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      cachedConfig = JSON.parse(raw);
      return cachedConfig!;
    } catch {
      // Fallback to embedded default on read/parse failure
    }
  }

  cachedConfig = DEFAULT_CAMPAIGN_RULES;
  return cachedConfig;
}

export function getFormatCampaignRules(
  format: CricketFormat,
  config: CampaignRulesConfig = loadCampaignRules(),
): FormatCampaignRules {
  if (format === 'ODI') {
    return config.ODI;
  }
  if (format === 'T20') {
    return config.T20;
  }
  throw new InvalidCampaignConfigError(`Unknown cricket format: ${format}`);
}

// Domain Errors (§175)
export class CampaignError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CampaignError';
  }
}

export class CampaignAlreadyStartedError extends CampaignError {
  constructor(message: string = 'Campaign is already in progress.') {
    super(message);
    this.name = 'CampaignAlreadyStartedError';
  }
}

export class CampaignCompletedError extends CampaignError {
  constructor(message: string = 'Campaign has already completed.') {
    super(message);
    this.name = 'CampaignCompletedError';
  }
}

export class FixtureAlreadyPlayedError extends CampaignError {
  constructor(fixtureId: string) {
    super(`Fixture ${fixtureId} has already been played.`);
    this.name = 'FixtureAlreadyPlayedError';
  }
}

export class NoNextFixtureError extends CampaignError {
  constructor(message: string = 'No scheduled next fixture found.') {
    super(message);
    this.name = 'NoNextFixtureError';
  }
}

export class InvalidCampaignStateError extends CampaignError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCampaignStateError';
  }
}

export class InvalidOpponentError extends CampaignError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidOpponentError';
  }
}

export class QualificationError extends CampaignError {
  constructor(message: string) {
    super(message);
    this.name = 'QualificationError';
  }
}

export class InvalidCampaignConfigError extends CampaignError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCampaignConfigError';
  }
}

export class UnsupportedCampaignVersionError extends CampaignError {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedCampaignVersionError';
  }
}
