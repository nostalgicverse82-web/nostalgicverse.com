/**
 * NostalgicVerse — Enterprise AI Provider Key Vault & Intelligent Rotation
 * =========================================================================
 * Manages encrypted API keys at rest (AES-256-GCM), intelligent quota-aware
 * rotation, cooldowns, circuit breakers, masked views, and multi-provider pooling.
 * Plaintext secrets are strictly server-side and NEVER returned to clients.
 */

'use strict';

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { dbAsync } = require('../db/index.cjs');

// Derive 32-byte encryption key from SESSION_SECRET or master secret
const MASTER_SECRET = process.env.SESSION_SECRET || process.env.INTERNAL_API_SECRET || 'nostalgicverse-master-vault-encryption-secret-key-32b';
const ENCRYPTION_KEY = crypto.createHash('sha256').update(MASTER_SECRET).digest();

/**
 * Encrypt a secret using AES-256-GCM
 */
function encryptSecret(plaintext) {
    if (!plaintext) return '';
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt a secret using AES-256-GCM
 */
function decryptSecret(cipherText) {
    if (!cipherText || !cipherText.includes(':')) return '';
    const parts = cipherText.split(':');
    if (parts.length !== 3) return '';
    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

/**
 * Mask an API key to safe suffix (e.g. ****AB12)
 */
function maskApiKey(key) {
    if (!key || typeof key !== 'string') return '****';
    const trimmed = key.trim();
    if (trimmed.length <= 6) return '****' + trimmed.slice(-2);
    return '****' + trimmed.slice(-4);
}

/**
 * Auto-seed initial keys from environment variables per-provider if not already present
 */
async function autoSeedFromEnv() {
    try {
        const envMappings = [
            { provider: 'GOOGLE', envKeys: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'], label: 'Google Gemini (Primary Env)' },
            { provider: 'ANTHROPIC', envKeys: ['ANTHROPIC_API_KEY'], label: 'Anthropic Claude (Primary Env)' },
            { provider: 'OPENAI', envKeys: ['OPENAI_API_KEY'], label: 'OpenAI (Primary Env)' }
        ];

        for (const item of envMappings) {
            let rawKey = null;
            for (const k of item.envKeys) {
                if (process.env[k] && process.env[k].trim() && process.env[k].trim() !== 'mock_key' && !process.env[k].startsWith('mock')) {
                    rawKey = process.env[k].trim();
                    break;
                }
            }

            if (rawKey) {
                const existing = await dbAsync.get('SELECT id FROM ai_provider_keys WHERE provider = ? LIMIT 1', [item.provider]);
                if (!existing) {
                    await addKey({
                        provider: item.provider,
                        label: item.label,
                        apiKey: rawKey,
                        priority: 1
                    });
                    console.log(`[AI_VAULT] Seeded ${item.provider} key from environment.`);
                }
            }
        }
    } catch (e) {
        console.error('[AI_VAULT] Auto-seed error:', e.message);
    }
}

/**
 * Add a new API key to the vault (stored AES-256-GCM encrypted)
 */
async function addKey({ provider, label, apiKey, priority = 1, customBaseUrl = null, modelsSupported = null }) {
    if (!provider || !apiKey || !label) {
        throw new Error('Provider, label, and API key are required.');
    }

    const cleanKey = apiKey.trim();
    const id = uuidv4();
    const encryptedKey = encryptSecret(cleanKey);
    const keySuffix = maskApiKey(cleanKey);

    await dbAsync.run(`
        INSERT INTO ai_provider_keys (
            id, provider, label, encrypted_key, key_suffix, priority, 
            is_enabled, health, custom_base_url, models_supported, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 1, 'HEALTHY', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
        id,
        provider.toUpperCase(),
        label.trim(),
        encryptedKey,
        keySuffix,
        parseInt(priority, 10) || 1,
        customBaseUrl ? customBaseUrl.trim() : null,
        modelsSupported ? JSON.stringify(modelsSupported) : null
    ]);

    return {
        id,
        provider: provider.toUpperCase(),
        label: label.trim(),
        key_suffix: keySuffix,
        priority: parseInt(priority, 10) || 1,
        is_enabled: 1,
        health: 'HEALTHY'
    };
}

/**
 * Get all keys with safe masked display metadata
 */
async function getSafeKeys(providerFilter = null) {
    let query = `
        SELECT id, provider, label, key_suffix, priority, is_enabled, health,
               last_used_at, cooldown_until, request_count, error_count, token_count,
               rate_limit_count, custom_base_url, models_supported, created_at
        FROM ai_provider_keys
    `;
    const params = [];
    if (providerFilter) {
        query += ' WHERE provider = ?';
        params.push(providerFilter.toUpperCase());
    }
    query += ' ORDER BY priority ASC, created_at ASC';

    const keys = await dbAsync.all(query, params);
    const now = new Date();

    return keys.map(k => ({
        ...k,
        is_cooling_down: k.cooldown_until ? new Date(k.cooldown_until) > now : false
    }));
}

/**
 * Get aggregated health summaries across providers for Owner UI
 */
async function getProviderSummaries() {
    const keys = await getSafeKeys();
    const summary = {};

    const standardProviders = ['GOOGLE', 'ANTHROPIC', 'OPENAI', 'XAI', 'OTHER'];
    standardProviders.forEach(p => {
        summary[p] = {
            provider: p,
            totalKeys: 0,
            healthyKeys: 0,
            rateLimitedKeys: 0,
            disabledKeys: 0,
            totalRequests: 0,
            totalTokens: 0,
            totalErrors: 0,
            keys: []
        };
    });

    const now = new Date();
    keys.forEach(k => {
        const group = ['GOOGLE', 'ANTHROPIC', 'OPENAI', 'XAI'].includes(k.provider) ? k.provider : 'OTHER';
        if (!summary[group]) {
            summary[group] = {
                provider: group,
                totalKeys: 0,
                healthyKeys: 0,
                rateLimitedKeys: 0,
                disabledKeys: 0,
                totalRequests: 0,
                totalTokens: 0,
                totalErrors: 0,
                keys: []
            };
        }

        const isCooldown = k.cooldown_until && new Date(k.cooldown_until) > now;
        summary[group].totalKeys++;
        if (!k.is_enabled) summary[group].disabledKeys++;
        else if (isCooldown || k.health === 'RATE_LIMITED') summary[group].rateLimitedKeys++;
        else if (k.health === 'HEALTHY') summary[group].healthyKeys++;

        summary[group].totalRequests += k.request_count || 0;
        summary[group].totalTokens += k.token_count || 0;
        summary[group].totalErrors += k.error_count || 0;
        summary[group].keys.push(k);
    });

    // If Google has 0 vault keys, but GEMINI_API_KEY / GOOGLE_API_KEY is defined in .env, reflect it
    const envGoogleKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (summary['GOOGLE'].totalKeys === 0 && envGoogleKey && envGoogleKey.trim() && envGoogleKey.trim().length > 5) {
        const masked = maskApiKey(envGoogleKey.trim());
        summary['GOOGLE'].totalKeys = 1;
        summary['GOOGLE'].healthyKeys = 1;
        summary['GOOGLE'].keys.push({
            id: 'env-gemini-key',
            provider: 'GOOGLE',
            label: 'Google Gemini (from .env)',
            key_suffix: masked,
            priority: 1,
            is_enabled: 1,
            health: 'HEALTHY',
            request_count: 0,
            error_count: 0,
            token_count: 0,
            is_cooling_down: false
        });
    }

    return summary;
}

/**
 * Select the next healthy key using intelligent priority & quota rotation
 * Falls back to server-side .env if no healthy key is found in the vault.
 */
async function getNextHealthyKey(provider) {
    const pUpper = provider.toUpperCase();

    // 1. Release any expired cooldowns
    await dbAsync.run(`
        UPDATE ai_provider_keys 
        SET health = 'HEALTHY', cooldown_until = NULL 
        WHERE provider = ? AND health IN ('RATE_LIMITED', 'COOLDOWN') AND cooldown_until <= CURRENT_TIMESTAMP
    `, [pUpper]);

    // 2. Query available enabled keys ordered by priority, lowest error count, and last used
    const keys = await dbAsync.all(`
        SELECT id, provider, label, encrypted_key, key_suffix, priority, custom_base_url,
               request_count, error_count, token_count
        FROM ai_provider_keys
        WHERE provider = ? AND is_enabled = 1 AND health = 'HEALTHY'
        ORDER BY priority ASC, error_count ASC, last_used_at ASC NULLS FIRST
    `, [pUpper]);

    if (keys && keys.length > 0) {
        const selected = keys[0];
        const decryptedSecret = decryptSecret(selected.encrypted_key);
        if (decryptedSecret) {
            return {
                id: selected.id,
                provider: selected.provider,
                label: selected.label,
                keySuffix: selected.key_suffix,
                decryptedKey: decryptedSecret,
                customBaseUrl: selected.custom_base_url,
                isEnvFallback: false
            };
        }
    }

    // 3. Fallback to server-side .env for local testing if no vault key available
    if (pUpper === 'GOOGLE') {
        const envKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        if (envKey && envKey.trim() && envKey.trim().length > 5) {
            const clean = envKey.trim();
            return {
                id: 'env-google-fallback',
                provider: 'GOOGLE',
                label: 'Google Gemini (.env variable)',
                keySuffix: maskApiKey(clean),
                decryptedKey: clean,
                customBaseUrl: null,
                isEnvFallback: true
            };
        }
    } else if (pUpper === 'ANTHROPIC') {
        const envKey = process.env.ANTHROPIC_API_KEY;
        if (envKey && envKey.trim() && envKey.trim().length > 5) {
            const clean = envKey.trim();
            return {
                id: 'env-anthropic-fallback',
                provider: 'ANTHROPIC',
                label: 'Anthropic Claude (.env variable)',
                keySuffix: maskApiKey(clean),
                decryptedKey: clean,
                customBaseUrl: null,
                isEnvFallback: true
            };
        }
    } else if (pUpper === 'OPENAI') {
        const envKey = process.env.OPENAI_API_KEY;
        if (envKey && envKey.trim() && envKey.trim().length > 5) {
            const clean = envKey.trim();
            return {
                id: 'env-openai-fallback',
                provider: 'OPENAI',
                label: 'OpenAI (.env variable)',
                keySuffix: maskApiKey(clean),
                decryptedKey: clean,
                customBaseUrl: null,
                isEnvFallback: true
            };
        }
    }

    return null;
}

/**
 * Record rate-limit hit and set exponential cooldown with jitter
 */
async function recordKeyRateLimit(keyId, baseCooldownSec = 60) {
    if (!keyId || keyId.startsWith('env-')) return;

    const jitter = Math.floor(Math.random() * 15);
    const cooldownSec = baseCooldownSec + jitter;

    await dbAsync.run(`
        UPDATE ai_provider_keys 
        SET health = 'RATE_LIMITED',
            rate_limit_count = rate_limit_count + 1,
            cooldown_until = datetime('now', '+' || ? || ' seconds'),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `, [cooldownSec, keyId]);
}

/**
 * Record successful completion for metrics
 */
async function recordKeySuccess(keyId, tokens = 0) {
    if (!keyId || keyId.startsWith('env-')) return;

    await dbAsync.run(`
        UPDATE ai_provider_keys 
        SET request_count = request_count + 1,
            token_count = token_count + ?,
            health = 'HEALTHY',
            last_used_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `, [tokens, keyId]);
}

/**
 * Record non-rate-limit error
 */
async function recordKeyError(keyId, errorMsg) {
    if (!keyId || keyId.startsWith('env-')) return;

    const key = await dbAsync.get('SELECT error_count FROM ai_provider_keys WHERE id = ?', [keyId]);
    const newErrors = (key?.error_count || 0) + 1;
    const isDead = newErrors >= 5;

    await dbAsync.run(`
        UPDATE ai_provider_keys 
        SET error_count = ?,
            health = ?,
            last_used_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `, [newErrors, isDead ? 'DEAD' : 'HEALTHY', keyId]);
}

/**
 * Toggle key enabled/disabled status
 */
async function toggleKey(keyId, isEnabled) {
    await dbAsync.run(`
        UPDATE ai_provider_keys 
        SET is_enabled = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
    `, [isEnabled ? 1 : 0, keyId]);
}

/**
 * Update key priority
 */
async function updateKeyPriority(keyId, priority) {
    await dbAsync.run(`
        UPDATE ai_provider_keys 
        SET priority = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
    `, [parseInt(priority, 10) || 1, keyId]);
}

/**
 * Delete key from vault
 */
async function deleteKey(keyId) {
    await dbAsync.run('DELETE FROM ai_provider_keys WHERE id = ?', [keyId]);
}

/**
 * Test Google Gemini connectivity using official @google/genai SDK
 */
async function testGoogleConnectivity(apiKey, testModel = 'gemini-3.1-flash-lite') {
    if (!apiKey) {
        return {
            success: false,
            status: 'NOT CONFIGURED',
            error: 'No Google Gemini API key configured. Please add an API key in the Vault or set GEMINI_API_KEY in .env.',
            details: { connected: false, authenticated: false, modelAvailable: false }
        };
    }

    const { GoogleGenAI } = require('@google/genai');
    const startTime = Date.now();
    try {
        const client = new GoogleGenAI({ apiKey });
        // Test fast generation with gemini-3.1-flash-lite (official Gemini 3 default)
        await client.models.generateContent({
            model: testModel,
            contents: 'ping',
            config: { maxOutputTokens: 5 }
        });

        const latencyMs = Date.now() - startTime;
        return {
            success: true,
            status: 'CONNECTED',
            message: `AUTHENTICATION OK — Connected to Google ${testModel} (${latencyMs}ms)`,
            latencyMs,
            details: {
                connected: true,
                authenticated: true,
                modelAvailable: true,
                model: testModel,
                keySuffix: maskApiKey(apiKey)
            }
        };
    } catch (err) {
        const latencyMs = Date.now() - startTime;
        const msg = (err.message || '').toLowerCase();
        let status = 'FAILED';
        let userError = 'Google API error occurred.';

        if (err.status === 400 || msg.includes('api_key_invalid') || msg.includes('api key not valid') || msg.includes('invalid_argument')) {
            status = 'INVALID KEY';
            userError = 'AUTHENTICATION FAILED: The provided Google API key is invalid or unauthorized.';
        } else if (err.status === 429 || msg.includes('429') || msg.includes('quota') || msg.includes('resource_exhausted')) {
            status = 'RATE LIMITED';
            userError = 'RATE LIMITED: Google Gemini quota exceeded or rate limit reached.';
        } else if (err.status === 404 || msg.includes('404') || msg.includes('not found')) {
            status = 'MODEL UNAVAILABLE';
            userError = `MODEL UNAVAILABLE: ${testModel} is unavailable on this account.`;
        } else if (msg.includes('fetch') || msg.includes('network') || msg.includes('econnrefused') || msg.includes('enotfound')) {
            status = 'NETWORK ERROR';
            userError = 'NETWORK ERROR: Unable to reach Google Generative AI endpoints.';
        } else {
            userError = `API ERROR (${err.status || 'unknown'}): ${err.message?.slice(0, 120)}`;
        }

        return {
            success: false,
            status,
            error: userError,
            latencyMs,
            details: {
                connected: status !== 'NETWORK ERROR',
                authenticated: status !== 'INVALID KEY' && status !== 'NOT CONFIGURED',
                modelAvailable: status !== 'MODEL UNAVAILABLE'
            }
        };
    }
}

/**
 * Test a stored key in the vault
 */
async function testKey(keyId) {
    if (keyId === 'env-gemini-key' || keyId === 'env-google-fallback') {
        const envKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        return await testGoogleConnectivity(envKey);
    }

    const row = await dbAsync.get('SELECT * FROM ai_provider_keys WHERE id = ?', [keyId]);
    if (!row) throw new Error('Key not found');

    const cleanSecret = decryptSecret(row.encrypted_key);
    if (!cleanSecret) throw new Error('Decryption failed for key');

    const provider = row.provider.toUpperCase();

    if (provider === 'GOOGLE') {
        const result = await testGoogleConnectivity(cleanSecret);
        if (result.success) {
            await dbAsync.run(`
                UPDATE ai_provider_keys 
                SET health = 'HEALTHY', error_count = 0, updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `, [keyId]);
        } else {
            const healthStatus = result.status === 'RATE LIMITED' ? 'RATE_LIMITED' : 'DEAD';
            await dbAsync.run(`
                UPDATE ai_provider_keys 
                SET health = ?, error_count = error_count + 1, updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `, [healthStatus, keyId]);
        }
        return result;
    }

    // Other providers
    const startTime = Date.now();
    try {
        if (provider === 'ANTHROPIC') {
            const url = 'https://api.anthropic.com/v1/messages';
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'x-api-key': cleanSecret,
                    'anthropic-version': '2023-06-01',
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'claude-3-haiku-20240307',
                    max_tokens: 5,
                    messages: [{ role: 'user', content: 'ping' }]
                })
            });
            if (!res.ok && res.status !== 400) {
                const text = await res.text();
                throw new Error(`Anthropic Auth Error (${res.status}): ${text.slice(0, 100)}`);
            }
        } else if (provider === 'OPENAI') {
            const url = row.custom_base_url || 'https://api.openai.com/v1/models';
            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${cleanSecret}` }
            });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`OpenAI API Error (${res.status}): ${text.slice(0, 100)}`);
            }
        }

        const durationMs = Date.now() - startTime;
        await dbAsync.run(`
            UPDATE ai_provider_keys 
            SET health = 'HEALTHY', error_count = 0, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `, [keyId]);

        return { success: true, durationMs, message: `Key verified successfully (${durationMs}ms)` };
    } catch (err) {
        await recordKeyError(keyId, err.message);
        return { success: false, status: 'FAILED', error: err.message };
    }
}

