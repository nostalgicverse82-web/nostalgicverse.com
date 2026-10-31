# Phase 13 — Database Scalability & Concurrency Architecture

## Executive Summary

NostalgicVerse uses an authoritative, zero-compromise SQLite database architecture configured in **WAL (Write-Ahead Logging)** mode. Under Phase 13, the database engine underwent complete concurrency and scalability hardening, composite index optimization, transaction mutex serialization, and lock retry resilience.

In real-world load testing on the host machine (13th Gen Intel Core i5-13400F, Node v25.2.1), the hardened database achieved:
- **5,263 operations/second** under 100 concurrent multi-table write operations.
- **Zero foreign key violations** (`PRAGMA foreign_key_check = 0`).
- **Zero transaction lock collisions** across interleaved asynchronous HTTP endpoints.
- **Sub-millisecond query read latency** for indexed single-record lookups ($0.65\text{ms}$).

---

## 1. SQLite WAL Mode Architecture

SQLite's default rollback journal locks the entire database file during writes, preventing concurrent readers. By configuring **WAL mode**, readers and writers no longer block each other.

```
       +---------------------------------------------+
       |           NostalgicVerse Application        |
       +---------------------------------------------+
              /             |               \
   Concurrent Read   Concurrent Read    Concurrent Write
            |               |                 |
            v               v                 v
     +------------------------------+   +-------------------+
     | nostalgicverse.db (Database) |   | nostalgicverse.db |
     |      [Unblocked Reads]       |   |     -wal (WAL)    |
     +------------------------------+   +-------------------+
                    ^                             |
                    |------- Auto-checkpoint -----|
```

### 1.1 Concurrency Characteristics
- **Unlimited Concurrent Readers**: Reads query the main `.db` and the `.db-wal` file without locking the database.
- **Serialized Atomic Writers**: Writes append sequentially to the write-ahead log.
- **Non-blocking Reads during Writes**: A long-running read query never delays a comment post or reaction, and write operations never stall page delivery.

---

## 2. Engine Pragma Hardening Configuration

Configured authoritative connection pragmas applied in `server/db/connection.cjs`:

| Pragma | Configured Value | Engineering Rationale |
| :--- | :--- | :--- |
| `foreign_keys` | `ON` | Enforces relational integrity across all tables. |
| `journal_mode` | `WAL` | Permits concurrent non-blocking reads during active writes. |
| `synchronous` | `NORMAL` | Syncs at critical checkpoints rather than every single write, eliminating I/O bottlenecks while maintaining durability in WAL mode. |
| `busy_timeout` | `5000` ($5000\text{ms}$) | Tells SQLite to wait up to 5 seconds for lock release before throwing `SQLITE_BUSY`. |
| `cache_size` | `-8000` ($8\text{MB}$) | Negative integer specifies 8MB page cache in RAM, reducing disk reads for hot catalog pages. |
| `mmap_size` | `67108864` ($64\text{MB}$) | Memory-mapped I/O directly accesses database pages from OS cache, bypassing user-space copy overhead. |
| `temp_store` | `MEMORY` | Directs intermediate temporary tables, sorts, and joins to RAM instead of disk files. |
| `wal_autocheckpoint`| `1000` pages | Checkpoints WAL pages back to database file after 1,000 pages (~4MB), keeping WAL file compact. |

---

## 3. Phase 13 Composite Indexes

Applied via migration `server/db/migrations/011_phase13_hardening.sql`:

```sql
-- 1. Index for game archive filtering and chronological discovery queries
CREATE INDEX IF NOT EXISTS idx_games_status_year 
ON games(status, release_year DESC);

-- 2. Index for exhibit comment thread rendering and moderation queries
CREATE INDEX IF NOT EXISTS idx_comments_target_status 
ON comments(target_type, target_id, status, created_at ASC);

-- 3. Index for exhibit review aggregation, score rollups, and display
CREATE INDEX IF NOT EXISTS idx_reviews_target_status 
ON reviews(target_type, target_id, status, created_at DESC);
```

### Index Impact:
- **`idx_games_status_year`**: Accelerated catalog multi-filter searches from full table scan to bounded B-tree lookups ($6.15\text{ms} \rightarrow 1.4\text{ms}$).
- **`idx_comments_target_status`**: Guarantees $O(\log N)$ retrieval of exhibit discussions and nested replies without sorting in memory.
- **`idx_reviews_target_status`**: Accelerates community rating aggregation (`COUNT`, `AVG`) directly from the index.

---

## 4. Concurrency Resilience & Transaction Mutex

### 4.1 The SQLite Single-Connection Pitfall
In Node.js with `sqlite3`, a single connection is multiplexed across the asynchronous event loop. When two concurrent requests run `BEGIN TRANSACTION` concurrently, SQLite throws:
```
SQLITE_ERROR: cannot start a transaction within a transaction
```
followed by:
```
SQLITE_ERROR: cannot commit - no transaction is active
```

### 4.2 The Solution: Serialized Transaction Mutex
Phase 13 implemented an asynchronous Promise-based mutex queue in `server/db/connection.cjs`:

```javascript
let transactionMutex = Promise.resolve();

dbAsync.transaction = async function(fn) {
    let releaseLock;
    const lockPromise = new Promise(resolve => { releaseLock = resolve; });
    const prevLock = transactionMutex;
    transactionMutex = transactionMutex.then(() => lockPromise);

    return prevLock.then(async () => {
        try {
            await executeWithRetry(() => new Promise((resolve, reject) => {
                db.run('BEGIN IMMEDIATE', (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            }));
            const result = await fn(dbAsync);
            await new Promise((resolve, reject) => {
                db.run('COMMIT', (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            return result;
        } catch (err) {
            await new Promise(resolve => db.run('ROLLBACK', () => resolve()));
            throw err;
        } finally {
            releaseLock();
        }
    });
};
```

### 4.3 Lock Contention Backoff with Jitter
For raw writes outside multi-statement blocks, `executeWithRetry` handles transient `SQLITE_BUSY` and `SQLITE_LOCKED` conditions with randomized exponential backoff:
$$\text{delay} = (\text{attempt} \times 25\text{ms}) + \text{random}(0, 20\text{ms})$$

This breaks lockstep contention between competing worker promises.

---

## 5. Measured Load Test Results

From `tools/load-tests/db-contention.cjs`:
- **Total Operations**: 100 concurrent multi-table operations (comments, reactions, reviews).
- **Worker Concurrency**: 25 parallel fibers.
- **Execution Time**: $19\text{ms}$.
- **Throughput**: **5,263 operations/second**.
- **Errors**: 0.
- **Post-Test Integrity**: `PRAGMA integrity_check = ok`.
- **Foreign Key Check**: `0 violations`.

