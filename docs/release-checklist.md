# Maiden — Release Checklist

Run before tagging a release. The automated gate covers most of this; the manual
items are the human playthrough.

## Automated gate

```bash
pnpm install
pnpm validate:production   # must print "RESULT: PASS"
pnpm validate:deep         # must print "RESULT: PASS"
pnpm audit --prod          # resolve or document advisories
```

`validate:production` runs, in order and stopping on first failure:

- [ ] Typecheck (strict TS)
- [ ] Lint (ESLint, 0 errors)
- [ ] Format check (Prettier)
- [ ] All Vitest suites (unit → simulation regression)
- [ ] Python tests (`pytest`: data + ratings)
- [ ] Database integrity (`PRAGMA integrity_check` / `foreign_key_check`)
- [ ] Simulation-config validation
- [ ] Production build (web + API)

`validate:deep` adds:

- [ ] Calibration regression — 12k innings/format within the Phase 7 envelope
- [ ] Campaign smoke — 100 deterministic campaigns complete cleanly

## Versioned artifacts (traceability)

- [ ] App version (root `package.json`)
- [ ] Data / ratings version — `ratings_v1.json` (`ratingVersion`)
- [ ] Simulation config — `data/game/simulation/simulation_config_v1.json`
      (`simulationVersion`, `calibrationVersion`)
- [ ] Campaign rules — `data/game/campaign/campaign_rules_v1.json` (`version`)
- [ ] Save schema — `maiden_save_v1` (schema v1)

## Production configuration

- [ ] `VITE_API_BASE_URL` set for the target environment (`.env`)
- [ ] No secrets committed; no debug-only behavior in production
- [ ] No dev fixtures or mock data on production paths

## Manual playthrough (the human gate)

- [ ] Home → Format → Roll → Draft → XI → Campaign → Match → Scorecard → Result
- [ ] Ball-by-ball reveal: dot, boundary, wicket, over break, innings break, chase
- [ ] Refresh mid-flow → state restores
- [ ] Reach a knockout stage; verify Champion / Invincible / Golden Invincible copy
- [ ] Mobile + desktop layouts usable

## Documentation

- [ ] [`testing.md`](testing.md), [`balance.md`](balance.md),
      [`known-limitations.md`](known-limitations.md), [`debugging.md`](debugging.md)
      current
- [ ] Changelog / release notes updated with real changes only
