# NostalgicVerse — Phase 13 Capacity Model

This document establishes the traffic modeling, scenario targets, resource boundaries, and classification framework for NostalgicVerse under varying operational scales.

---

## 1. Capacity Classification Standard

To maintain absolute architectural integrity, all capacity evaluations strictly adhere to two separate concepts:

- **MEASURED CAPACITY**: The throughput, concurrency, and latency verified through actual synthetic load testing on the current physical environment (13th Gen Intel Core i5, 16 cores, Windows 11, Node.js v25, SQLite WAL).
- **DESIGNED CAPACITY**: The architectural theoretical capacity supported by the design when deployed across horizontal scaling tiers (Load Balancers, stateless Node instances, Redis pub/sub, PostgreSQL / distributed DB, and CDN asset edge caches).
- **NOT MEASURED**: Explicit declaration when single-machine resources (file descriptors, ephemeral ports, local loopback buffers) prevent executing a physical test locally.

---

## 2. Traffic Scenarios & Evaluation Matrix

| Scenario | Target Load Description | Nature | Physical Environment Feasibility | Architectural Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **Scenario A** | **10 Concurrent Visitors** | Normal browsing, reading exhibits, light search | Fully executable locally | Single Node instance, SQLite in WAL mode |
| **Scenario B** | **100 Concurrent Visitors** | Active museum browsing, comments, reactions | Fully executable locally | In-memory rate limiting, WAL concurrency |
| **Scenario C** | **500 Concurrent Visitors** | Traffic surge from social media or news release | Fully executable locally (synthetic virtual users) | Bounded DB queries, connection pooling |
| **Scenario D** | **1,000 Concurrent Visitors** | Simultaneous authentication or active chat spike | Fully executable locally (synthetic virtual users) | Rate-limiting, threadpool management, DB busy retries |
| **Scenario E** | **5,000 Concurrent Connections**| Large event traffic burst | Synthetic request load; single-machine port limit caveat | Keep-alive reuse, connection timeouts |
| **Scenario F** | **10,000 WebSocket Connections** | High live community chat & notification population | Simulated in batch virtual sockets; OS descriptor limit caveat | Ephemeral port batching, heartbeat throttling |
| **Scenario G** | **50,000 Simulated Visitors** | Daily peak campaign simulation | Synthetic request identities across time | Micro-caching, CDN edge caching |
| **Scenario H** | **100,000 Simulated Request Identities** | Enterprise scale stress test | Database and identity stress testing; NOT 100k real Chromium browsers | Distributed horizontal instances + Redis |

---

## 3. Physical Single-Host vs. Horizontal Scale Boundaries

### 3.1 Single-Host SQLite Constraints (Current Local Stack)
- **Read Concurrency**: High. SQLite WAL allows unlimited concurrent readers without blocking writers.
- **Write Concurrency**: Serialized single-writer lock. Write operations acquire an exclusive table lock.
  - At ~5ms per write transaction, theoretical ceiling is ~200 writes/second.
  - Under burst writes (e.g. 500 simultaneous comments/logins), transactions queue up and must use `PRAGMA busy_timeout = 5000` with exponential backoff & jitter to avoid `SQLITE_BUSY`.
- **Operating System Socket Limits**: On a developer PC, opening > 5,000 simultaneous TCP sockets can exhaust ephemeral loopback ports or Windows network handles (`WSAENOBUFS`). Therefore, tests representing 10k–100k users must use lightweight synthetic pipelining.

### 3.2 Production Horizontal Target (Designed Scale)
```
[ 100,000 Users ]
       │
       ▼
[ Cloudflare / CDN Edge ] ── (Static Assets, Cached Public HTML, Images)
       │
       ▼
[ NGINX / Cloud Load Balancer ]
       │
  ┌────┴────────────┬────────────────┐
  ▼                 ▼                ▼
[ App Node 1 ]    [ App Node 2 ]    [ App Node N ]
  │                 │                │
  ├─────────────────┴────────────────┤
  ▼                                  ▼
[ Redis Cluster ]            [ PostgreSQL Primary + Replicas ]
(Pub/Sub, Rate Limits,       (Authoritative Relational Store,
Shared WS Sessions)          Row-Level Locking, High Write IOPS)
```

