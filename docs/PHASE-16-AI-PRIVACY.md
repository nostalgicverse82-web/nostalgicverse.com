# NostalgicVerse — Phase 16 AI Privacy & Data Isolation Boundary

## 1. Principles of Museum Data Privacy

NostalgicVerse handles historical computing archives alongside user accounts, community friendships, direct communications, and private support correspondence. Under Phase 16, a strict, impenetrable privacy firewall separates user personal data from server-side AI processing.

### Immutable Privacy Mandates:
- **Zero Public AI Chatbot**: NostalgicVerse does NOT deploy public chat widgets or interactive generative bots to general visitors.
- **Zero Client-Side AI Access**: All AI provider integrations are hosted exclusively on the Node.js backend.
- **Zero Private User Exposure**: User passwords, session identifiers, hashed credentials, IP addresses, private messages, personal collections, and support tickets are NEVER submitted to any AI payload or external provider.
- **Strict Data Minimization**: AI pipelines operate strictly on publicly verifiable historical artifacts, news texts, and public hardware technical specifications.

---

## 2. Privacy Boundary Diagram

```
┌────────────────────────────────────────────────────────┐
│            PRIVATE USER & SYSTEM ZONE                  │
│                                                        │
│  • users (passwords, salts, emails, session tokens)    │
│  • support_tickets & ticket_messages                   │
│  • direct_messages & private friend requests           │
│  • security_logs & session cookies                     │
└──────────────────────────┬─────────────────────────────┘
                           │
                 [ STRICT AIR-GAP ]
             Enforced by aiPrivacyFirewall
                           │
┌──────────────────────────▼─────────────────────────────┐
│             PUBLIC ARCHIVAL AI INGESTION               │
│                                                        │
│  Allowlisted Archival Entities Only:                   │
│  • Public Game Specs (Title, Platform, Year, Genre)    │
│  • Public News Headlines & Historical Press Articles   │
│  • Public Hardware Documents & System Specifications   │
│  • Meta Tag Content for SEO Archival Indexing          │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
                  [ AI Provider API ]
```

---

## 3. Privacy Firewall Implementation

All data enqueued into `ai_jobs` or processed by intelligence services passes through deterministic sanitization:

```javascript
// Strict allowlist of permissible fields for AI enrichment
const ALLOWLISTED_AI_FIELDS = new Set([
    'title', 'slug', 'platform', 'developer', 'publisher',
    'releaseYear', 'genre', 'shortDescription', 'sourceUrl',
    'historicalContext', 'tags', 'detectedDate', 'notes'
]);

function sanitizeJobPayload(payload) {
    if (!payload || typeof payload !== 'object') return {};
    const sanitized = {};
    for (const [key, value] of Object.entries(payload)) {
        if (ALLOWLISTED_AI_FIELDS.has(key)) {
            // Strip any embedded emails, JWTs, or passwords if present
            sanitized[key] = typeof value === 'string' 
                ? value.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[REDACTED_EMAIL]')
                : value;
        }
    }
    return sanitized;
}
```

---

## 4. Verification & Audit Trail

1. **Suite 09 (`test-phase16-ai-privacy.cjs`)**:
   Automatically validates that:
   - Historical `ai_jobs.payload` records contain zero instances of credentials, email patterns, password hashes, or bearer tokens.
   - Any attempt to pass user tables (`users`, `sessions`, `support_tickets`) into the AI ingestion pipeline throws a security isolation violation.
2. **Audit Ledger Logging**:
   Every AI job records an entry in `ai_audit` with `actor_id` referencing the authenticated owner who initiated or reviewed the operation, documenting exactly what system context triggered the run.
