/**
 * NostalgicVerse — News Intelligence Engine (Phase 15)
 * 
 * Manages:
 * - Canonical news articles and editorial curation
 * - Factual statuses (CONFIRMED, OFFICIAL, REPORTED, RUMOR, UNVERIFIED)
 * - Source requirements for publication
 * - Duplicate detection
 * - Article versioning and change audit trail
 * - Content relationships (games, consoles, timeline)
 */

const { dbAsync } = require('../db/index.cjs');
const { v4: uuidv4 } = require('uuid');

const VALID_FACTUAL_STATUSES = ['CONFIRMED', 'OFFICIAL', 'REPORTED', 'RUMOR', 'UNVERIFIED'];
const VALID_ARTICLE_STATUSES = ['DRAFT', 'REVIEW', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED', 'HELD'];

function slugify(text) {
    if (!text) return '';
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/[\s\W-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/**
 * Validate news article data before creation or publication
 */
function validateArticle(articleData, isPublishing = false) {
    const errors = [];

    if (!articleData.title || typeof articleData.title !== 'string' || articleData.title.trim().length < 3) {
        errors.push('Title must be at least 3 characters long');
    }

    if (articleData.factual_status && !VALID_FACTUAL_STATUSES.includes(articleData.factual_status)) {
        errors.push(`Invalid factual status. Allowed: ${VALID_FACTUAL_STATUSES.join(', ')}`);
    }

    if (articleData.status && !VALID_ARTICLE_STATUSES.includes(articleData.status)) {
        errors.push(`Invalid article status. Allowed: ${VALID_ARTICLE_STATUSES.join(', ')}`);
    }

    // Publishing requirement: Must have body, summary, and at least one verifiable source
    if (isPublishing) {
        if (!articleData.body || articleData.body.trim().length < 50) {
            errors.push('Published articles must have a body of at least 50 characters');
        }
        if (!articleData.summary || articleData.summary.trim().length < 10) {
            errors.push('Published articles must have an editorial summary');
        }
        if (!articleData.primary_source && (!articleData.sources || articleData.sources.length === 0)) {
            errors.push('Published articles require at least one verified source URL or citation');
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Check for potential duplicate news articles
 */
async function checkDuplicateArticle(title, excludeId = null) {
    const normalized = slugify(title);
    let sql = 'SELECT id, title, slug, published_date FROM news_articles WHERE status != "ARCHIVED"';
    const params = [];

    if (excludeId) {
        sql += ' AND id != ?';
        params.push(excludeId);
    }

    const rows = await dbAsync.all(sql, params);
    for (const row of rows) {
        const rowNorm = slugify(row.title);
        if (rowNorm === normalized || row.slug === normalized) {
            return { isDuplicate: true, duplicateOf: row };
        }
    }

    return { isDuplicate: false };
}

/**
 * Create a new news article
 */
async function createArticle(data, userId = null) {
    const validation = validateArticle(data, data.status === 'PUBLISHED');
    if (!validation.valid) {
        throw new Error(validation.errors.join('; '));
    }

    const dupCheck = await checkDuplicateArticle(data.title);
    if (dupCheck.isDuplicate) {
        throw new Error(`Duplicate article detected with similar headline: "${dupCheck.duplicateOf.title}"`);
    }

    const id = data.id || `news-${uuidv4().slice(0, 8)}`;
    let slug = data.slug || slugify(data.title);

    // Verify slug uniqueness
    const existingSlug = await dbAsync.get('SELECT id FROM news_articles WHERE slug = ?', [slug]);
    if (existingSlug) {
        slug = `${slug}-${Date.now().toString().slice(-4)}`;
    }

    const initialHistory = JSON.stringify([{
        action: 'CREATED',
        userId,
        timestamp: new Date().toISOString(),
        status: data.status || 'DRAFT'
    }]);

    const sources = Array.isArray(data.sources) ? JSON.stringify(data.sources) : (data.sources || null);
    const relatedGames = Array.isArray(data.related_games) ? JSON.stringify(data.related_games) : (data.related_games || null);
    const relatedConsoles = Array.isArray(data.related_consoles) ? JSON.stringify(data.related_consoles) : (data.related_consoles || null);
    const tags = Array.isArray(data.tags) ? JSON.stringify(data.tags) : (data.tags || '[]');

    let sourceDomain = null;
    if (data.primary_source) {
        try { sourceDomain = new URL(data.primary_source).hostname; } catch (e) {}
    }

    const publishedDate = data.status === 'PUBLISHED' ? (data.published_date || new Date().toISOString()) : null;

    await dbAsync.run(`
        INSERT INTO news_articles (
            id, title, slug, summary, body, hero_image, tags, status, factual_status,
            primary_source, source_domain, sources, related_games, related_consoles,
            editorial_notes, change_history, published_date, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
        id,
        data.title.trim(),
        slug,
        data.summary || null,
        data.body || null,
        data.hero_image || null,
        tags,
        data.status || 'DRAFT',
        data.factual_status || 'CONFIRMED',
        data.primary_source || null,
        sourceDomain,
        sources,
        relatedGames,
        relatedConsoles,
        data.editorial_notes || null,
        initialHistory,
        publishedDate
    ]);

    return await getArticleById(id);
}

/**
 * Update an existing news article with version audit tracking
 */
async function updateArticle(id, updates, userId = null) {
    const existing = await getArticleById(id);
    if (!existing) {
        throw new Error(`News article with ID "${id}" not found`);
    }

    const isPublishing = updates.status === 'PUBLISHED' && existing.status !== 'PUBLISHED';
    const validation = validateArticle({ ...existing, ...updates }, isPublishing || updates.status === 'PUBLISHED');
    if (!validation.valid) {
        throw new Error(validation.errors.join('; '));
    }

    if (updates.title && updates.title !== existing.title) {
        const dupCheck = await checkDuplicateArticle(updates.title, id);
        if (dupCheck.isDuplicate) {
            throw new Error(`Duplicate article detected with similar headline: "${dupCheck.duplicateOf.title}"`);
        }
    }

    // Slug change handling
    let newSlug = existing.slug;
    if (updates.slug && updates.slug !== existing.slug) {
        const slugConflict = await dbAsync.get('SELECT id FROM news_articles WHERE slug = ? AND id != ?', [updates.slug, id]);
        if (slugConflict) {
            throw new Error(`Slug "${updates.slug}" is already in use by another article`);
        }
        newSlug = updates.slug;

        // Record slug change in slug_history
        await dbAsync.run(`
            INSERT INTO slug_history (id, entity_type, entity_id, old_slug, new_slug, changed_by, changed_at)
            VALUES (?, 'NEWS', ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [uuidv4(), id, existing.slug, newSlug, userId]);
    }

    // Parse and append change history
    let history = [];
    if (Array.isArray(existing.change_history)) {
        history = [...existing.change_history];
    } else if (typeof existing.change_history === 'string') {
        try { history = JSON.parse(existing.change_history); } catch (e) {}
    }

    history.push({
        action: isPublishing ? 'PUBLISHED' : 'UPDATED',
        userId,
        timestamp: new Date().toISOString(),
        changes: Object.keys(updates)
    });

    let sourceDomain = existing.source_domain;
    if (updates.primary_source) {
        try { sourceDomain = new URL(updates.primary_source).hostname; } catch (e) {}
    }

    const publishedDate = isPublishing ? new Date().toISOString() : existing.published_date;

    await dbAsync.run(`
        UPDATE news_articles SET
            title = COALESCE(?, title),
            slug = ?,
            summary = COALESCE(?, summary),
            body = COALESCE(?, body),
            hero_image = COALESCE(?, hero_image),
            tags = COALESCE(?, tags),
            status = COALESCE(?, status),
            factual_status = COALESCE(?, factual_status),
            primary_source = COALESCE(?, primary_source),
            source_domain = ?,
            sources = COALESCE(?, sources),
            related_games = COALESCE(?, related_games),
            related_consoles = COALESCE(?, related_consoles),
            editorial_notes = COALESCE(?, editorial_notes),
            change_history = ?,
            published_date = COALESCE(?, published_date),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `, [
        updates.title || null,
        newSlug,
        updates.summary || null,
        updates.body || null,
        updates.hero_image || null,
        updates.tags ? JSON.stringify(updates.tags) : null,
        updates.status || null,
        updates.factual_status || null,
        updates.primary_source || null,
        sourceDomain,
        updates.sources ? JSON.stringify(updates.sources) : null,
        updates.related_games ? JSON.stringify(updates.related_games) : null,
        updates.related_consoles ? JSON.stringify(updates.related_consoles) : null,
        updates.editorial_notes || null,
        JSON.stringify(history),
        publishedDate,
        id
    ]);

    return await getArticleById(id);
}

async function getArticleById(id) {
    const row = await dbAsync.get('SELECT * FROM news_articles WHERE id = ?', [id]);
    return formatArticle(row);
}

async function getArticleBySlug(slug) {
    const row = await dbAsync.get('SELECT * FROM news_articles WHERE slug = ?', [slug]);
    return formatArticle(row);
}

function formatArticle(row) {
    if (!row) return null;
    let tags = [];
    let sources = [];
    let relatedGames = [];
    let relatedConsoles = [];
    let changeHistory = [];

    try { tags = JSON.parse(row.tags || '[]'); } catch (e) {}
    try { sources = JSON.parse(row.sources || '[]'); } catch (e) {}
    try { relatedGames = JSON.parse(row.related_games || '[]'); } catch (e) {}
    try { relatedConsoles = JSON.parse(row.related_consoles || '[]'); } catch (e) {}
    try { changeHistory = JSON.parse(row.change_history || '[]'); } catch (e) {}

    return {
        ...row,
        tags,
        sources,
        related_games: relatedGames,
        related_consoles: relatedConsoles,
        change_history: changeHistory
    };
}

module.exports = {
    VALID_FACTUAL_STATUSES,
    VALID_ARTICLE_STATUSES,
    validateArticle,
    checkDuplicateArticle,
    createArticle,
    updateArticle,
    getArticleById,
    getArticleBySlug,
    slugify
};
