# NostalgicVerse — Phase 16 AI Provider Abstraction & Failover

## 1. Provider Architecture Overview

The NostalgicVerse AI layer utilizes an object-oriented provider pattern implemented in `server/ai/provider.cjs`. The system decouples business workflows from specific LLM vendors, allowing zero-downtime provider switching, graceful fallback, circuit breaker protection, and deterministic offline testing.

```
                  ┌──────────────────────┐
                  │    BaseAIProvider    │
                  └──────────┬───────────┘
                             │
     ┌───────────────┬───────┴───────┬───────────────┐
     ▼               ▼               ▼               ▼
┌──────────┐  ┌──────────────┐ ┌───────────┐ ┌───────────────┐
│ Gemini   │  │  Anthropic   │ │  OpenAI   │ │ Mock Provider │
│ Provider │  │   Provider   │ │ Provider  │ │ (CI/Offline)  │
└──────────┘  └──────────────┘ └───────────┘ └───────────────┘
```

---

## 2. Supported Providers

### 1. `GeminiAIProvider` (Default Production)
- **Primary Endpoint**: Google Gemini REST API (`generativelanguage.googleapis.com/v1beta`)
- **Default Model**: `gemini-2.0-flash`
- **Capabilities**: High speed, JSON structured outputs, low latency, native system instructions.

### 2. `AnthropicAIProvider`
- **Primary Endpoint**: Anthropic Messages API (`api.anthropic.com/v1/messages`)
- **Default Model**: `claude-3-5-sonnet-latest`
- **Capabilities**: Deep historical reasoning, detailed document summarization, strict guardrails.

### 3. `OpenAIProvider`
- **Primary Endpoint**: OpenAI Chat Completions API (`api.openai.com/v1/chat/completions`)
- **Default Model**: `gpt-4o-mini`
- **Capabilities**: Structured outputs, standard tool calling format.

### 4. `MockAIProvider` (Deterministic CI/CD Mode)
- **Activation**: Enabled automatically when `AI_TEST_MODE=true` or `AI_PROVIDER=mock`.
- **Behavior**: Zero external HTTP calls, zero API token spend, 100% deterministic outputs formatted strictly to requested schemas.

---

## 3. Core Provider Interface

All providers adhere to standard async methods:

| Method | Parameters | Return Value | Description |
| :--- | :--- | :--- | :--- |
| `generateText()` | `prompt, options` | `Promise<string>` | Raw text generation |
| `generateStructured()` | `prompt, schema, context` | `Promise<Object>` | Strictly validated JSON matching target schema |
| `summarize()` | `text, options` | `Promise<Object>` | Archival synthesis with length constraints |
| `extract()` | `text, targetSchema` | `Promise<Object>` | Entity and claim extraction from text |
| `classify()` | `text, categories` | `Promise<Object>` | Categorization and label assignment |
| `estimateTokens()` | `inputStr` | `number` | Fast whitespace-heuristic token counter |

---

## 4. Resilience & Circuit Breaker Pattern

To prevent cascading timeouts or bill inflation when an upstream AI service suffers outages:

```javascript
class CircuitBreaker {
    constructor({ failureThreshold = 3, cooldownMs = 30000 }) {
        this.failureThreshold = failureThreshold;
        this.cooldownMs = cooldownMs;
        this.failures = 0;
        this.lastFailureTime = null;
        this.state = 'CLOSED'; // CLOSED -> OPEN -> HALF-OPEN
    }
}
```

- **Threshold**: 3 consecutive HTTP 5xx / timeout errors trip the circuit to `OPEN`.
- **Fail-Fast**: While `OPEN`, calls reject immediately with `Circuit breaker active: Provider temporarily isolated`, avoiding pending connection exhaustion.
- **Cooldown**: After 30 seconds, enters `HALF-OPEN` to test a single request; successful completion resets failure counters to `CLOSED`.
- **Request Timeout**: All provider network requests are wrapped with an `AbortController` bound to `AI_TIMEOUT_MS` (default 15,000ms).
