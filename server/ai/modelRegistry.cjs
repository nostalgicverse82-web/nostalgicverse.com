/**
 * NostalgicVerse — Autonomous AI Centralized Model Registry
 * =========================================================
 * Authoritative registry for Google Gemini 3 series, Claude, OpenAI, and xAI.
 * Defines capabilities, token limits, speed tiers, thinking configurations,
 * and deterministic fallback hierarchy.
 */

'use strict';

const MODEL_CATALOG = [
    // ----------------------------------------------------
    // GOOGLE GEMINI 3 OFFICIAL SUITE (Current Supported Series)
    // ----------------------------------------------------
    {
        displayName: 'Gemini 3.1 Flash-Lite (Default)',
        modelId: 'gemini-3.1-flash-lite',
        provider: 'GOOGLE',
        status: 'active',
        capabilities: ['chat', 'code', 'vision', 'structured', 'tools'],
        thinkingLevels: ['minimal', 'low'],
        contextLimit: 1000000,
        inputTypes: ['text', 'code', 'image'],
        outputTypes: ['text', 'code'],
        deprecated: false,
        disabled: false,
        alias: 'FAST',
        isDefault: true
    },
    {
        displayName: 'Gemini 3.5 Flash-Lite',
        modelId: 'gemini-3.5-flash-lite',
        provider: 'GOOGLE',
        status: 'active',
        capabilities: ['chat', 'code', 'vision', 'structured', 'tools'],
        thinkingLevels: ['minimal', 'low'],
        contextLimit: 1000000,
        inputTypes: ['text', 'code', 'image'],
        outputTypes: ['text', 'code'],
        deprecated: false,
        disabled: false,
        alias: null,
        isDefault: false
    },
    {
        displayName: 'Gemini 3.5 Flash',
        modelId: 'gemini-3.5-flash',
        provider: 'GOOGLE',
        status: 'active',
        capabilities: ['chat', 'code', 'vision', 'structured', 'tools', 'thinking'],
        thinkingLevels: ['minimal', 'low', 'medium'],
        contextLimit: 1000000,
        inputTypes: ['text', 'code', 'image'],
        outputTypes: ['text', 'code'],
        deprecated: false,
        disabled: false,
        alias: 'BALANCED',
        isDefault: false
    },
    {
        displayName: 'Gemini 3.6 Flash',
        modelId: 'gemini-3.6-flash',
        provider: 'GOOGLE',
        status: 'active',
        capabilities: ['chat', 'code', 'vision', 'structured', 'tools', 'thinking'],
        thinkingLevels: ['minimal', 'low', 'medium', 'high'],
        contextLimit: 1000000,
        inputTypes: ['text', 'code', 'image'],
        outputTypes: ['text', 'code'],
        deprecated: false,
        disabled: false,
        alias: null,
        isDefault: false
    },
    {
        displayName: 'Gemini 3.7 Flash',
        modelId: 'gemini-3.7-flash',
        provider: 'GOOGLE',
        status: 'active',
        capabilities: ['chat', 'code', 'vision', 'structured', 'tools', 'thinking', 'hybrid_reasoning'],
        thinkingLevels: ['minimal', 'low', 'medium', 'high'],
        contextLimit: 1000000,
        inputTypes: ['text', 'code', 'image'],
        outputTypes: ['text', 'code'],
        deprecated: false,
        disabled: false,
        alias: null,
        isDefault: false
    },
    {
        displayName: 'Gemini 3.8 Flash',
        modelId: 'gemini-3.8-flash',
        provider: 'GOOGLE',
        status: 'active',
        capabilities: ['chat', 'code', 'vision', 'structured', 'tools', 'thinking', 'deep_reasoning'],
        thinkingLevels: ['minimal', 'low', 'medium', 'high'],
        contextLimit: 2000000,
        inputTypes: ['text', 'code', 'image'],
        outputTypes: ['text', 'code'],
        deprecated: false,
        disabled: false,
        alias: 'POWERFUL',
        isDefault: false
    },

    // ----------------------------------------------------
    // ANTHROPIC CLAUDE SUITE
    // ----------------------------------------------------
    {
        displayName: 'Claude 3.5 Sonnet',
        modelId: 'claude-3-5-sonnet-20241022',
        provider: 'ANTHROPIC',
        status: 'active',
        capabilities: ['chat', 'code', 'vision', 'structured', 'tools', 'reasoning'],
        thinkingLevels: [],
        contextLimit: 200000,
        inputTypes: ['text', 'code', 'image'],
        outputTypes: ['text', 'code'],
        deprecated: false,
        disabled: false,
        alias: 'POWERFUL',
        isDefault: false
    },
    {
        displayName: 'Claude 3 Haiku',
        modelId: 'claude-3-haiku-20240307',
        provider: 'ANTHROPIC',
        status: 'active',
        capabilities: ['chat', 'code', 'structured', 'tools'],
        thinkingLevels: [],
        contextLimit: 200000,
        inputTypes: ['text', 'code'],
        outputTypes: ['text', 'code'],
        deprecated: false,
        disabled: false,
        alias: 'FAST',
        isDefault: false
    },

    // ----------------------------------------------------
    // OPENAI & XAI SUITE
    // ----------------------------------------------------
    {
        displayName: 'GPT-4o',
        modelId: 'gpt-4o',
        provider: 'OPENAI',
        status: 'active',
        capabilities: ['chat', 'code', 'vision', 'tools'],
        thinkingLevels: [],
        contextLimit: 128000,
        inputTypes: ['text', 'code', 'image'],
        outputTypes: ['text', 'code'],
        deprecated: false,
        disabled: false,
        alias: 'BALANCED',
        isDefault: false
    },
    {
        displayName: 'GPT-4o Mini',
        modelId: 'gpt-4o-mini',
        provider: 'OPENAI',
        status: 'active',
        capabilities: ['chat', 'code', 'vision', 'tools'],
        thinkingLevels: [],
        contextLimit: 128000,
        inputTypes: ['text', 'code', 'image'],
        outputTypes: ['text', 'code'],
        deprecated: false,
        disabled: false,
        alias: 'FAST',
        isDefault: false
    },
    {
        displayName: 'DALL-E 3',
        modelId: 'dall-e-3',
        provider: 'OPENAI',
        status: 'active',
        capabilities: ['image_gen'],
        thinkingLevels: [],
        contextLimit: 0,
        inputTypes: ['text'],
        outputTypes: ['image'],
        deprecated: false,
        disabled: false,
        alias: 'IMAGE',
        isDefault: false
    },
    {
        displayName: 'Grok 2',
        modelId: 'grok-2',
        provider: 'XAI',
        status: 'active',
        capabilities: ['chat', 'code', 'tools'],
        thinkingLevels: [],
        contextLimit: 128000,
        inputTypes: ['text', 'code'],
        outputTypes: ['text', 'code'],
        deprecated: false,
        disabled: false,
        alias: 'POWERFUL',
        isDefault: false
    }
];

