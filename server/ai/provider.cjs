/**
 * NostalgicVerse — Enterprise AI Provider Abstraction Layer (Phase 16)
 * ======================================================================
 * Strictly server-side multi-vendor abstraction (Mock, Gemini, Anthropic, OpenAI).
 * Provider credentials and API keys are NEVER leaked to the client browser.
 * Includes timeout control, circuit breaker resilience, token estimation,
 * and deterministic test-mode fallback.
 */

'use strict';

const crypto = require('crypto');
const { defaultLogger: logger } = require('../automation/logger.cjs');

// Circuit breaker state per provider
const circuitBreakers = new Map();

function getCircuitBreaker(providerName) {
    if (!circuitBreakers.has(providerName)) {
        circuitBreakers.set(providerName, {
            failures: 0,
            lastFailureTime: 0,
            state: 'CLOSED', // CLOSED (healthy), OPEN (degraded/tripped), HALF_OPEN
            threshold: 3,
            cooldownMs: 30000 // 30s cooldown
        });
    }
    return circuitBreakers.get(providerName);
}

function checkCircuit(providerName) {
    const cb = getCircuitBreaker(providerName);
    if (cb.state === 'OPEN') {
        const elapsed = Date.now() - cb.lastFailureTime;
        if (elapsed > cb.cooldownMs) {
            cb.state = 'HALF_OPEN';
            logger.info(`[CIRCUIT_BREAKER] Provider "${providerName}" transitioned from OPEN to HALF_OPEN`);
            return true;
        }
        return false;
    }
    return true;
}

function recordCircuitSuccess(providerName) {
    const cb = getCircuitBreaker(providerName);
    cb.failures = 0;
    cb.state = 'CLOSED';
}

function recordCircuitFailure(providerName) {
    const cb = getCircuitBreaker(providerName);
    cb.failures++;
    cb.lastFailureTime = Date.now();
    if (cb.failures >= cb.threshold) {
        cb.state = 'OPEN';
        logger.warn(`[CIRCUIT_BREAKER] Provider "${providerName}" tripped OPEN after ${cb.failures} consecutive errors`);
    }
}

class BaseAIProvider {
    constructor(name, config = {}) {
        this.name = name;
        this.config = config;
        this.timeoutMs = config.timeoutMs || parseInt(process.env.AI_TIMEOUT_MS, 10) || 15000;
        this.defaultModel = config.model || process.env.AI_MODEL || 'mock-engine';
    }

    async generateText(prompt, options = {}) {
        throw new Error('generateText() must be implemented by subclass');
    }

    async generateStructured(prompt, schema = {}, options = {}) {
        throw new Error('generateStructured() must be implemented by subclass');
    }

    async classify(content, categories = [], options = {}) {
        const schema = {
            classification: "string",
            confidence: "HIGH | MEDIUM | LOW",
            reasoning: "string"
        };
        const prompt = `Classify the following gaming content into strictly one of these categories: ${JSON.stringify(categories)}.\n\nContent:\n"""\n${content}\n"""`;
        return this.generateStructured(prompt, schema, options);
    }

    async extract(content, targetSchema = {}, options = {}) {
        const prompt = `Extract verified museum facts from the following gaming text according to the target schema. Do NOT invent facts or dates not explicitly stated in the source text.\n\nSource Content:\n"""\n${content}\n"""`;
        return this.generateStructured(prompt, targetSchema, options);
    }

    async summarize(content, constraints = {}, options = {}) {
        const maxWords = constraints.maxWords || 100;
        const tone = constraints.tone || 'museum-grade, objective, historical';
        const schema = {
            headline: "string",
            summary: "string",
            keyFacts: ["string"]
        };
        const prompt = `Synthesize a concise summary (under ${maxWords} words) with tone: ${tone}. Use strictly verified facts from the text.\n\nContent:\n"""\n${content}\n"""`;
        return this.generateStructured(prompt, schema, options);
    }

    estimateTokens(text) {
        if (!text) return 0;
        // Conservative heuristic: ~4 characters per token
        return Math.ceil(text.length / 4);
    }

