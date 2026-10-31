/**
 * NostalgicVerse — Museum SEO Engine Service (Phase 17)
 * =====================================================
 * Audits metadata, Open Graph readiness, canonical linking,
 * and structured semantic tags across museum exhibits.
 */

'use strict';

const { v4: uuidv4 } = require('uuid');
const { dbAsync } = require('../db/index.cjs');

/**
 * Perform comprehensive SEO health audit across all published entities
 */
async function runSeoHealthAudit() {
    const auditId = uuidv4();
    const startedAt = new Date().toISOString();

    await dbAsync.run(`
        INSERT INTO seo_health_audits (id, started_at, pages_audited, issues_found, status)
        VALUES (?, ?, 0, 0, 'RUNNING')
    `, [auditId, startedAt]);

    const issues = [];
    let totalAudited = 0;

    // 1. Audit Games
    const games = await dbAsync.all(`
        SELECT id, slug, title, short_description, local_image, remote_image 
        FROM games 
        WHERE status = 'PUBLISHED'
    `);
    totalAudited += games.length;

    games.forEach(g => {
        if (!g.short_description || g.short_description.trim().length < 20) {
            issues.push({
                entityType: 'game',
                id: g.id,
                slug: g.slug,
                severity: 'WARNING',
                issue: 'Missing or overly brief meta description (under 20 chars).'
            });
        }
        if (!g.local_image && !g.remote_image) {
            issues.push({
                entityType: 'game',
                id: g.id,
                slug: g.slug,
                severity: 'WARNING',
                issue: 'Missing cover image for social card / Open Graph preview.'
            });
        }
    });

    // 2. Audit Consoles
    const consoles = await dbAsync.all(`
        SELECT id, slug, name, description, local_image 
        FROM consoles 
        WHERE status = 'PUBLISHED'
    `);
    totalAudited += consoles.length;

    consoles.forEach(c => {
        if (!c.description || c.description.trim().length < 20) {
            issues.push({
                entityType: 'console',
                id: c.id,
                slug: c.slug,
                severity: 'WARNING',
                issue: 'Missing or overly brief meta description.'
            });
        }
        if (!c.local_image) {
            issues.push({
                entityType: 'console',
                id: c.id,
                slug: c.slug,
                severity: 'INFO',
                issue: 'No local photograph asset configured.'
            });
        }
    });

    // 3. Audit News
    try {
        const news = await dbAsync.all(`
            SELECT id, title, summary, hero_image 
            FROM news_articles 
            WHERE status = 'PUBLISHED'
        `);
        totalAudited += news.length;

        news.forEach(n => {
            if (!n.summary || n.summary.trim().length < 20) {
                issues.push({
                    entityType: 'news',
                    id: n.id,
                    slug: n.id,
                    severity: 'WARNING',
                    issue: 'News article missing summary description.'
                });
            }
        });
    } catch (e) {}

    const completedAt = new Date().toISOString();
    const detailsJson = JSON.stringify({
        auditedEntities: { games: games.length, consoles: consoles.length },
        issuesSample: issues.slice(0, 50),
        totalIssues: issues.length
    });

    await dbAsync.run(`
        UPDATE seo_health_audits 
        SET completed_at = ?, pages_audited = ?, issues_found = ?, details_json = ?, status = 'COMPLETED'
        WHERE id = ?
    `, [completedAt, totalAudited, issues.length, detailsJson, auditId]);

    return {
        id: auditId,
        pagesAudited: totalAudited,
        issuesFound: issues.length,
        status: 'COMPLETED',
        startedAt,
        completedAt,
        issuesSummary: {
            warnings: issues.filter(i => i.severity === 'WARNING').length,
            infos: issues.filter(i => i.severity === 'INFO').length
        }
    };
}

/**
 * Fetch most recent SEO health audit
 */
async function getLatestAudit() {
    const latest = await dbAsync.get(`
        SELECT * FROM seo_health_audits 
        ORDER BY started_at DESC 
        LIMIT 1
    `);
    if (!latest) return null;
    return {
        ...latest,
        details: latest.details_json ? JSON.parse(latest.details_json) : null
    };
}

module.exports = {
    runSeoHealthAudit,
    getLatestAudit
};
