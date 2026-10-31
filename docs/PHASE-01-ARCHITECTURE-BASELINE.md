# PHASE 01 ARCHITECTURE BASELINE

## Current Server Entrypoints
- Canonical server: `server/index.cjs` (Currently implemented as an Express application serving APIs and static content).
- Compatibility launcher: `server.cjs` (Delegates entirely to `server/index.cjs`).

## Current Server Responsibilities
- Serves static museum assets with proper `.html` fallback routing.
- Handles REST API routing (`/api/auth`, `/api/social`, `/api/owner`, `/api/emulators`).
- Integrates WebSocket connections.
- Connects to SQLite database.

## Duplicate Implementations
- None. `server.cjs` explicitly wraps `server/index.cjs` and does not reinvent HTTP routing or server creation.

## Current Data Sources
- Canonical Content & User Data: `data/nostalgicverse.db` (SQLite3).
- Legacy JSON data (`data/*.json`) has been successfully migrated to the SQL database.

## Current Static Content Architecture
- Static `.html` files reside in `games/`, `consoles/`, `genres/`, `timeline/`, etc.
- Client scripts use Vanilla JS with no build step.

## Current Environment Configuration
- `.env` and `.env.example` contain `PORT`, `HOST`, `DATABASE_URL`, `SESSION_SECRET`, and `OWNER_USERNAME`.
- Port is properly standardized on `3000` (or `8000` in legacy configs, but canonical standard is `3000`).

## Migration Risks
- Maintaining path resolution for legacy static pages while serving dynamic API routes. (Mitigated by Express fallback layer).
- No dual-brain sync: SQLite is now the single source of truth for platform data.