    sanitizeInputPrompt(text) {
        if (!text) return '';
        // Neutralize instruction injection attempts by escaping delimiter characters
        return text
            .replace(/```/g, "'''")
            .replace(/system:/gi, 'system-note:')
            .replace(/instructions?:/gi, 'instruction-note:')
            .trim();
    }

    sanitizeJsonOutput(raw) {
        if (!raw || typeof raw !== 'string') return {};
        const cleaned = raw
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();
        try {
            return JSON.parse(cleaned);
        } catch (e) {
            // Attempt fallback extraction if wrapped in surrounding text
            const firstBrace = cleaned.indexOf('{');
            const lastBrace = cleaned.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                const sub = cleaned.substring(firstBrace, lastBrace + 1);
                return JSON.parse(sub);
            }
            throw new Error(`Failed to parse AI structured response: ${e.message}`);
        }
    }
}

/**
 * Mock / Offline Archival Provider
 * Deterministic, offline, zero network reliance, safe for tests & air-gapped dev.
 */
class MockAIProvider extends BaseAIProvider {
    constructor(config = {}) {
        super('mock', config);
    }

    async generateText(prompt, options = {}) {
        const sanitized = this.sanitizeInputPrompt(prompt);
        return `[NostalgicVerse Archival Intelligence]: Curated historical verification. Prompt summary: "${sanitized.slice(0, 80)}..."`;
    }

    async generateStructured(prompt, schema = {}, options = {}) {
        const now = new Date().toISOString();
        const datePart = now.split('T')[0];

        // Tailor structured response based on schema keys
        if (schema.classification !== undefined) {
            return {
                classification: options.defaultCategory || 'HISTORICAL_EVENT',
                confidence: 'HIGH',
                reasoning: 'Verified against authoritative archival museum chronology'
            };
        }

        if (schema.description !== undefined || schema.historicalContext !== undefined) {
            return {
                title: options.title || 'Classic Arcade Artifact',
                description: 'A revolutionary coin-operated arcade title engineered with discrete TTL logic and raster scan visual rendering.',
                historicalContext: 'Introduced during the seminal rise of public amusement arcades, defining foundational mechanics and industrial video game economics.',
                tags: ['arcade', 'golden-age', 'hardware-milestone', 'museum-verified'],
                seo: {
                    metaTitle: `${options.title || 'Classic Game'} (Historical Archive) — NostalgicVerse`,
                    metaDescription: `Discover the verified history, hardware specs, and cultural legacy of ${options.title || 'this classic game'} at NostalgicVerse.`
                },
                sourceRefs: [options.sourceUrl || 'https://archive.org/details/museum-specimen'],
                claims: [
                    { claim: 'Launched in early coin-op era', verified: true, source: 'Museum Archive' }
                ]
            };
        }

        if (schema.headline !== undefined || schema.keyFacts !== undefined) {
            return {
                headline: options.topicTitle || 'Historical Milestone Documented in Digital Archive',
                summary: 'Archival research reveals meticulous hardware preservation and groundbreaking sound synthesizer chip architectures.',
                keyFacts: [
                    'Pioneered hardware raster interrupts for multiplexed sprite displays',
                    'Established multi-tiered retail distribution standard across global territories'
                ]
            };
        }

        // Generic museum schema fallback
        return {
            title: options.topicTitle || 'Archival Museum Specimen Analysis',
            summary: 'Museum archival intelligence synthesis for historical retrospective preservation.',
            verifiedDate: datePart,
            status: 'AI_DRAFT',
            metadata: {
                provider: 'mock',
                generatedAt: now,
                promptSlice: prompt.slice(0, 50)
            }
        };
    }
}

/**
 * Google Gemini Provider
 */
class GeminiAIProvider extends BaseAIProvider {
    constructor(apiKey, config = {}) {
        super('gemini', config);
        this.apiKey = apiKey;
    }

    async generateText(prompt, options = {}) {
        if (!checkCircuit(this.name)) {
            throw new Error(`Gemini provider circuit breaker is OPEN (degraded). Request rejected.`);
        }

        const model = options.model || this.defaultModel || 'gemini-3.1-flash-lite';
        const endpoint = `${this.config.baseUrl || 'https://generativelanguage.googleapis.com'}/v1beta/models/${model}:generateContent?key=${this.apiKey}`;
        
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), options.timeoutMs || this.timeoutMs);

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    contents: [{ parts: [{ text: this.sanitizeInputPrompt(prompt) }] }],
                    generationConfig: {
                        temperature: options.temperature ?? 0.2,
                        maxOutputTokens: options.maxTokens ?? 1024
                    }
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Gemini API error [${response.status}]: ${errText}`);
            }

            const data = await response.json();
            recordCircuitSuccess(this.name);
            return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        } catch (err) {
            recordCircuitFailure(this.name);
            throw err;
        } finally {
            clearTimeout(timeout);
        }
    }

    async generateStructured(prompt, schema = {}, options = {}) {
        const strictPrompt = `${prompt}\n\nYou must return ONLY a valid, minified JSON object matching this schema. Do NOT include markdown code blocks, backticks, or explanatory text:\n${JSON.stringify(schema, null, 2)}`;
        const raw = await this.generateText(strictPrompt, options);
        return this.sanitizeJsonOutput(raw);
    }
}

/**
 * Anthropic Provider
 */
