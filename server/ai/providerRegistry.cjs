/**
 * NostalgicVerse — Enterprise Multi-Provider Adapter & Task Router
 * =================================================================
 * Connects Multi-Provider Key Vault, Model Registry, and dynamic task routing.
 * Uses official @google/genai SDK for Google Gemini 3 series (gemini-3.1 to gemini-3.8).
 * Supports Anthropic, OpenAI, xAI, OpenRouter, Groq, Together, DeepSeek,
 * and standard OpenAI-compatible endpoints with auto-retry across healthy keys.
 * 
 * Thinking Levels: Minimal / Low / Medium / High (applied only when supported by model).
 * Auto Fallback: Optional fallback down the Gemini 3 hierarchy when quota/rate limits hit.
 */

'use strict';

const aiKeyVault = require('../services/aiKeyVaultService.cjs');
const modelRegistry = require('./modelRegistry.cjs');
const { dbAsync } = require('../db/index.cjs');

const DEFAULT_ALIASES = modelRegistry.DEFAULT_ALIASES;

/**
 * Resolve provider and model, resolving aliases if provided
 */
async function resolveModelAndProvider(requestedProvider, requestedModel) {
    let provider = (requestedProvider || 'GOOGLE').toUpperCase();
    let model = requestedModel || modelRegistry.DEFAULT_MODEL_ID;

    // Check if alias
    const aliasKey = (requestedModel || requestedProvider || '').toUpperCase();
    if (DEFAULT_ALIASES[aliasKey]) {
        const resolved = DEFAULT_ALIASES[aliasKey];
        provider = resolved.provider;
        model = resolved.model;
    }

    return { provider, model };
}

/**
 * Dispatch text/code generation request with automatic key rotation and optional model fallback
 */
async function generateWithKeyRotation({
    provider = 'GOOGLE',
    model = modelRegistry.DEFAULT_MODEL_ID,
    prompt,
    systemPrompt = '',
    temperature = 0.2,
    maxTokens = 4096,
    maxRetries = 3,
    thinkingLevel = null,
    autoFallback = false
}) {
    let currentProvider = provider.toUpperCase();
    let currentModel = model;

    // Resolve alias if needed
    if (DEFAULT_ALIASES && currentModel && DEFAULT_ALIASES[currentModel.toUpperCase()]) {
        const resolved = DEFAULT_ALIASES[currentModel.toUpperCase()];
        currentProvider = resolved.provider;
        currentModel = resolved.model;
    }

    const requestedModel = currentModel;
    let fallbackInfo = null;

    // Models loop: starts with currentModel, moves down fallback chain ONLY if autoFallback is enabled
    while (true) {
        let attempts = 0;
        const attemptedKeyIds = new Set();
        let lastError = null;
        let isRateLimitOrUnavailable = false;

        while (attempts < maxRetries) {
            attempts++;

            // 1. Get healthy key from vault (or .env fallback)
            const keyRecord = await aiKeyVault.getNextHealthyKey(currentProvider);

            if (!keyRecord) {
                if (currentProvider === 'GOOGLE') {
                    throw new Error(
                        'No Google Gemini API key configured. Please add an API key in the Owner Key Vault or set GEMINI_API_KEY in your .env file.'
                    );
                }
                throw new Error(`No healthy API keys available for provider: ${currentProvider}`);
            }

            // Prevent infinite loops on same key if only 1 key configured
            if (attemptedKeyIds.has(keyRecord.id) && attempts > 1) {
                break;
            }
            attemptedKeyIds.add(keyRecord.id);

            try {
                const result = await executeProviderRequest({
                    provider: currentProvider,
                    model: currentModel,
                    apiKey: keyRecord.decryptedKey,
                    baseUrl: keyRecord.customBaseUrl,
                    prompt,
                    systemPrompt,
                    temperature,
                    maxTokens,
                    thinkingLevel
                });

                // Record success telemetry
                await aiKeyVault.recordKeySuccess(keyRecord.id, result.tokensUsed || 0);

                return {
                    text: result.text,
                    provider: currentProvider,
                    model: currentModel,
                    requestedModel,
                    keyId: keyRecord.id,
                    keySuffix: keyRecord.keySuffix,
                    tokensUsed: result.tokensUsed || 0,
                    costUSD: result.costUSD || 0.0,
                    isEnvFallback: keyRecord.isEnvFallback || false,
                    fallback: fallbackInfo
                };
            } catch (err) {
                lastError = err;
                console.error(`[AI_ROUTER] Error with ${currentProvider} model ${currentModel} [${keyRecord.keySuffix}]:`, err.message);

                const msg = (err.message || '').toLowerCase();
                const isRateLimit = (
                    err.status === 429 || 
                    msg.includes('429') || 
                    msg.includes('rate limit') || 
                    msg.includes('quota') ||
                    msg.includes('resource_exhausted')
                );
                const isUnavailable = (
                    err.status === 404 || 
                    err.status === 503 ||
                    msg.includes('404') || 
                    msg.includes('503') ||
                    msg.includes('not found') || 
                    msg.includes('unavailable') ||
                    msg.includes('high demand')
                );

                if (isRateLimit || isUnavailable) {
                    isRateLimitOrUnavailable = true;
                }

                if (isRateLimit) {
                    await aiKeyVault.recordKeyRateLimit(keyRecord.id, 60);
                } else {
                    await aiKeyVault.recordKeyError(keyRecord.id, err.message);
                }

                // Retry with next key if available
                continue;
            }
        }

        // If we exhausted keys for currentModel, check if Auto Fallback is allowed
        if (autoFallback && currentProvider === 'GOOGLE' && isRateLimitOrUnavailable) {
            const nextModel = modelRegistry.getNextFallbackModel(currentModel);
            if (nextModel) {
                console.warn(`[AI_ROUTER] Auto fallback triggered: ${currentModel} ➔ ${nextModel} due to: ${lastError?.message}`);
                fallbackInfo = {
                    originalModel: requestedModel,
                    activeModel: nextModel,
                    reason: lastError?.message || 'Rate limited or model unavailable'
                };
                currentModel = nextModel;
                continue; // retry with fallback model
            }
        }

        // All retries failed and no fallback possible — throw genuine provider error
        const friendlyMsg = lastError ? lastError.message : 'All configured keys failed.';
        throw new Error(`[${currentProvider} ${currentModel} Error]: ${friendlyMsg}`);
    }
}

