# DATABASE ARCHITECTURE

## Chosen Strategy
**SQLite (via `sqlite3` driver)**
SQLite is chosen as the production-capable relational database for NostalgicVerse because it requires zero external service dependencies, provides robust transactional guarantees, and is easily backed up via file-level copies. It will safely power relational content, users, permissions, social features, and future analytics.

## Structural Paradigms
- **Migrations:** All schema changes must be applied sequentially via `.sql` migration files. Manual schema changes are forbidden.
- **Foreign Keys:** Enforced at connection time (`PRAGMA foreign_keys = ON;`). 
- **Indexes:** Will be leveraged heavily on high-read columns (`slug`, `username_normalized`, `email`).
- **Constraints:** `UNIQUE` constraints enforce logic (e.g., case-insensitive username identity).

## Core Entities
- `users`: Core identity, hashed credentials, roles, disabled status, and `username_normalized`.
- `user_profiles`: Display preferences (casing, bios, avatars).
- `content` (`games`, `consoles`, `genres`): Authoritative records of museum content.
- `emulator_sessions` / `emulator_devices`: Telemetry for cross-platform emulator tracking.
- `audit_logs`: Immutable ledger of owner and moderation actions.
- `favorites` / `social`: N:M relation tables for user engagement.

