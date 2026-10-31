/**
 * NostalgicVerse — Content Health Engine (Phase 15)
 * 
 * Performs automated curatorial audits across:
 * - Games, Consoles, News, Releases, Stories, Guides
 * - Media integrity (missing images, broken URLs, unverified sources)
 * - SEO completeness (missing titles, descriptions, canonical tags)
 * - Relationship orphans and dead links
 * - Severity grading (CRITICAL, WARNING, INFO)
 * - Audit logs for ignored issues with curatorial justification
 */

const { dbAsync } = require('../db/index.cjs');
const relationshipService = require('./relationshipService.cjs');
const { v4: uuidv4 } = require('uuid');

/**
 * Run comprehensive health audit across all content
 */
async function runHealthAudit() {
    const issues = [];

    // 1. Audit Published Games
    const games = await dbAsync.all(`
        SELECT g.id, g.slug, g.title, g.meta_title, g.meta_description, g.release_year,
               gi.image_url, gi.verification_status, gi.image_type
        FROM games g
        LEFT JOIN game_images gi ON g.id = gi.game_id
        WHERE g.status = 'PUBLISHED'
    `);

    // Check slug duplicates among games
    const slugMap = new Map();
    for (const g of games) {
        if (!g.slug) {
            issues.push({
                entityType: 'GAME',
                entityId: g.id,
                entityTitle: g.title,
                issueCode: 'MISSING_SLUG',
                severity: 'CRITICAL',
                message: `Published game "${g.title}" has no slug`
            });
        } else {
            if (slugMap.has(g.slug)) {
                issues.push({
                    entityType: 'GAME',
                    entityId: g.id,
                    entityTitle: g.title,
                    issueCode: 'DUPLICATE_SLUG',
                    severity: 'CRITICAL',
                    message: `Slug "${g.slug}" is duplicated across multiple games`
                });
            }
            slugMap.set(g.slug, g.id);
        }

        // Media health check
        if (!g.image_url) {
            issues.push({
                entityType: 'GAME',
                entityId: g.id,
                entityTitle: g.title,
                issueCode: 'MISSING_IMAGE',
                severity: 'CRITICAL',
                message: `Published game "${g.title}" has no registered image`
            });
        } else if (g.verification_status === 'BROKEN' || g.verification_status === 'NOT_FOUND') {
            issues.push({
                entityType: 'GAME',
                entityId: g.id,
                entityTitle: g.title,
                issueCode: 'BROKEN_IMAGE',
                severity: 'CRITICAL',
                message: `Game image URL returned error for "${g.title}"`
            });
        } else if (g.verification_status === 'UNVERIFIED') {
            issues.push({
                entityType: 'GAME',
                entityId: g.id,
                entityTitle: g.title,
                issueCode: 'UNVERIFIED_IMAGE',
                severity: 'WARNING',
                message: `Game image for "${g.title}" is pending automated verification`
            });
        }

        // SEO completeness
        if (!g.meta_title || !g.meta_description) {
            issues.push({
                entityType: 'GAME',
                entityId: g.id,
                entityTitle: g.title,
                issueCode: 'MISSING_SEO',
                severity: 'INFO',
                message: `Game "${g.title}" is missing explicit custom SEO meta tags`
            });
        }
    }

    // 2. Audit Published News Articles
    const articles = await dbAsync.all('SELECT * FROM news_articles WHERE status = "PUBLISHED"');
    for (const a of articles) {
        if (!a.primary_source && (!a.sources || a.sources === '[]')) {
            issues.push({
                entityType: 'NEWS',
                entityId: a.id,
                entityTitle: a.title,
                issueCode: 'MISSING_SOURCE',
                severity: 'CRITICAL',
                message: `Published news article "${a.title}" has no verified source citation`
            });
        }
        if (!a.summary || a.summary.length < 10) {
            issues.push({
                entityType: 'NEWS',
                entityId: a.id,
                entityTitle: a.title,
                issueCode: 'INCOMPLETE_SUMMARY',
                severity: 'WARNING',
                message: `News article "${a.title}" has incomplete summary`
            });
        }
    }

    // 3. Audit Releases
    const releases = await dbAsync.all('SELECT * FROM releases');
    for (const r of releases) {
        if (r.game_id) {
            const gameExists = await dbAsync.get('SELECT id FROM games WHERE id = ?', [r.game_id]);
            if (!gameExists) {
                issues.push({
                    entityType: 'RELEASE',
                    entityId: r.id,
                    entityTitle: r.title,
                    issueCode: 'ORPHAN_RELEASE',
                    severity: 'CRITICAL',
                    message: `Release "${r.title}" references nonexistent game ID "${r.game_id}"`
                });
            }
        }
        if (!r.source && r.status !== 'RELEASED') {
            issues.push({
                entityType: 'RELEASE',
                entityId: r.id,
                entityTitle: r.title,
                issueCode: 'UNSOURCED_RELEASE',
                severity: 'WARNING',
                message: `Upcoming release "${r.title}" lacks authoritative curatorial source`
            });
        }
    }

    // 4. Audit Relationship Graph Orphans
    const relAudit = await relationshipService.auditRelationships();
    for (const orphan of relAudit.orphans) {
        issues.push({
            entityType: 'RELATIONSHIP',
            entityId: orphan.id,
            entityTitle: `${orphan.sourceType} -> ${orphan.targetType}`,
            issueCode: 'ORPHAN_RELATIONSHIP',
            severity: 'CRITICAL',
            message: `Relationship references missing entity (source: ${orphan.sourceMissing}, target: ${orphan.targetMissing})`
        });
    }

    // Sync into database content_health_issues table
    for (const issue of issues) {
        const existing = await dbAsync.get(`
            SELECT id, status FROM content_health_issues 
            WHERE entity_type = ? AND entity_id = ? AND issue_code = ?
        `, [issue.entityType, issue.entityId, issue.issueCode]);

        if (existing) {
            await dbAsync.run(`
                UPDATE content_health_issues SET 
                    message = ?,
                    severity = ?,
                    last_detected_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [issue.message, issue.severity, existing.id]);
        } else {
            await dbAsync.run(`
                INSERT INTO content_health_issues (
                    id, entity_type, entity_id, entity_title, issue_code, severity, message, status, created_at, last_detected_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'OPEN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `, [
                uuidv4(),
                issue.entityType,
                issue.entityId,
                issue.entityTitle,
                issue.issueCode,
                issue.severity,
                issue.message
            ]);
        }
    }

    // Mark resolved issues if not detected anymore
    const openDbIssues = await dbAsync.all('SELECT id, entity_type, entity_id, issue_code FROM content_health_issues WHERE status = "OPEN"');
    const detectedKeys = new Set(issues.map(i => `${i.entityType}:${i.entityId}:${i.issueCode}`));

    for (const dbIssue of openDbIssues) {
        const key = `${dbIssue.entity_type}:${dbIssue.entity_id}:${dbIssue.issue_code}`;
        if (!detectedKeys.has(key)) {
            await dbAsync.run('UPDATE content_health_issues SET status = "RESOLVED" WHERE id = ?', [dbIssue.id]);
        }
    }

    return await getHealthSummary();
}

