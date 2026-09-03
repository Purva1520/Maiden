"""Parser tests using compact fixtures (not the full Cricsheet archive)."""

from __future__ import annotations

import pytest
from parsers import ParseError, parse_match


def test_match_metadata(odi_json):
    m = parse_match("odi1", "odi1.json", odi_json)
    assert m.format == "ODI"
    assert m.match_type == "ODI"
    assert m.gender == "male"
    assert m.season == "2023/24"
    assert m.venue == "Test Oval"
    assert m.city == "Testville"
    assert m.balls_per_over == 6
    assert m.overs == 50
    assert m.dates == ["2024-01-01"]
    assert m.event_name == "Maiden Test ODI Series"
    assert m.event_match_number == 1


def test_teams_and_players(odi_json):
    m = parse_match("odi1", "odi1.json", odi_json)
    assert m.teams == ["Alpha", "Beta"]
    assert m.players_by_team["Alpha"] == ["A One", "A Two"]
    assert m.registry["A One"] == "aaa00001"
    assert m.player_of_match == ["A One"]


def test_officials(odi_json):
    m = parse_match("odi1", "odi1.json", odi_json)
    assert m.officials["umpires"] == ["U First", "U Second"]
    assert m.officials["match_referees"] == ["R Ref"]


def test_toss_and_result(odi_json):
    m = parse_match("odi1", "odi1.json", odi_json)
    assert m.toss_winner == "Alpha"
    assert m.toss_decision == "bat"
    assert m.outcome_winner == "Alpha"
    assert m.result_type == "runs"
    assert m.result_margin == 10
    assert m.result_text == "Alpha won by 10 runs"


def test_innings_overs_deliveries(odi_json):
    m = parse_match("odi1", "odi1.json", odi_json)
    assert len(m.innings) == 2
    first = m.innings[0]
    assert first.innings_number == 1
    assert first.team == "Alpha"
    over = first.overs[0]
    assert over.over_number == 0
    assert len(over.deliveries) == 3


def test_runs_extras_wickets(odi_json):
    m = parse_match("odi1", "odi1.json", odi_json)
    deliveries = m.innings[0].overs[0].deliveries
    assert deliveries[0].batter_runs == 4
    assert deliveries[0].total_runs == 4
    # wide
    assert deliveries[1].extras == {"wides": 1}
    assert deliveries[1].extra_runs == 1
    # wicket with fielder
    wk = deliveries[2].wickets[0]
    assert wk.player_out == "A One"
    assert wk.kind == "caught"
    assert wk.fielders == [("B Two", False)]


def test_tie_with_eliminator(t20_json):
    m = parse_match("t20a", "t20a.json", t20_json)
    assert m.format == "T20"
    assert m.result_type == "tie"
    assert m.eliminator_winner == "Gamma"
    assert "tied" in m.result_text.lower()
    # run-out with two fielders
    wk = m.innings[1].overs[0].deliveries[0].wickets[0]
    assert wk.kind == "run out"
    assert len(wk.fielders) == 2


def test_malformed_missing_info():
    with pytest.raises(ParseError):
        parse_match("bad", "bad.json", {"meta": {}, "innings": []})


def test_malformed_wrong_team_count():
    bad = {"info": {"match_type": "ODI", "teams": ["Only One"]}, "innings": []}
    with pytest.raises(ParseError):
        parse_match("bad", "bad.json", bad)


def test_malformed_unknown_format():
    bad = {"info": {"match_type": "Test", "teams": ["A", "B"]}, "innings": []}
    with pytest.raises(ParseError):
        parse_match("bad", "bad.json", bad)


def test_malformed_delivery_missing_runs():
    bad = {
        "info": {"match_type": "ODI", "teams": ["A", "B"], "registry": {"people": {}}},
        "innings": [
            {"team": "A", "overs": [{"over": 0, "deliveries": [{"batter": "x", "bowler": "y", "non_striker": "z"}]}]}
        ],
    }
    with pytest.raises(ParseError):
        parse_match("bad", "bad.json", bad)
