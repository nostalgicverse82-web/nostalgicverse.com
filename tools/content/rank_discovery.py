#!/usr/bin/env python3
"""
NostalgicVerse — Discovery & Ranking Engine (Build-Time Offline Tool)
====================================================================
Analyzes authoritative archive data, scores historical significance,
evaluates content completeness, measures era/genre/console distributions,
identifies content/asset gaps, and produces a deterministic ranking artifact
for homepage curation and exploration.

Outputs:
  data/discovery-rankings.json
"""

import json
import os
import sys
import datetime
from pathlib import Path
from collections import Counter, defaultdict

# Project root resolution
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent
DATA_DIR = PROJECT_ROOT / "data"
GAMES_DIR = DATA_DIR / "games"
CONSOLES_DIR = DATA_DIR / "consoles"

def load_json(filepath):
    """Safely load JSON with BOM stripping and fallback handling."""
    if not filepath.exists():
        return None
    with open(filepath, "r", encoding="utf-8-sig") as f:
        return json.load(f)

def score_game_record(game, exhibit_detail=None):
    """
    Calculate transparent multi-factor discovery score for a game.
    Factors:
      - Historical Significance (0 - 35)
      - Content Completeness (0 - 30)
      - Relationship Richness (0 - 20)
      - Archival Exhibit Depth (0 - 15)
    Max base score = 100
    """
    score = 0
    breakdown = {}

    # 1. Historical Significance (0 - 35)
    sig_score = 15  # baseline for cataloged games
    summary = game.get("historicalSignificance") or game.get("shortDescription") or ""
    if exhibit_detail:
        summary = exhibit_detail.get("historicalSignificance") or summary
    
    landmark_terms = [
        "defined", "pioneered", "breakthrough", "revolution", "industry",
        "iconic", "seminal", "landmark", "monumental", "cultural", "revitalized"
    ]
    summary_lower = summary.lower()
    matches = sum(1 for term in landmark_terms if term in summary_lower)
    sig_score += min(matches * 3, 15)
    
    if game.get("featured"):
        sig_score += 5
    sig_score = min(sig_score, 35)
    breakdown["historical_significance"] = sig_score
    score += sig_score

    # 2. Content Completeness (0 - 30)
    comp_score = 0
    if game.get("title"): comp_score += 3
    if game.get("originalReleaseYear"): comp_score += 3
    if game.get("developer"): comp_score += 3
    if game.get("publisher"): comp_score += 2
    if game.get("originalLaunchPlatform"): comp_score += 3
    if game.get("genre"): comp_score += 3
    if summary and len(summary) > 50: comp_score += 5
    if game.get("keywords") and len(game.get("keywords")) >= 3: comp_score += 3
    if exhibit_detail and exhibit_detail.get("gameplayOverview"): comp_score += 3
    if exhibit_detail and exhibit_detail.get("technicalSignificance"): comp_score += 2
    comp_score = min(comp_score, 30)
    breakdown["completeness"] = comp_score
    score += comp_score

    # 3. Relationship Richness (0 - 20)
    rel_score = 0
    platforms = game.get("platforms") or []
    if platforms: rel_score += min(len(platforms) * 2, 8)
    if exhibit_detail:
        rel_exhibits = exhibit_detail.get("relatedExhibits") or {}
        related_games = rel_exhibits.get("games") or []
        related_consoles = rel_exhibits.get("consoles") or []
        rel_score += min(len(related_games) * 2, 6)
        rel_score += min(len(related_consoles) * 2, 6)
    rel_score = min(rel_score, 20)
    breakdown["relationships"] = rel_score
    score += rel_score

    # 4. Archival Exhibit Depth (0 - 15)
    depth_score = 0
    slug = game.get("slug")
    if slug and (GAMES_DIR / f"{slug}.json").exists():
        depth_score += 10
    detail_html = PROJECT_ROOT / "games" / (slug or "") / "index.html"
    if slug and detail_html.exists():
        depth_score += 5
    breakdown["exhibit_depth"] = depth_score
    score += depth_score

    return score, breakdown