const DEFAULT_MODEL_ID = 'gemini-3.1-flash-lite';
const DEFAULT_PROVIDER = 'GOOGLE';

// Ordered fallback ladder: highest tier down to most lightweight
const GOOGLE_FALLBACK_CHAIN = [
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite'
];

const DEFAULT_ALIASES = {
    FAST: { provider: 'GOOGLE', model: 'gemini-3.1-flash-lite' },
    BALANCED: { provider: 'GOOGLE', model: 'gemini-3.5-flash' },
    POWERFUL: { provider: 'GOOGLE', model: 'gemini-3.8-flash' },
    IMAGE: { provider: 'OPENAI', model: 'dall-e-3' },
    VISION: { provider: 'GOOGLE', model: 'gemini-3.5-flash' },
    EMBEDDING: { provider: 'OPENAI', model: 'text-embedding-3-small' }
};

/**
 * Get all registered models
 */
function getAllModels() {
    return MODEL_CATALOG.filter(m => !m.disabled);
}

/**
 * Get models for a specific provider
 */
function getModelsByProvider(provider) {
    const p = (provider || 'GOOGLE').toUpperCase();
    return MODEL_CATALOG.filter(m => m.provider === p && !m.disabled);
}

/**
 * Find a specific model by ID or capability alias
 */
function getModel(modelId) {
    if (!modelId) return getModel(DEFAULT_MODEL_ID);
    const upper = modelId.toUpperCase().trim();
    if (DEFAULT_ALIASES[upper]) {
        return getModel(DEFAULT_ALIASES[upper].model);
    }
    const clean = modelId.toLowerCase().trim();
    return MODEL_CATALOG.find(m => m.modelId.toLowerCase() === clean);
}

/**
 * Validate whether thinking level is supported by the target model
 */
function isThinkingSupported(modelId, thinkingLevel) {
    if (!thinkingLevel || thinkingLevel === 'off') return false;
    const model = getModel(modelId);
    if (!model || !Array.isArray(model.thinkingLevels)) return false;
    return model.thinkingLevels.includes(thinkingLevel.toLowerCase());
}

/**
 * Get the next model down the fallback chain
 */
function getNextFallbackModel(currentModelId) {
    const clean = (currentModelId || '').toLowerCase().trim();
    const idx = GOOGLE_FALLBACK_CHAIN.indexOf(clean);
    if (idx !== -1 && idx < GOOGLE_FALLBACK_CHAIN.length - 1) {
        return GOOGLE_FALLBACK_CHAIN[idx + 1];
    }
    return null;
}

/**
 * Synchronize model catalog into the SQLite database table ai_model_registry
 */
async function syncToDatabase(dbAsync) {
    if (!dbAsync) return;

    try {
        // Remove obsolete 2.x and 1.x google models from DB
        await dbAsync.run(
            `DELETE FROM ai_model_registry WHERE provider = 'GOOGLE' AND model_id NOT IN (${GOOGLE_FALLBACK_CHAIN.map(() => '?').join(',')})`,
            GOOGLE_FALLBACK_CHAIN
        );

        for (const m of MODEL_CATALOG) {
            await dbAsync.run(`
                INSERT INTO ai_model_registry (
                    id, provider, model_id, display_name, alias, capabilities, context_window, speed_tier, cost_tier, is_active
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(provider, model_id) DO UPDATE SET
                    display_name = excluded.display_name,
                    alias = excluded.alias,
                    capabilities = excluded.capabilities,
                    context_window = excluded.context_window,
                    is_active = excluded.is_active
            `, [
                `${m.provider.toLowerCase()}-${m.modelId}`,
                m.provider,
                m.modelId,
                m.displayName,
                m.alias,
                JSON.stringify(m.capabilities),
                m.contextLimit,
                m.alias === 'POWERFUL' ? 'NORMAL' : 'FAST',
                'FREE_OR_CHEAP',
                m.disabled ? 0 : 1
            ]);
        }
    } catch (e) {
        console.warn('[ModelRegistry] Database sync warning:', e.message);
    }
}

module.exports = {
    MODEL_CATALOG,
    DEFAULT_MODEL_ID,
    DEFAULT_PROVIDER,
    GOOGLE_FALLBACK_CHAIN,
    DEFAULT_ALIASES,
    getAllModels,
    getModelsByProvider,
    getModel,
    isThinkingSupported,
    getNextFallbackModel,
    syncToDatabase
};

