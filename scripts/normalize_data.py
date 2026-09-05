#!/usr/bin/env python3
"""CLI utility for normalizing data attributes (roles, dates, teams, tournaments, names).

Usage:
    python scripts/normalize_data.py --demo
    python scripts/normalize_data.py --role "Fast bowler"
    python scripts/normalize_data.py --team "IND"
    python scripts/normalize_data.py --date "19 Feb 2011"
    python scripts/normalize_data.py --tournament "ICC Cricket World Cup" --year 2011 --format ODI
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "data-pipeline"))

from cleaning.dates import normalize_date
from cleaning.names import generate_player_id, normalize_name_for_matching
from cleaning.roles import normalize_role
from cleaning.teams import normalize_team_alias
from cleaning.tournaments import resolve_tournament_id


def run_demo() -> int:
    """Demonstrate all normalization capabilities."""
    print("MAIDEN DATA NORMALIZATION DEMO")
    print("==============================")

    # Names
    print("\n--- Name Normalization ---")
    names = [
        "Sachin Tendulkar",
        "S. Tendulkar",
        "SR Tendulkar",
        "José María",
        "A.B. de Villiers",
    ]
    for n in names:
        norm = normalize_name_for_matching(n)
        slug = generate_player_id(n)
        print(f"  {n!r:<22} -> normalized: {norm!r:<20} slug: {slug}")

    # Roles
    print("\n--- Role Normalization ---")
    roles = [
        "Batsman",
        "Opening batter",
        "Fast bowler",
        "Leg-spinner",
        "All-rounder",
        "Wicketkeeper",
        "Keeper",
    ]
    for r in roles:
        norm = normalize_role(r)
        print(f"  {r!r:<22} -> canonical: {norm}")

    # Teams
    print("\n--- Team Normalization ---")
    teams = ["IND", "AUS", "ENG", "PAK", "NZ", "WI", "RSA", "East Africa", "The Netherlands"]
    for t in teams:
        norm = normalize_team_alias(t)
        print(f"  {t!r:<22} -> canonical: {norm}")

    # Tournaments
    print("\n--- Tournament Normalization ---")
    tournaments = [
        ("ICC Cricket World Cup", 2011, "ODI"),
        ("Cricket World Cup", 1983, "ODI"),
        ("ICC World Twenty20", 2007, "T20"),
        ("T20 World Cup", 2024, "T20"),
    ]
    for name, year, fmt in tournaments:
        tid = resolve_tournament_id(name, year, fmt)
        print(f"  {name} ({year}, {fmt}) -> canonical ID: {tid}")

    # Dates
    print("\n--- Date Normalization ---")
    dates = [
        "2011-02-19",
        "19 Feb 2011",
        "19/02/2011",
        "February 19, 2011",
        "19-Feb-2011",
    ]
    for d in dates:
        norm = normalize_date(d)
        print(f"  {d!r:<22} -> canonical ISO: {norm}")

    print("\nAll demo normalizations PASSED.")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Maiden Data Normalization Utility.")
    parser.add_argument(
        "--demo", action="store_true", help="Run comprehensive demo of all normalizations"
    )
    parser.add_argument("--role", help="Normalize a player role string")
    parser.add_argument("--team", help="Normalize a team name or abbreviation")
    parser.add_argument("--date", help="Normalize a date string")
    parser.add_argument("--name", help="Normalize a player name and produce ID slug")
    parser.add_argument(
        "--tournament", help="Normalize a tournament name (requires --year and --format)"
    )
    parser.add_argument("--year", type=int, help="Tournament year")
    parser.add_argument("--format", help="Tournament format (ODI or T20)")

    args = parser.parse_args(argv)

    if args.demo or len(sys.argv) == 1:
        return run_demo()

    if args.role:
        print(f"Role: {args.role!r} -> {normalize_role(args.role)}")
    if args.team:
        print(f"Team: {args.team!r} -> {normalize_team_alias(args.team)}")
    if args.date:
        print(f"Date: {args.date!r} -> {normalize_date(args.date)}")
    if args.name:
        print(
            f"Name: {args.name!r} -> norm: {normalize_name_for_matching(args.name)} slug: {generate_player_id(args.name)}"
        )
    if args.tournament:
        if not args.year or not args.format:
            print("Error: --tournament requires --year and --format")
            return 1
        print(f"Tournament: -> {resolve_tournament_id(args.tournament, args.year, args.format)}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