def score_console_record(console):
    """
    Calculate transparent multi-factor score for a console.
    """
    score = 0
    breakdown = {}

    # Historical Significance (0 - 40)
    sig_score = 20
    name_lower = console.get("name", "").lower()
    mfg_lower = console.get("manufacturer", "").lower()
    pillar_mfgs = ["nintendo", "sega", "sony", "atari", "microsoft", "snk", "nec"]
    if any(m in mfg_lower for m in pillar_mfgs):
        sig_score += 10
    if console.get("significance"):
        sig_score += 10
    breakdown["historical_significance"] = min(sig_score, 40)
    score += breakdown["historical_significance"]

    # Technical Completeness (0 - 30)
    tech_score = 0
    facts = console.get("verifiedFactualData") or {}
    if facts.get("cpu"): tech_score += 5
    if facts.get("gpuOrVideoChip"): tech_score += 5
    if facts.get("ram"): tech_score += 5
    if facts.get("mediaFormat"): tech_score += 5
    if console.get("originalReleaseYear"): tech_score += 5
    if console.get("generation"): tech_score += 5
    breakdown["technical_completeness"] = min(tech_score, 30)
    score += breakdown["technical_completeness"]

    # Relationship Richness (0 - 20)
    rel_score = 0
    key_games = console.get("keyGames") or []
    rel_score += min(len(key_games) * 3, 15)
    if console.get("keywords"):
        rel_score += min(len(console.get("keywords")), 5)
    breakdown["relationships"] = min(rel_score, 20)
    score += breakdown["relationships"]

    # Asset Presence (0 - 10)
    slug = console.get("slug", "")
    png_path = PROJECT_ROOT / "assets" / "images" / "consoles" / f"{slug}.png"
    asset_score = 10 if png_path.exists() else 0
    breakdown["asset_presence"] = asset_score
    score += asset_score

    return score, breakdown

def select_diverse_items(scored_items, count, key_func, max_per_category=2):
    """
    Select top items adhering to diversity constraints to prevent clustering.
    `key_func` returns category identifiers (e.g. era, manufacturer, genre).
    """
    selected = []
    category_counts = defaultdict(int)

    # First pass: pick highest scoring that satisfy diversity
    for item in scored_items:
        categories = key_func(item)
        if all(category_counts[c] < max_per_category for c in categories):
            selected.append(item)
            for c in categories:
                category_counts[c] += 1
            if len(selected) >= count:
                break

    # Second pass fallback if diversity was too strict to reach count
    if len(selected) < count:
        for item in scored_items:
            if item not in selected:
                selected.append(item)
                if len(selected) >= count:
                    break

    return selected

def find_today_in_history(milestones, current_date=None):
    """
    Deterministically find the most relevant historical milestone for today.
    Matches exact month and day if available; otherwise selects a monumental milestone.
    """
    if current_date is None:
        current_date = datetime.date.today()
    
    month_str = f"{current_date.month:02d}"
    day_str = f"{current_date.day:02d}"
    target_pattern = f"-{month_str}-{day_str}"
    target_month_pattern = f"-{month_str}"

    exact_matches = []
    month_matches = []
    monumental_matches = []

    for m in milestones:
        date = m.get("date") or m.get("exactDate") or ""
        if date.endswith(target_pattern) or f"-{month_str}-{day_str}" in date:
            exact_matches.append(m)
        elif f"-{month_str}" in date:
            month_matches.append(m)
        if m.get("featured") or "monumental" in str(m.get("significanceLevel", "")).lower() or m.get("year") in [1972, 1977, 1980, 1983, 1985, 1989, 1991, 1994, 1996, 1998, 2000, 2001]:
            monumental_matches.append(m)

    if exact_matches:
        return exact_matches[0], "exact_date_match"
    
    # Deterministic rotation by day of year for monumental events
    day_of_year = current_date.timetuple().tm_yday
    pool = month_matches if month_matches else (monumental_matches if monumental_matches else milestones)
    selected = pool[day_of_year % len(pool)]
    return selected, "curated_anniversary_rotation"