/**
 * Execute actual API call to provider using official SDKs
 */
async function executeProviderRequest({
    provider,
    model,
    apiKey,
    baseUrl,
    prompt,
    systemPrompt,
    temperature,
    maxTokens,
    thinkingLevel
}) {
    const p = provider.toUpperCase();

    // 1. GOOGLE GEMINI via official @google/genai SDK
    if (p === 'GOOGLE') {
        const { GoogleGenAI } = require('@google/genai');
        const client = new GoogleGenAI({ apiKey });

        let modelName = model || modelRegistry.DEFAULT_MODEL_ID;
        if (modelName.startsWith('models/')) modelName = modelName.replace('models/', '');

        const config = {
            systemInstruction: systemPrompt || undefined,
            temperature: temperature ?? 0.2,
            maxOutputTokens: maxTokens ?? 4096
        };

        // Thinking Level parameter — ONLY send if explicitly supported by model
        if (thinkingLevel && modelRegistry.isThinkingSupported(modelName, thinkingLevel)) {
            config.thinkingConfig = {
                thinkingLevel: thinkingLevel.toLowerCase(),
                includeThoughts: true
            };
        }

        try {
            const response = await client.models.generateContent({
                model: modelName,
                contents: prompt,
                config
            });

            // Extract generated text cleanly
            let text = response.text || '';
            if (!text && response.candidates?.[0]?.content?.parts) {
                text = response.candidates[0].content.parts
                    .filter(part => !part.thought && part.text)
                    .map(part => part.text)
                    .join('');
            }

            const usage = response.usageMetadata;
            const tokensUsed = usage?.totalTokenCount || Math.ceil((prompt.length + text.length) / 4);
            const costUSD = (tokensUsed / 1000000) * 0.15;

            return { text, tokensUsed, costUSD };
        } catch (err) {
            const msg = (err.message || '').toLowerCase();
            if (err.status === 400 || msg.includes('api_key_invalid') || msg.includes('api key not valid')) {
                const cleanErr = new Error('Invalid Google Gemini API key. Please check your API key in the Vault.');
                cleanErr.status = 400;
                throw cleanErr;
            }
            if (err.status === 429 || msg.includes('429') || msg.includes('quota') || msg.includes('resource_exhausted')) {
                const cleanErr = new Error(`Google Gemini rate limit exceeded for ${modelName} (429 Quota Exhausted).`);
                cleanErr.status = 429;
                throw cleanErr;
            }
            if (err.status === 404 || msg.includes('404') || msg.includes('not found')) {
                const cleanErr = new Error(`Model "${modelName}" is unavailable or not found on this account.`);
                cleanErr.status = 404;
                throw cleanErr;
            }
            throw err;
        }
    }

    // 2. ANTHROPIC CLAUDE
    if (p === 'ANTHROPIC') {
        const url = `${baseUrl || 'https://api.anthropic.com'}/v1/messages`;
        const body = {
            model: model || 'claude-3-5-sonnet-20241022',
            max_tokens: maxTokens ?? 4096,
            temperature: temperature ?? 0.2,
            messages: [{ role: 'user', content: prompt }]
        };
        if (systemPrompt) body.system = systemPrompt;

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const errText = await res.text();
            const err = new Error(`Anthropic Error ${res.status}: ${errText.slice(0, 150)}`);
            err.status = res.status;
            throw err;
        }

        const data = await res.json();
        const text = data.content?.[0]?.text || '';
        const tokensUsed = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);
        return { text, tokensUsed, costUSD: (tokensUsed / 1000000) * 3.0 };
    }

    // 3. OPENAI / OPENAI-COMPATIBLE (xAI, OpenRouter, Groq, Together, DeepSeek)
    if (['OPENAI', 'XAI', 'OPENROUTER', 'GROQ', 'TOGETHER', 'DEEPSEEK', 'CUSTOM'].includes(p)) {
        let endpoint = baseUrl;
        if (!endpoint) {
            if (p === 'XAI') endpoint = 'https://api.x.ai/v1/chat/completions';
            else if (p === 'OPENROUTER') endpoint = 'https://openrouter.ai/api/v1/chat/completions';
            else if (p === 'GROQ') endpoint = 'https://api.groq.com/openai/v1/chat/completions';
            else if (p === 'TOGETHER') endpoint = 'https://api.together.xyz/v1/chat/completions';
            else if (p === 'DEEPSEEK') endpoint = 'https://api.deepseek.com/v1/chat/completions';
            else endpoint = 'https://api.openai.com/v1/chat/completions';
        }

        const messages = [];
        if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
        messages.push({ role: 'user', content: prompt });

        const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: model || 'gpt-4o-mini',
                messages,
                temperature: temperature ?? 0.2,
                max_tokens: maxTokens ?? 4096
            })
        });

        if (!res.ok) {
            const errText = await res.text();
            const err = new Error(`${p} Error ${res.status}: ${errText.slice(0, 150)}`);
            err.status = res.status;
            throw err;
        }

        const data = await res.json();
        const text = data.choices?.[0]?.message?.content || '';
        const tokensUsed = data.usage ? data.usage.total_tokens : Math.ceil((prompt.length + text.length) / 4);
        return { text, tokensUsed, costUSD: (tokensUsed / 1000000) * 0.5 };
    }

    throw new Error(`Unsupported provider: "${p}"`);
}

