/**
 * NostalgicVerse — Game Discovery & Identity Matching Engine (Phase 16)
 * =======================================================================
 * Manages game candidate intake, multi-tier identity matching:
 * EXACT, LIKELY, POSSIBLE, NEW, CONFLICT
 * Proposes media candidates, enqueues AI enrichment drafts, and enables
 * atomic owner promotion to the live museum archive.
 */

'use strict';

const { v4: uuidv4 } = require('uuid');
const { dbAsync } = require('../db/index.cjs');
const { enqueueAIJob } = require('./aiJobQueueService.cjs');
const { defaultLogger: logger } = require('../automation/logger.cjs');

function generateSlug(title) {
    return (title || '')
        .toLowerCase()
        .trim()
        .replace(/['’]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/**
 * Multi-tier identity matching against canonical games table
 */
async function matchGameIdentity(candidateTitle, platform = '', releaseYear = null) {
    const slug = generateSlug(candidateTitle);
    const cleanTitle = candidateTitle.toLowerCase().trim();

    // 1. Exact slug match
    const exactSlug = await dbAsync.get('SELECT id, title, slug, release_year, platforms FROM games WHERE slug = ?', [slug]);
    if (exactSlug) {
        return { matchType: 'EXACT', matchedGameId: exactSlug.id, existing: exactSlug };
    }

    // 2. Exact title match (case-insensitive)
    const exactTitle = await dbAsync.get('SELECT id, title, slug, release_year, platforms FROM games WHERE LOWER(TRIM(title)) = ?', [cleanTitle]);
    if (exactTitle) {
        return { matchType: 'EXACT', matchedGameId: exactTitle.id, existing: exactTitle };
    }

    // 3. Likely match: High title prefix or substring
    const likely = await dbAsync.get(`
        SELECT id, title, slug, release_year, platforms FROM games 
        WHERE (LOWER(title) LIKE ? OR ? LIKE ('%' || LOWER(title) || '%')) AND LENGTH(title) >= 3
        LIMIT 1
    `, [`%${cleanTitle}%`, cleanTitle]);
    if (likely) {
        return { matchType: 'LIKELY', matchedGameId: likely.id, existing: likely };
    }

    // 4. Possible match: Significant title token overlap combined with Year or Platform
    const tokens = cleanTitle.split(/[^a-z0-9]+/).filter(t => t.length >= 4 && !['the', 'and', 'with', 'from', 'test', 'specimen', 'historic'].includes(t));
    if (tokens.length > 0 && (releaseYear || platform)) {
        for (const token of tokens) {
            const possible = await dbAsync.get(`
                SELECT id, title, slug, release_year, platforms FROM games 
                WHERE LOWER(title) LIKE ? AND (release_year = ? OR platforms LIKE ?)
                LIMIT 1
            `, [`%${token}%`, releaseYear || 0, `%${platform || ''}%`]);
            if (possible) {
                return { matchType: 'POSSIBLE', matchedGameId: possible.id, existing: possible };
            }
        }
    }

    return { matchType: 'NEW', matchedGameId: null, existing: null };
}

/**
 * Ingest game discovery candidate
 */
async function ingestGameCandidate({
    title,
    platform = 'Arcade',
    developer = 'Unknown Developer',
    publisher = 'Unknown Publisher',
    releaseYear = 1980,
    genre = 'Action',
    shortDescription = '',
    sourceUrl = 'https://archive.org/details/game-specimen',
    imageCandidateUrl = null
}) {
    const candidateId = uuidv4();
    const slug = generateSlug(title);

    // 1. Identity match check
    const match = await matchGameIdentity(title, platform, releaseYear);

    const status = match.matchType === 'EXACT' ? 'DUPLICATE' : 'CANDIDATE';

    // 2. Store Candidate
    await dbAsync.run(`
        INSERT INTO game_candidates (
            id, title, slug, platform, developer, publisher, release_year, 
            genre, short_description, source_url, identity_match, matched_game_id, 
            image_candidate_url, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
        candidateId, title, slug, platform, developer, publisher, releaseYear,
        genre, shortDescription || `Archival specimen record for ${title}.`,
        sourceUrl, match.matchType, match.matchedGameId, imageCandidateUrl, status
    ]);

    // 3. Propose Media Candidate if image URL provided and existing game was matched
    if (imageCandidateUrl && match.matchedGameId) {
        const candidateMediaId = uuidv4();
        await dbAsync.run(`
            INSERT INTO media_candidates (
                id, game_id, candidate_order, image_url, source_url, source_domain, 
                verification_status, is_selected, created_at
            ) VALUES (?, ?, 1, ?, ?, 'discovery-source', 'UNVERIFIED', 1, CURRENT_TIMESTAMP)
        `, [candidateMediaId, match.matchedGameId, imageCandidateUrl, sourceUrl]);
    }

    // 4. Enqueue AI Enrichment if new or non-exact match
    let aiJobId = null;
    if (match.matchType !== 'EXACT') {
        const job = await enqueueAIJob({
            jobType: 'GAME_ENRICHMENT',
            entityType: 'GAME',
            entityId: candidateId,
            priority: 'NORMAL',
            payload: {
                title,
                platform,
                developer,
                releaseYear,
                sourceUrl
            },
            idempotencyKey: `game:${slug}`
        });
        aiJobId = job.id;
    }

    logger.info(`[GAME_DISCOVERY] Ingested candidate ${candidateId} ("${title}"). Identity: ${match.matchType}, Status: ${status}`);

    return {
        candidateId,
        slug,
        identityMatch: match.matchType,
        matchedGameId: match.matchedGameId,
        status,
        aiJobId
    };
}

/**
 * Approve Game Candidate and publish to live games table
 */
async function publishGameCandidate(candidateId, reviewerId, overrides = {}) {
    const candidate = await dbAsync.get('SELECT * FROM game_candidates WHERE id = ?', [candidateId]);
    if (!candidate) throw new Error('Game candidate not found');

    const gameId = candidateId;
    const finalTitle = overrides.title || candidate.title;
    const finalSlug = overrides.slug || candidate.slug;
    const finalPlatform = overrides.platform || candidate.platform;
    const finalDeveloper = overrides.developer || candidate.developer;
    const finalPublisher = overrides.publisher || candidate.publisher;
    const finalYear = overrides.releaseYear || candidate.release_year;
    const finalGenre = overrides.genre || candidate.genre;
    const finalDesc = overrides.description || candidate.short_description;

    await dbAsync.transaction(async (tx) => {
        // Insert into canonical games
        await tx.run(`
            INSERT INTO games (
                id, slug, title, release_year, developer, publisher, 
                genre, platforms, description, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PUBLISHED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [
            gameId, finalSlug, finalTitle, finalYear, finalDeveloper, finalPublisher,
            finalGenre, finalPlatform, finalDesc
        ]);

        // Insert hero image into game_images if candidate image exists
        const heroUrl = overrides.imageUrl || candidate.image_candidate_url || '/assets/images/defaults/default-game.png';
        await tx.run(`
            INSERT INTO game_images (id, game_id, image_url, image_type, verification_status, created_at)
            VALUES (?, ?, ?, 'HERO', 'VERIFIED', CURRENT_TIMESTAMP)
        `, [uuidv4(), gameId, heroUrl]);

        // Update candidate status
        await tx.run(`
            UPDATE game_candidates 
            SET status = 'PUBLISHED', updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `, [candidateId]);
    });

    logger.info(`[GAME_DISCOVERY] Game candidate ${candidateId} published as canonical game ("${finalTitle}")`);
    return { success: true, gameId, slug: finalSlug, status: 'PUBLISHED' };
}

module.exports = {
    matchGameIdentity,
    ingestGameCandidate,
    publishGameCandidate
};