class AnthropicAIProvider extends BaseAIProvider {
    constructor(apiKey, config = {}) {
        super('anthropic', config);
        this.apiKey = apiKey;
    }

    async generateText(prompt, options = {}) {
        if (!checkCircuit(this.name)) {
            throw new Error(`Anthropic provider circuit breaker is OPEN (degraded). Request rejected.`);
        }

        const model = options.model || this.defaultModel || 'claude-3-haiku-20240307';
        const endpoint = `${this.config.baseUrl || 'https://api.anthropic.com'}/v1/messages`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), options.timeoutMs || this.timeoutMs);

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01',
                    'content-type': 'application/json'
                },
                signal: controller.signal,
                body: JSON.stringify({
                    model,
                    max_tokens: options.maxTokens ?? 1024,
                    messages: [{ role: 'user', content: this.sanitizeInputPrompt(prompt) }]
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Anthropic API error [${response.status}]: ${errText}`);
            }

            const data = await response.json();
            recordCircuitSuccess(this.name);
            return data.content?.[0]?.text || '';
        } catch (err) {
            recordCircuitFailure(this.name);
            throw err;
        } finally {
            clearTimeout(timeout);
        }
    }

    async generateStructured(prompt, schema = {}, options = {}) {
        const strictPrompt = `${prompt}\n\nRespond strictly with valid JSON conforming to this schema. No markdown fences or preamble:\n${JSON.stringify(schema, null, 2)}`;
        const raw = await this.generateText(strictPrompt, options);
        return this.sanitizeJsonOutput(raw);
    }
}

/**
 * OpenAI Provider
 */
class OpenAIProvider extends BaseAIProvider {
    constructor(apiKey, config = {}) {
        super('openai', config);
        this.apiKey = apiKey;
    }

    async generateText(prompt, options = {}) {
        if (!checkCircuit(this.name)) {
            throw new Error(`OpenAI provider circuit breaker is OPEN (degraded). Request rejected.`);
        }

        const model = options.model || this.defaultModel || 'gpt-4o-mini';
        const endpoint = `${this.config.baseUrl || 'https://api.openai.com'}/v1/chat/completions`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), options.timeoutMs || this.timeoutMs);

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                signal: controller.signal,
                body: JSON.stringify({
                    model,
                    messages: [{ role: 'user', content: this.sanitizeInputPrompt(prompt) }],
                    temperature: options.temperature ?? 0.2
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`OpenAI API error [${response.status}]: ${errText}`);
            }

            const data = await response.json();
            recordCircuitSuccess(this.name);
            return data.choices?.[0]?.message?.content || '';
        } catch (err) {
            recordCircuitFailure(this.name);
            throw err;
        } finally {
            clearTimeout(timeout);
        }
    }

    async generateStructured(prompt, schema = {}, options = {}) {
        const strictPrompt = `${prompt}\n\nRespond strictly with a valid JSON object matching:\n${JSON.stringify(schema, null, 2)}`;
        const raw = await this.generateText(strictPrompt, options);
        return this.sanitizeJsonOutput(raw);
    }
}

/**
 * Provider Factory
 */
function createAIProvider(config = {}) {
    const isTestMode = process.env.AI_TEST_MODE === 'true' || config.testMode === true;
    const providerType = (config.provider || process.env.AI_PROVIDER || 'mock').toLowerCase();

    // If test mode is enabled, force mock provider unless explicit live flag is passed
    if (isTestMode && !config.forceLive) {
        return new MockAIProvider(config);
    }

    try {
        if (providerType === 'gemini' && (config.apiKey || process.env.GEMINI_API_KEY)) {
            const key = config.apiKey || process.env.GEMINI_API_KEY;
            if (key && key !== 'mock_key' && !key.startsWith('mock')) {
                return new GeminiAIProvider(key, config);
            }
        }
        if (providerType === 'anthropic' && (config.apiKey || process.env.ANTHROPIC_API_KEY)) {
            const key = config.apiKey || process.env.ANTHROPIC_API_KEY;
            if (key && key !== 'mock_key' && !key.startsWith('mock')) {
                return new AnthropicAIProvider(key, config);
            }
        }
        if (providerType === 'openai' && (config.apiKey || process.env.OPENAI_API_KEY)) {
            const key = config.apiKey || process.env.OPENAI_API_KEY;
            if (key && key !== 'mock_key' && !key.startsWith('mock')) {
                return new OpenAIProvider(key, config);
            }
        }
    } catch (err) {
        logger.warn('Failed to initialize primary AI provider, falling back to mock engine', { error: err.message });
    }

    return new MockAIProvider(config);
}

module.exports = {
    BaseAIProvider,
    MockAIProvider,
    GeminiAIProvider,
    AnthropicAIProvider,
    OpenAIProvider,
    createAIProvider,
    getCircuitBreaker
};
