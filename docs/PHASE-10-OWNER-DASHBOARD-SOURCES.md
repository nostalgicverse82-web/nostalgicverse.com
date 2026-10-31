# Phase 10: Owner Dashboard Sources

The Owner Dashboard has been migrated away from static mock files. Every metric is now backed by a live database query located in `server/api/owner.cjs`.

## Metric to Query Map

| Metric Name | Source Table | Query |
| :--- | :--- | :--- |
| **Total Users** | `users` | `SELECT COUNT(*) FROM users` |
| **Active Sessions (24h)** | `sessions` | `SELECT COUNT(DISTINCT user_id) FROM sessions WHERE created_at > datetime('now', '-1 day')` |
| **Total Games** | `games` | `SELECT COUNT(*) FROM games` |
| **Total Consoles** | `consoles` | `SELECT COUNT(*) FROM consoles` |
| **Pending Games** | `submissions` | `SELECT COUNT(*) FROM submissions WHERE item_type = 'game' AND status = 'PENDING'` |
| **Open Tickets** | `support_tickets` | `SELECT COUNT(*) FROM support_tickets WHERE status = 'OPEN'` |

## Recent Activity Feed
The activity feed aggregates recent rows from across the system (e.g. `users`, `games`, `consoles`, `submissions`) sorting them by `created_at DESC` in a fast UNION query to provide the owner a realtime stream of community interactions.

## System Health
- **Database Status:** Monitored via pinging `PRAGMA schema_version`.
- **Search Engine:** Verifies availability of the `data/search-index.json` static generation layer.

These integrations guarantee that the platform administrator observes absolute truth with 0 delay.