def run_discovery_analysis():
    print("=" * 60)
    print("NOSTALGICVERSE DISCOVERY & RANKING ENGINE (PYTHON)")
    print("=" * 60)

    # 1. Load Data Sources
    consoles_raw = load_json(DATA_DIR / "consoles.json")
    consoles_list = consoles_raw.get("consoles", []) if consoles_raw else []
    
    games_raw = load_json(DATA_DIR / "games.json")
    games_list = games_raw.get("games", []) if games_raw else []

    genres_raw = load_json(DATA_DIR / "genres.json")
    genres_list = genres_raw.get("genres", []) if genres_raw else []

    timeline_raw = load_json(DATA_DIR / "timeline.json")
    timeline_list = timeline_raw.get("events", []) or timeline_raw.get("milestones", []) if timeline_raw else []

    guides_raw = load_json(DATA_DIR / "guides.json")
    guides_list = guides_raw.get("guides", []) if guides_raw else []

    stories_raw = load_json(DATA_DIR / "stories.json")
    stories_list = stories_raw.get("stories", []) if stories_raw else []

    print(f"Loaded records:")
    print(f"  Consoles:  {len(consoles_list)}")
    print(f"  Games:     {len(games_list)}")
    print(f"  Genres:    {len(genres_list)}")
    print(f"  Timeline:  {len(timeline_list)}")
    print(f"  Guides:    {len(guides_list)}")
    print(f"  Stories:   {len(stories_list)}")

    remote_manifest = load_json(DATA_DIR / "remote-game-images.json") or {}
    remote_games = remote_manifest.get("games", {})

    # 2. Score and Analyze Games
    scored_games = []
    era_counts = Counter()
    genre_counts = Counter()
    platform_counts = Counter()

    ps4_games = []
    ps5_games = []

    for g in games_list:
        slug = g.get("slug")
        exhibit_detail = None
        if slug:
            exhibit_file = GAMES_DIR / f"{slug}.json"
            if exhibit_file.exists():
                exhibit_detail = load_json(exhibit_file)
        
        score, breakdown = score_game_record(g, exhibit_detail)

        # Image availability check: local verified or remote verified
        has_local_img = (PROJECT_ROOT / "assets" / "images" / "games" / f"{slug}.webp").exists() or \
                        (PROJECT_ROOT / "assets" / "images" / "games" / f"{slug}.png").exists() or \
                        (g.get("localAssetPath") and (PROJECT_ROOT / g.get("localAssetPath").lstrip("/")).exists())
        remote_entry = remote_games.get(slug, {})
        has_remote_img = bool(remote_entry.get("imageUrl") and remote_entry.get("status") in ["verified", "local-verified"])
        has_image = has_local_img or has_remote_img

        if has_image:
            score += 5
            breakdown["artwork_availability"] = 5
        else:
            breakdown["artwork_availability"] = 0

        platforms_all = g.get("platforms") or [g.get("originalLaunchPlatform")]
        is_ps4 = any("playstation 4" in str(p).lower() or "ps4" in str(p).lower() for p in platforms_all)
        is_ps5 = any("playstation 5" in str(p).lower() or "ps5" in str(p).lower() for p in platforms_all)
        if is_ps4: ps4_games.append(slug)
        if is_ps5: ps5_games.append(slug)

        scored_games.append({
            "id": g.get("id", f"game-{slug}"),
            "slug": slug,
            "title": g.get("title"),
            "year": g.get("originalReleaseYear"),
            "era": g.get("era") or f"{(g.get('originalReleaseYear', 1980)//10)*10}s",
            "genre": g.get("genre"),
            "platform": g.get("originalLaunchPlatform"),
            "platforms": platforms_all,
            "developer": g.get("developer"),
            "score": score,
            "breakdown": breakdown,
            "has_exhibit_page": (PROJECT_ROOT / "games" / (slug or "") / "index.html").exists(),
            "has_detail_data": exhibit_detail is not None,
            "has_image": has_image
        })

        if g.get("era"): era_counts[g.get("era")] += 1
        if g.get("genre"): genre_counts[g.get("genre")] += 1
        if g.get("originalLaunchPlatform"): platform_counts[g.get("originalLaunchPlatform")] += 1

    scored_games.sort(key=lambda x: x["score"], reverse=True)

    # 3. Score and Analyze Consoles
    scored_consoles = []
    gen_counts = Counter()
    mfg_counts = Counter()

    for c in consoles_list:
        score, breakdown = score_console_record(c)
        scored_consoles.append({
            "id": c.get("id"),
            "slug": c.get("slug"),
            "name": c.get("name"),
            "year": c.get("originalReleaseYear"),
            "generation": c.get("generation"),
            "generationNumber": c.get("generationNumber"),
            "manufacturer": c.get("manufacturer"),
            "score": score,
            "breakdown": breakdown,
            "has_png_asset": (PROJECT_ROOT / "assets" / "images" / "consoles" / f"{c.get('slug')}.png").exists()
        })
        if c.get("generation"): gen_counts[c.get("generation")] += 1
        if c.get("manufacturer"): mfg_counts[c.get("manufacturer")] += 1

    scored_consoles.sort(key=lambda x: x["score"], reverse=True)

    # 4. Apply Diversity Constraints for Selections
    # Game diversity key: [era, genre, platform_family]
    def game_diversity_keys(g):
        brand = "other"
        plat = (g.get("platform") or "").lower()
        platforms_list = [str(p).lower() for p in (g.get("platforms") or [])]
        all_plat = " ".join([plat] + platforms_list)
        if "playstation 5" in all_plat or "ps5" in all_plat: brand = "ps5"
        elif "playstation 4" in all_plat or "ps4" in all_plat: brand = "ps4"
        elif "playstation" in all_plat or "sony" in all_plat: brand = "sony-retro"
        elif "nintendo switch" in all_plat: brand = "switch"
        elif "nintendo" in all_plat or "nes" in all_plat or "snes" in all_plat: brand = "nintendo-retro"
        elif "sega" in all_plat or "genesis" in all_plat or "saturn" in all_plat or "dreamcast" in all_plat: brand = "sega"
        elif "xbox series" in all_plat: brand = "xbox-series"
        elif "xbox" in all_plat: brand = "xbox"
        elif "arcade" in all_plat: brand = "arcade"
        elif "pc" in all_plat or "dos" in all_plat or "amiga" in all_plat or "c64" in all_plat: brand = "pc-computer"
        return [g.get("era"), g.get("genre"), brand]

    # Console diversity key: [generation, manufacturer]
    def console_diversity_keys(c):
        mfg = (c.get("manufacturer") or "").lower()
        mfg_brand = "other"
        for p in ["nintendo", "sega", "sony", "atari", "microsoft"]:
            if p in mfg: mfg_brand = p; break
        return [c.get("generation"), mfg_brand]

    featured_games = select_diverse_items(scored_games, count=6, key_func=game_diversity_keys, max_per_category=2)
    
    # Exploration games pool (rotating subset across different eras)
    remaining_games = [g for g in scored_games if g not in featured_games]
    exploration_games = select_diverse_items(remaining_games, count=6, key_func=game_diversity_keys, max_per_category=1)

    # Featured hardware pedestal (4 items, 4 distinct generations)
    featured_consoles = select_diverse_items(scored_consoles, count=4, key_func=console_diversity_keys, max_per_category=1)

    # 5. Today in History
    today_moment, match_type = find_today_in_history(timeline_list)
    print(f"\nToday in History Selection ({match_type}):")
    print(f"  {today_moment.get('year')} · {today_moment.get('title')}")

    # 6. Content and Asset Gap Identification
    missing_game_images = [g["slug"] for g in scored_games if not g["has_image"]]
    missing_console_images = [c["slug"] for c in scored_consoles if not c["has_png_asset"]]
    games_without_detail_page = [g["slug"] for g in scored_games if not g["has_exhibit_page"]]
    
    print(f"\nGap Analysis:")
    print(f"  Games without standalone exhibit pages: {len(games_without_detail_page)}")
    print(f"  Games lacking custom artwork assets:   {len(missing_game_images)}")
    print(f"  Consoles lacking transparent PNGs:    {len(missing_console_images)}")

    # 7. Generate Output JSON
    output_data = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "metadata": {
            "generator": "tools/content/rank_discovery.py",
            "version": "1.0.0",
            "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "algorithm": {
                "name": "NostalgicVerse Multi-Factor Transparent Discovery Ranker",
                "scoringWeights": {
                    "games": {
                        "historicalSignificance": 35,
                        "completeness": 30,
                        "relationshipRichness": 20,
                        "exhibitDepth": 15
                    },
                    "consoles": {
                        "historicalSignificance": 40,
                        "technicalCompleteness": 30,
                        "relationshipRichness": 20,
                        "assetPresence": 10
                    }
                },
                "diversityRules": [
                    "Max 2 items per era in featured collections",
                    "Max 2 items per genre in featured collections",
                    "Max 1 item per manufacturer/generation on hardware pedestal",
                    "Deterministic calendar/day-of-year rotation for exploration"
                ]
            },
            "recordsEvaluated": {
                "games": len(scored_games),
                "consoles": len(scored_consoles),
                "timelineEvents": len(timeline_list),
                "genres": len(genres_list),
                "playstation4Games": len(ps4_games),
                "playstation5Games": len(ps5_games),
                "combinedPs4Ps5Games": len(set(ps4_games + ps5_games)),
                "verifiedArtworkCount": len(scored_games) - len(missing_game_images)
            }
        },
        "featuredGames": [
            {
                "id": g["id"],
                "slug": g["slug"],
                "title": g["title"],
                "year": g["year"],
                "era": g["era"],
                "genre": g["genre"],
                "platform": g["platform"],
                "developer": g["developer"],
                "score": g["score"],
                "url": f"/games/{g['slug']}/" if g["has_exhibit_page"] else f"/games/#game-{g['slug']}"
            }
            for g in featured_games
        ],
        "explorationGames": [
            {
                "id": g["id"],
                "slug": g["slug"],
                "title": g["title"],
                "year": g["year"],
                "era": g["era"],
                "genre": g["genre"],
                "platform": g["platform"],
                "developer": g["developer"],
                "score": g["score"],
                "url": f"/games/{g['slug']}/" if g["has_exhibit_page"] else f"/games/#game-{g['slug']}"
            }
            for g in exploration_games
        ],
        "featuredConsoles": [
            {
                "id": c["id"],
                "slug": c["slug"],
                "name": c["name"],
                "year": c["year"],
                "generation": c["generation"],
                "manufacturer": c["manufacturer"],
                "score": c["score"],
                "image": f"/assets/images/consoles/{c['slug']}.png",
                "url": f"/consoles/{c['slug']}/"
            }
            for c in featured_consoles
        ],
        "todayInHistory": {
            "id": today_moment.get("id"),
            "year": today_moment.get("year"),
            "date": today_moment.get("date"),
            "title": today_moment.get("title"),
            "description": today_moment.get("description"),
            "significance": today_moment.get("significance"),
            "relatedConsole": today_moment.get("relatedConsole"),
            "relatedGame": today_moment.get("relatedGame"),
            "matchType": match_type
        },
        "distributions": {
            "eraDistribution": dict(era_counts.most_common()),
            "genreDistribution": dict(genre_counts.most_common()),
            "generationDistribution": dict(gen_counts.most_common()),
            "topManufacturers": dict(mfg_counts.most_common(8)),
            "playstationModern": {
                "ps4Count": len(ps4_games),
                "ps5Count": len(ps5_games),
                "combinedCount": len(set(ps4_games + ps5_games))
            }
        },
        "contentGaps": {
            "missingGameArtworks": missing_game_images[:30],
            "totalMissingGameArtworks": len(missing_game_images),
            "missingConsolePNGs": missing_console_images,
            "totalMissingConsolePNGs": len(missing_console_images),
            "gamesWithoutExhibitPages": games_without_detail_page[:20],
            "totalGamesWithoutExhibitPages": len(games_without_detail_page)
        }
    }

    output_path = DATA_DIR / "discovery-rankings.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2)

    print(f"\nSuccessfully wrote discovery rankings artifact to:")
    print(f"  {output_path.resolve()}")
    print(f"Featured games selected (diverse): {[g['title'] for g in featured_games]}")
    print(f"Hardware pedestal selected: {[c['name'] for c in featured_consoles]}")
    print("=" * 60)

if __name__ == "__main__":
    run_discovery_analysis()

