/**
 * NostalgicVerse — News Intelligence & Fact Verification Engine (Phase 16)
 * =========================================================================
 * Pipeline:
 * DISCOVER -> SOURCE CANDIDATE -> FETCH -> EXTRACT -> VALIDATE -> DUPLICATE -> CONTRADICTION -> AI DRAFT -> OWNER REVIEW -> PUBLISH
 *
 * Enforces claim extraction, contradiction detection across conflicting sources,
 * duplicate suppression, and owner authorization before public exhibition.
 */

'use strict';

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { dbAsync } = require('../db/index.cjs');
const { safeFetchSource, normalizeUrl, computeContentHash } = require('./sourceFetchService.cjs');
const { enqueueAIJob } = require('./aiJobQueueService.cjs');
const { defaultLogger: logger } = require('../automation/logger.cjs');

function generateSlug(text) {
    return (text || '')
        .toLowerCase()
        .trim()
        .replace(/['’]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/**
 * Check if candidate news story is a duplicate of existing article or pending candidate
 */
async function checkNewsDuplicate(title, sourceUrl, contentHash) {
    const slug = generateSlug(title);
    const normUrl = normalizeUrl(sourceUrl);

    // 1. Check published articles
    const existingArticle = await dbAsync.get(`
        SELECT id, title, slug FROM news_articles 
        WHERE slug = ? OR primary_source = ? OR title LIKE ?
    `, [slug, normUrl, `%${title.trim()}%`]);

    if (existingArticle) {
        return { isDuplicate: true, duplicateOf: existingArticle.id, existingTitle: existingArticle.title };
    }

    // 2. Check pending candidates
    const pendingCandidate = await dbAsync.get(`
        SELECT id, title FROM news_candidates 
        WHERE (slug = ? OR source_url = ? OR source_hash = ?) AND status != 'REJECTED'
    `, [slug, normUrl, contentHash]);

    if (pendingCandidate) {
        return { isDuplicate: true, duplicateOf: pendingCandidate.id, existingTitle: pendingCandidate.title };
    }

    return { isDuplicate: false, duplicateOf: null };
}

/**
 * Cross-source contradiction check
 */
async function detectNewsContradictions(entityId, candidateClaims = []) {
    const conflicts = [];

    for (const claim of candidateClaims) {
        const { fieldName, value, sourceUrl } = claim;
        if (!fieldName || !value) continue;

        // Check if an opposing claim exists for this entity
        const priorClaims = await dbAsync.all(`
            SELECT * FROM content_claims 
            WHERE entity_id = ? AND claim_type = ?
        `, [entityId, fieldName]);

        for (const prior of priorClaims) {
            if (prior.claim_value.toLowerCase().trim() !== value.toLowerCase().trim()) {
                const conflictId = uuidv4();
                await dbAsync.run(`
                    INSERT INTO content_conflicts (id, entity_type, entity_id, field_name, source_a_url, source_a_value, source_b_url, source_b_value, status, created_at)
                    VALUES (?, 'NEWS', ?, ?, ?, ?, ?, ?, 'OPEN', CURRENT_TIMESTAMP)
                `, [conflictId, entityId, fieldName, prior.source_url || 'Prior Claim', prior.claim_value, sourceUrl, value]);

                conflicts.push({
                    conflictId,
                    fieldName,
                    priorValue: prior.claim_value,
                    newValue: value
                });
            }
        }

        // Store claim in provenance table
        await dbAsync.run(`
            INSERT INTO content_claims (id, entity_type, entity_id, claim_type, claim_value, source_url, verification_status, created_at)
            VALUES (?, 'NEWS', ?, ?, ?, ?, 'REPORTED', CURRENT_TIMESTAMP)
        `, [uuidv4(), entityId, fieldName, value, sourceUrl]);
    }

    return conflicts;
}

/**
 * Ingest and process a news source candidate
 */
async function ingestNewsCandidate({
    title,
    sourceUrl,
    customText = null,
    relatedGames = [],
    relatedConsoles = [],
    factualStatus = 'REPORTED',
    claims = []
}) {
    const candidateId = uuidv4();
    const slug = generateSlug(title);
    const normUrl = normalizeUrl(sourceUrl);

    let extractedText = customText;
    let contentHash = computeContentHash(title + '::' + normUrl);
    let domain = 'manual-input';

    // If sourceUrl is valid HTTP/HTTPS and no customText was provided, safely fetch
    if (!extractedText && (normUrl.startsWith('http://') || normUrl.startsWith('https://'))) {
        try {
            const fetched = await safeFetchSource(normUrl);
            extractedText = fetched.extractedText;
            contentHash = fetched.contentHash;
            domain = fetched.domain;
        } catch (err) {
            logger.warn(`[NEWS_INGEST] Remote fetch skipped or failed for ${normUrl}: ${err.message}`);
        }
    }

    // Duplicate check
    const dupCheck = await checkNewsDuplicate(title, normUrl, contentHash);
    const status = dupCheck.isDuplicate ? 'DUPLICATE' : 'DRAFTED';

    // Contradiction detection
    const conflicts = await detectNewsContradictions(candidateId, claims);
    const finalFactualStatus = conflicts.length > 0 ? 'CONFLICT' : factualStatus;

    // Queue AI summarization job if not duplicate
    let aiJobId = null;
    if (!dupCheck.isDuplicate) {
        const job = await enqueueAIJob({
            jobType: 'NEWS_SYNTHESIS',
            entityType: 'NEWS',
            entityId: candidateId,
            priority: finalFactualStatus === 'OFFICIAL' ? 'HIGH' : 'NORMAL',
            payload: {
                topic: title,
                sourceText: extractedText || title,
                sourceUrl: normUrl
            },
            idempotencyKey: `news:${slug}`
        });
        aiJobId = job.id;
    }

    // Persist news candidate
    await dbAsync.run(`
        INSERT INTO news_candidates (
            id, title, slug, source_url, source_hash, source_domain, 
            related_games, related_consoles, factual_status, duplicate_of, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
        candidateId, title, slug, normUrl, contentHash, domain,
        JSON.stringify(relatedGames), JSON.stringify(relatedConsoles), finalFactualStatus,
        dupCheck.duplicateOf, status
    ]);

    logger.info(`[NEWS_INGEST] Ingested candidate ${candidateId} ("${title}"). Status: ${status}, Factual: ${finalFactualStatus}`);

    return {
        candidateId,
        slug,
        status,
        factualStatus: finalFactualStatus,
        isDuplicate: dupCheck.isDuplicate,
        duplicateOf: dupCheck.duplicateOf,
        conflictsCount: conflicts.length,
        aiJobId
    };
}

/**
 * Owner approves news candidate and publishes to canonical news_articles
 */
async function publishNewsCandidate(candidateId, reviewerId, overrideData = {}) {
    const candidate = await dbAsync.get('SELECT * FROM news_candidates WHERE id = ?', [candidateId]);
    if (!candidate) throw new Error('News candidate not found');

    const articleId = uuidv4();
    const finalTitle = overrideData.title || candidate.title;
    const finalSlug = overrideData.slug || candidate.slug;
    const finalContent = overrideData.content || overrideData.summary || `Exhibition retrospective on ${finalTitle}.`;
    const finalStatus = candidate.factual_status === 'CONFLICT' && !overrideData.resolveConflict ? 'CONFLICT' : 'PUBLISHED';

    let resolvedReviewer = reviewerId;
    try {
        const u = await dbAsync.get('SELECT id FROM users WHERE id = ? OR username = ?', [reviewerId, reviewerId]);
        if (u) resolvedReviewer = u.id;
        else resolvedReviewer = null;
    } catch (_) {
        resolvedReviewer = null;
    }

    await dbAsync.transaction(async (tx) => {
        await tx.run(`
            INSERT INTO news_articles (
                id, title, slug, summary, body, 
                primary_source, source_domain, factual_status, status, published_date, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [
            articleId, finalTitle, finalSlug, finalContent.slice(0, 200), finalContent,
            candidate.source_url, candidate.source_domain, candidate.factual_status, finalStatus
        ]);

        await tx.run(`
            UPDATE news_candidates 
            SET status = 'PUBLISHED', updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `, [candidateId]);

        // Resolve open conflicts if instructed
        if (overrideData.resolveConflict) {
            await tx.run(`
                UPDATE content_conflicts 
                SET status = 'RESOLVED', resolved_by = ?, resolved_at = CURRENT_TIMESTAMP 
                WHERE entity_id = ?
            `, [resolvedReviewer, candidateId]);
        }
    });

    logger.info(`[NEWS_INGEST] Candidate ${candidateId} published as article ${articleId} ("${finalTitle}")`);
    return { success: true, candidateId, articleId, slug: finalSlug, status: finalStatus };
}

module.exports = {
    ingestNewsCandidate,
    checkNewsDuplicate,
    detectNewsContradictions,
    publishNewsCandidate
};