/**
 * Task router: evaluates task intent to select optimal model/alias
 */
function routeTask(promptText) {
    const lower = (promptText || '').toLowerCase();

    if (lower.includes('image') || lower.includes('artwork') || lower.includes('poster') || lower.includes('cover')) {
        return { alias: 'IMAGE', recommendedProvider: 'OPENAI', recommendedModel: 'dall-e-3' };
    }
    if (lower.includes('architect') || lower.includes('refactor') || lower.includes('security') || lower.includes('audit')) {
        return { alias: 'POWERFUL', recommendedProvider: 'GOOGLE', recommendedModel: 'gemini-3.8-flash' };
    }
    if (lower.includes('add game') || lower.includes('generate') || lower.includes('create') || lower.includes('fix')) {
        return { alias: 'BALANCED', recommendedProvider: 'GOOGLE', recommendedModel: 'gemini-3.5-flash' };
    }

    return { alias: 'FAST', recommendedProvider: 'GOOGLE', recommendedModel: 'gemini-3.1-flash-lite' };
}

/**
 * List all available models from centralized registry
 */
async function getModelRegistry() {
    return modelRegistry.getAllModels();
}

const registryService = {
    resolveModelAndProvider,
    generateWithKeyRotation,
    executeProviderRequest,
    routeTask,
    getModelRegistry,
    DEFAULT_ALIASES
};

module.exports = {
    ...registryService,
    providerRegistry: registryService
};