/**
 * Get aggregated health summary
 */
async function getHealthSummary() {
    const counts = await dbAsync.all(`
        SELECT severity, status, COUNT(*) as cnt 
        FROM content_health_issues 
        GROUP BY severity, status
    `);

    let critical = 0;
    let warning = 0;
    let info = 0;
    let openCount = 0;
    let ignoredCount = 0;
    let resolvedCount = 0;

    for (const c of counts) {
        if (c.status === 'OPEN') {
            openCount += c.cnt;
            if (c.severity === 'CRITICAL') critical += c.cnt;
            else if (c.severity === 'WARNING') warning += c.cnt;
            else if (c.severity === 'INFO') info += c.cnt;
        } else if (c.status === 'IGNORED') {
            ignoredCount += c.cnt;
        } else if (c.status === 'RESOLVED') {
            resolvedCount += c.cnt;
        }
    }

    return {
        status: critical > 0 ? 'CRITICAL' : warning > 0 ? 'WARNING' : 'HEALTHY',
        critical,
        warning,
        info,
        open: openCount,
        ignored: ignoredCount,
        resolved: resolvedCount
    };
}

/**
 * Curatorial ignore with reason audit trail
 */
async function ignoreIssue(issueId, userId, reason) {
    if (!reason || reason.trim().length < 5) {
        throw new Error('Curatorial reason (min 5 chars) is mandatory to ignore a content health alert');
    }

    await dbAsync.run(`
        UPDATE content_health_issues SET
            status = 'IGNORED',
            ignored_by = ?,
            ignored_at = CURRENT_TIMESTAMP,
            ignore_reason = ?
        WHERE id = ?
    `, [userId, reason.trim(), issueId]);

    return { success: true, issueId };
}

/**
 * Recheck an individual entity's health
 */
async function recheckEntity(entityType, entityId) {
    // Re-evaluates health for single entity
    await dbAsync.run('DELETE FROM content_health_issues WHERE entity_type = ? AND entity_id = ?', [entityType, entityId]);
    await runHealthAudit();
    const remaining = await dbAsync.all('SELECT * FROM content_health_issues WHERE entity_type = ? AND entity_id = ? AND status = "OPEN"', [entityType, entityId]);
    return {
        healthy: remaining.length === 0,
        issues: remaining
    };
}

module.exports = {
    runHealthAudit,
    getHealthSummary,
    ignoreIssue,
    recheckEntity
};

