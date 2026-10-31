/**
 * NostalgicVerse — Content Relationship Engine (Phase 15)
 * 
 * Manages:
 * - Many-to-many canonical entity relationships
 * - Pair validation (preventing invalid type pairs or self-references)
 * - Orphan relationship auditing & repair
 */

const { dbAsync } = require('../db/index.cjs');
const { v4: uuidv4 } = require('uuid');

const VALID_ENTITY_TYPES = ['GAME', 'CONSOLE', 'STORY', 'GUIDE', 'NEWS', 'TIMELINE', 'GENRE', 'RELEASE'];

const TABLE_MAP = {
    'GAME': 'games',
    'CONSOLE': 'consoles',
    'STORY': 'stories',
    'GUIDE': 'guides',
    'NEWS': 'news_articles',
    'TIMELINE': 'timeline_events',
    'GENRE': 'genres',
    'RELEASE': 'releases'
};

/**
 * Verify that an entity actually exists in canonical SQLite
 */
async function entityExists(entityType, entityId) {
    const table = TABLE_MAP[entityType];
    if (!table) return false;
    const row = await dbAsync.get(`SELECT id FROM ${table} WHERE id = ?`, [entityId]);
    return !!row;
}

/**
 * Add a relationship between two entities
 */
async function addRelationship(sourceType, sourceId, targetType, targetId, relationType = 'RELATED') {
    if (!VALID_ENTITY_TYPES.includes(sourceType) || !VALID_ENTITY_TYPES.includes(targetType)) {
        throw new Error(`Invalid entity types: ${sourceType} -> ${targetType}`);
    }

    if (sourceType === targetType && sourceId === targetId) {
        throw new Error('Self-referential relationships are not permitted');
    }

    const sourceOk = await entityExists(sourceType, sourceId);
    if (!sourceOk) {
        throw new Error(`Source entity not found: ${sourceType} #${sourceId}`);
    }

    const targetOk = await entityExists(targetType, targetId);
    if (!targetOk) {
        throw new Error(`Target entity not found: ${targetType} #${targetId}`);
    }

    const id = `rel-${uuidv4().slice(0, 8)}`;

    try {
        await dbAsync.run(`
            INSERT INTO content_relationships (id, source_type, source_id, target_type, target_id, relation_type)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [id, sourceType, sourceId, targetType, targetId, relationType]);
        return { id, sourceType, sourceId, targetType, targetId, relationType };
    } catch (e) {
        if (e.message.includes('UNIQUE constraint failed')) {
            return { duplicate: true, sourceType, sourceId, targetType, targetId, relationType };
        }
        throw e;
    }
}

/**
 * Get all related entities for a given item
 */
async function getRelatedEntities(entityType, entityId) {
    const direct = await dbAsync.all(`
        SELECT target_type as entity_type, target_id as entity_id, relation_type, 'OUTGOING' as direction
        FROM content_relationships
        WHERE source_type = ? AND source_id = ?
    `, [entityType, entityId]);

    const inverse = await dbAsync.all(`
        SELECT source_type as entity_type, source_id as entity_id, relation_type, 'INCOMING' as direction
        FROM content_relationships
        WHERE target_type = ? AND target_id = ?
    `, [entityType, entityId]);

    return [...direct, ...inverse];
}

/**
 * Audit all relationships for orphaned references
 */
async function auditRelationships() {
    const all = await dbAsync.all('SELECT * FROM content_relationships');
    const orphans = [];
    const valid = [];

    for (const rel of all) {
        const sourceExists = await entityExists(rel.source_type, rel.source_id);
        const targetExists = await entityExists(rel.target_type, rel.target_id);

        if (!sourceExists || !targetExists) {
            orphans.push({
                id: rel.id,
                sourceType: rel.source_type,
                sourceId: rel.source_id,
                sourceMissing: !sourceExists,
                targetType: rel.target_type,
                targetId: rel.target_id,
                targetMissing: !targetExists,
                relationType: rel.relation_type
            });
        } else {
            valid.push(rel);
        }
    }

    return {
        total: all.length,
        validCount: valid.length,
        orphanCount: orphans.length,
        orphans
    };
}

/**
 * Delete orphaned relationships
 */
async function pruneOrphanRelationships() {
    const audit = await auditRelationships();
    if (audit.orphanCount === 0) {
        return { deleted: 0 };
    }

    const orphanIds = audit.orphans.map(o => o.id);
    const placeholders = orphanIds.map(() => '?').join(',');
    await dbAsync.run(`DELETE FROM content_relationships WHERE id IN (${placeholders})`, orphanIds);

    return { deleted: orphanIds.length, pruned: audit.orphans };
}

module.exports = {
    VALID_ENTITY_TYPES,
    TABLE_MAP,
    entityExists,
    addRelationship,
    getRelatedEntities,
    auditRelationships,
    pruneOrphanRelationships
};