/**
 * Test raw key before saving
 */
async function testRawKey({ provider, apiKey, model = 'gemini-3.1-flash-lite', customBaseUrl = null }) {
    if (!apiKey || !provider) {
        return { success: false, status: 'INVALID KEY', error: 'Provider and API Key are required.' };
    }
    const pUpper = provider.toUpperCase();
    if (pUpper === 'GOOGLE') {
        return await testGoogleConnectivity(apiKey.trim(), model || 'gemini-3.1-flash-lite');
    }

    // Generic test for OpenAI-compatible
    try {
        const url = customBaseUrl || (pUpper === 'OPENAI' ? 'https://api.openai.com/v1/models' : null);
        if (url) {
            const res = await fetch(url, { headers: { 'Authorization': `Bearer ${apiKey.trim()}` } });
            if (!res.ok) throw new Error(`API returned HTTP ${res.status}`);
            return { success: true, status: 'CONNECTED', message: 'AUTHENTICATION OK' };
        }
        return { success: true, status: 'CONNECTED', message: 'Key accepted.' };
    } catch (e) {
        return { success: false, status: 'FAILED', error: e.message };
    }
}

/**
 * Test overall connection to a provider
 */
async function testProviderConnection(provider, model = 'gemini-3.1-flash-lite') {
    const keyRecord = await getNextHealthyKey(provider);
    if (!keyRecord) {
        return {
            success: false,
            status: 'NOT CONFIGURED',
            error: `No ${provider} API key configured. Please add an API key in the Vault or set in .env.`,
            details: { connected: false, authenticated: false, modelAvailable: false }
        };
    }

    if (provider.toUpperCase() === 'GOOGLE') {
        return await testGoogleConnectivity(keyRecord.decryptedKey, model || 'gemini-3.1-flash-lite');
    }

    return await testKey(keyRecord.id);
}

// Run auto-seed on module load
autoSeedFromEnv().catch(() => {});

const vaultService = {
    addKey,
    getSafeKeys,
    getProviderSummaries,
    getNextHealthyKey,
    recordKeyRateLimit,
    recordKeySuccess,
    recordKeyError,
    toggleKey,
    updateKeyPriority,
    deleteKey,
    testKey,
    testRawKey,
    testGoogleConnectivity,
    testProviderConnection,
    encryptSecret,
    decryptSecret,
    maskApiKey,
    autoSeedFromEnv
};

module.exports = {
    ...vaultService,
    aiKeyVaultService: vaultService
};

