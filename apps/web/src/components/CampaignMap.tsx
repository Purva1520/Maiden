import type { CampaignState, Fixture } from '../lib/domain.js';

const STAGE_LABEL: Record<string, string> = {
  GROUP: 'Group Stage',
  SEMIFINAL: 'Semifinal',
  FINAL: 'Final',
};

interface Props {
  campaign: CampaignState;
  onPlayNext: () => void;
  onViewMatch: (completedIndex: number) => void;
  playing: boolean;
}

/** The user's campaign journey (§25). Uses real Phase 9 fixtures only. */
export function CampaignMap({
  campaign,
  onPlayNext,
  onViewMatch,
  playing,
}: Props): React.ReactElement {
  const userId = campaign.userTeam.teamId;
  const userFixtures = campaign.fixtures.filter((f) => f.isUserMatch);
  const nextFixture = userFixtures.find((f) => f.status === 'SCHEDULED');

  const opponentName = (f: Fixture): string =>
    f.homeTeamId === userId ? f.awayTeamName : f.homeTeamName;

  const completedIndexFor = (f: Fixture): number =>
    campaign.completedMatches.findIndex((m) => m.fixtureId === f.fixtureId && m.userInvolved);

  const byStage: Record<'GROUP' | 'SEMIFINAL' | 'FINAL', Fixture[]> = {
    GROUP: userFixtures.filter((f) => f.stage === 'GROUP'),
    SEMIFINAL: userFixtures.filter((f) => f.stage === 'SEMIFINAL'),
    FINAL: userFixtures.filter((f) => f.stage === 'FINAL'),
  };

  return (
    <div>
      {(['GROUP', 'SEMIFINAL', 'FINAL'] as const).map((stage) =>
        byStage[stage].length === 0 ? null : (
          <section key={stage}>
            <div className="stage-label">{STAGE_LABEL[stage]}</div>
            <div className="stack gap-2">
              {byStage[stage].map((f, i) => {
                const rec = f.status === 'COMPLETED' ? f.result : undefined;
                const isNext = nextFixture?.fixtureId === f.fixtureId;
                let cls = 'locked';
                let tag = 'Locked';
                if (rec) {
                  if (rec.isTie) {
                    cls = '';
                    tag = 'Tied';
                  } else if (rec.userWon) {
                    cls = 'won';
                    tag = 'Won';
                  } else {
                    cls = 'lost';
                    tag = 'Lost';
                  }
                } else if (isNext) {
                  cls = 'next';
                  tag = 'Next';
                }
                return (
                  <div key={f.fixtureId} className={`fixture-card ${cls}`}>
                    <span className="fx-num">
                      {stage === 'GROUP' ? `M${i + 1}` : stage === 'SEMIFINAL' ? 'SF' : 'F'}
                    </span>
                    <div>
                      <div className="fx-opp">vs {opponentName(f)}</div>
                      {rec && (
                        <div className="muted" style={{ fontSize: 12 }}>
                          {rec.summaryText}
                        </div>
                      )}
                    </div>
                    <div className="row gap-3">
                      <span className={`fx-tag ${cls}`}>{tag}</span>
                      {rec ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-subtle"
                          onClick={() => onViewMatch(completedIndexFor(f))}
                        >
                          View
                        </button>
                      ) : isNext ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={onPlayNext}
                          disabled={playing}
                        >
                          {playing ? 'Playing…' : 'Play'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ),
      )}
    </div>
  );
}
