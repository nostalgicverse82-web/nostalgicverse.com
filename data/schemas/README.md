# NostalgicVerse Schema Architecture

This directory contains the canonical JSON Schemas defining the data structures for all archival exhibits.

## Core Architectural Principle: Fact vs. Editorial Separation

To protect historical accuracy and prevent the propagation of unverified AI speculation, all exhibits strictly separate:
1. **Verified Factual Data (`verifiedFactualData`)**: Hardware specifications, chip clock frequencies, exact release dates, primary source citations, and engineering records. All fields are optional so agents NEVER fabricate values to satisfy a schema.
2. **Editorial Content (`editorialContent`)**: Curatorial analyses, mechanical breakdowns, and cultural impact essays authored by archival specialists.

## Schemas:
- `game.schema.json` — Landmark Video Games
- `console.schema.json` — Hardware Generations & Microcomputers
- `genre.schema.json` — Mechanical Taxonomy
- `timeline.schema.json` — Chronological Milestones
- `guide.schema.json` — Technical Preservation & Maintenance Guides
- `story.schema.json` — Retrospective Articles & Features

