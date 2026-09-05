import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../state/store.js';
import { useMatchPresentation, type Speed } from '../hooks/useMatchPresentation.js';
import type { MatchResult } from '../lib/domain.js';
import { overSequence } from '../presentation/match/eventText.js';
import { Scoreboard } from '../components/Scoreboard.js';
import { BatterCard } from '../components/BatterCard.js';
import { BowlerCard } from '../components/BowlerCard.js';
import { BallFeed } from '../components/BallFeed.js';
import { DeliveryReveal } from '../components/DeliveryReveal.js';
import { EventBanner } from '../components/EventBanner.js';
import { OverBreak } from '../components/OverBreak.js';
import { InningsBreak } from '../components/InningsBreak.js';
import { MatchIntro } from '../components/MatchIntro.js';
import { ErrorState } from '../components/Feedback.js';

const SPEEDS: Speed[] = [0.5, 1, 2, 4];

function stageLabel(stage: string, matchNumber: number): string {
  if (stage === 'SEMIFINAL') return 'Semifinal';
  if (stage === 'FINAL') return 'The Final';
  return `Group Stage · Match ${matchNumber}`;
}

/** Live match — event-driven reveal, transitions and feedback (§7–§30). */
export function Match(): React.ReactElement {
  const { state } = useStore();
  const navigate = useNavigate();
  const campaign = state.campaign;
  const idx = state.viewMatchIndex;
  const record = campaign && idx !== null ? campaign.completedMatches[idx] : undefined;
  const match = (record?.fullResult as MatchResult | undefined) ?? null;

  const pb = useMatchPresentation(match);

  useEffect(() => {
    if (!campaign || idx === null) navigate('/campaign', { replace: true });
  }, [campaign, idx, navigate]);

  const overBreak = useMemo(() => {
    if (pb.stage !== 'OVER_BREAK' || !pb.ball) return null;
    const cur = pb.ball;
    const overBalls = pb.balls.filter(
      (b, i) => i <= pb.index && b.inningsNumber === cur.inningsNumber && b.over === cur.over,
    );
    return {
      overNumber: cur.over + 1,
      sequence: overSequence(overBalls),
      runsThisOver: overBalls.reduce((s, b) => s + b.runs, 0),
    };
  }, [pb.stage, pb.ball, pb.balls, pb.index]);

  if (!campaign || idx === null || !record) {
    return (
      <ErrorState message="No match to display." backTo="/campaign" backLabel="Back to campaign" />
    );
  }
  if (!match || !pb.hasEvents) {
    return (
      <main className="screen">
        <div className="container center">
          <p className="muted mb-4">
            Ball-by-ball playback isn’t available for this restored match.
          </p>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/result')}>
            See result
          </button>
        </div>
      </main>
    );
  }

  const { view, stage } = pb;
  const userIsHome = record.homeTeamId === campaign.userTeam.teamId;
  const opponentName = userIsHome ? record.awayTeamName : record.homeTeamName;
  const label = stageLabel(record.stage, record.matchNumber);

  return (
    <main className="screen">
      <div className="container" style={{ maxWidth: 880 }}>
        <div className="eyebrow mb-3">
          {label} · {campaign.format}
        </div>

        {stage !== 'INTRO' && (
          <div className="panel panel-pad mb-4">
            <Scoreboard view={view} />
          </div>
        )}

        {/* Centre stage — swaps by presentation phase */}
        {stage === 'INTRO' && (
          <div className="panel panel-pad center mb-4">
            <MatchIntro
              stageLabel={label}
              userTeamName={campaign.userTeam.name}
              opponentName={opponentName}
              toss={match.toss}
              onSkip={pb.next}
            />
          </div>
        )}

        {stage === 'BALL' && pb.ball && pb.feedback && (
          <div className="panel panel-pad mb-4">
            <DeliveryReveal ball={pb.ball} feedback={pb.feedback} />
          </div>
        )}

        {stage === 'OVER_BREAK' && overBreak && (
          <div className="panel panel-pad mb-4">
            <OverBreak
              overNumber={overBreak.overNumber}
              sequence={overBreak.sequence}
              runsThisOver={overBreak.runsThisOver}
              battingTeamName={view.battingTeamName}
              runs={view.runs}
              wickets={view.wickets}
              legalBalls={view.legalBalls}
              striker={view.striker}
              nonStriker={view.nonStriker}
              bowler={view.bowler}
            />
          </div>
        )}

        {stage === 'INNINGS_BREAK' && (
          <div className="panel panel-pad mb-4">
            <InningsBreak
              innings={view.inningsNumber === 1 ? match.innings1 : match.innings2}
              target={match.innings1.runs + 1}
              chasingTeamName={match.innings2.battingTeamName}
            />
          </div>
        )}

        {stage === 'COMPLETE' && (
          <div className="panel panel-pad center mb-4">
            <div className="eyebrow">Match complete</div>
            <p style={{ fontSize: 18, marginTop: 8 }}>{match.result.text}</p>
          </div>
        )}

        {stage !== 'INTRO' && (
          <div className="grid grid-2 mb-4">
            <div className="stack gap-2">
              <span className="panel-title">Batting</span>
              <BatterCard batter={view.striker} striker />
              <BatterCard batter={view.nonStriker} />
            </div>
            <div className="stack gap-2">
              <span className="panel-title">Bowling</span>
              <BowlerCard bowler={view.bowler} />
            </div>
          </div>
        )}

        <div className="panel panel-pad mb-4">
          <div className="row spread wrap gap-3 mb-4">
            <div className="row gap-2 wrap">
              <button
                type="button"
                className="btn btn-subtle btn-sm"
                onClick={pb.next}
                disabled={pb.isComplete}
              >
                Next ball
              </button>
              {pb.isPlaying ? (
                <button type="button" className="btn btn-subtle btn-sm" onClick={pb.pause}>
                  Pause
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={pb.play}
                  disabled={pb.isComplete}
                >
                  Auto-play
                </button>
              )}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={pb.skipToEnd}
                disabled={pb.isComplete}
              >
                Skip to result
              </button>
            </div>
            <div className="row gap-1" role="group" aria-label="Playback speed">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`chip-toggle ${pb.speed === s ? 'on' : ''}`}
                  onClick={() => pb.setSpeed(s)}
                  aria-pressed={pb.speed === s}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>
          <BallFeed feed={view.feed} />
        </div>

        <div className="row spread wrap gap-3">
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/scorecard')}>
            Full scorecard
          </button>
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={() => navigate('/result')}
          >
            {pb.isComplete ? 'See result →' : 'Skip to result →'}
          </button>
        </div>
      </div>

      <EventBanner feedback={stage === 'BALL' ? pb.feedback : null} revealKey={pb.index} />
    </main>
  );
}
