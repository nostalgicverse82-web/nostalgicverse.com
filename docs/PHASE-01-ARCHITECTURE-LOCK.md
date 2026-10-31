# PHASE 01 ARCHITECTURE LOCK

## Conceptual Architecture
```
PUBLIC FRONTEND
        |
        v
CANONICAL NODE SERVER (server/index.cjs)
        |
        +---- REST API
        |
        +---- REALTIME / WEBSOCKET LAYER
        |
        +---- AUTHENTICATION
        |
        +---- AUTHORIZATION / RBAC
        |
        +---- CONTENT SERVICES
        |
        +---- MODERATION
        |
        +---- BACKGROUND JOBS
        |
        +---- FUTURE PRIVATE AI SERVICES
        |
        v
DATABASE (SQLite / Relational)
        |
        +---- USERS
        +---- CONTENT
        +---- SOCIAL
        +---- SUBMISSIONS
        +---- RELEASES
        +---- EMULATOR COMPATIBILITY
        +---- AUDIT LOGS
        +---- BUSINESS
```

## Core Directives
1. **Canonical Server:** One server (`server/index.cjs`) rules them all.
2. **Ports:** Standard `PORT=3000`. `npm start` and `npm run dev` start the canonical server.
3. **Data Truth:** The content database is the authoritative source for published content and relationships. Generated HTML is merely a public representation.
4. **AI Policy:** AI is strictly a private backend service subject to human-in-the-loop review.
5. **No Redesign:** The legacy museum website's visual design is strictly preserved until Phase 02+ explicitly overhauls it.

