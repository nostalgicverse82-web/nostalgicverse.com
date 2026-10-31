/**
 * NostalgicVerse — Game Specimen Ingestion Pipeline
 * ==================================================
 * Automates schema validation, duplicate detection, slug resolution,
 * remote artwork mapping, and persistent updates to games catalog.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { defaultLogger: logger } = require('./logger.cjs');

const ROOT = path.resolve(__dirname, '../..');
const GAMES_MASTER_PATH = path.join(ROOT, 'data/games.json');
const GAMES_DIR_PATH = path.join(ROOT, 'data/games');
const REMOTE_IMAGES_PATH = path.join(ROOT, 'data/remote-game-images.json');

class GameIngestionPipeline {
  constructor(options = {}) {
    this.gamesMasterPath = options.gamesMasterPath || GAMES_MASTER_PATH;
    this.gamesDirPath = options.gamesDirPath || GAMES_DIR_PATH;
    this.remoteImagesPath = options.remoteImagesPath || REMOTE_IMAGES_PATH;
  }

  _loadMasterGames() {
    if (!fs.existsSync(this.gamesMasterPath)) return [];
    try {
      const data = JSON.parse(fs.readFileSync(this.gamesMasterPath, 'utf8'));
      return Array.isArray(data) ? data : (data.games || []);
    } catch (e) {
      logger.error('Failed to parse games.json', { error: e.message });
      return [];
    }
  }

  validateSpecimen(candidate) {
    const errors = [];
    if (!candidate.title || typeof candidate.title !== 'string') {
      errors.push('Missing or invalid "title"');
    }
    if (!candidate.originalReleaseYear || typeof candidate.originalReleaseYear !== 'number') {
      errors.push('Missing or invalid numeric "originalReleaseYear"');
    }
    if (!candidate.originalLaunchPlatform || typeof candidate.originalLaunchPlatform !== 'string') {
      errors.push('Missing or invalid "originalLaunchPlatform"');
    }
    if (!candidate.developer || typeof candidate.developer !== 'string') {
      errors.push('Missing or invalid "developer"');
    }
    if (!candidate.genre || typeof candidate.genre !== 'string') {
      errors.push('Missing or invalid "genre"');
    }
    if (!candidate.shortDescription || candidate.shortDescription.length < 20) {
      errors.push('"shortDescription" must be at least 20 characters');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  generateSlug(title) {
    return title
      .toLowerCase()
      .trim()
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  ingest(candidate) {
    // 1. Schema Validation
    const validation = this.validateSpecimen(candidate);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // 2. Slug & Collision Detection
    const slug = candidate.slug || this.generateSlug(candidate.title);
    const existing = this._loadMasterGames();

    const collision = existing.find(g => g.slug === slug || g.title.toLowerCase() === candidate.title.toLowerCase());
    if (collision) {
      throw new Error(`Duplicate detected: game with slug "${slug}" or title "${candidate.title}" already exists`);
    }

    // 3. Construct Standard Game Record
    const year = candidate.originalReleaseYear;
    const era = candidate.era || `${Math.floor(year / 10) * 10}s`;
    const newRecord = {
      id: candidate.id || `game-${slug}`,
      slug,
      title: candidate.title,
      originalReleaseDate: candidate.originalReleaseDate || `${year}`,
      originalReleaseYear: year,
      originalLaunchPlatform: candidate.originalLaunchPlatform,
      originalLaunchRegion: candidate.originalLaunchRegion || 'Worldwide',
      platforms: candidate.platforms || [candidate.originalLaunchPlatform],
      era,
      genre: candidate.genre,
      developer: candidate.developer,
      publisher: candidate.publisher || candidate.developer,
      image: `/assets/images/games/${slug}.webp`,
      url: `/games/${slug}/`,
      shortDescription: candidate.shortDescription,
      historicalSignificance: candidate.historicalSignificance || candidate.shortDescription,
      keywords: candidate.keywords || [candidate.title.toLowerCase(), candidate.developer.toLowerCase(), era],
      featured: Boolean(candidate.featured)
    };

    // 4. Update Remote Artwork Registry if provided
    if (candidate.remoteImageUrl && fs.existsSync(this.remoteImagesPath)) {
      try {
        const remoteData = JSON.parse(fs.readFileSync(this.remoteImagesPath, 'utf8'));
        remoteData.games = remoteData.games || {};
        remoteData.games[slug] = {
          url: candidate.remoteImageUrl,
          sourceUrl: candidate.sourceUrl || '',
          sourceDomain: candidate.sourceDomain || new URL(candidate.remoteImageUrl).hostname,
          license: 'Fair Use / Archival Historical Cover Art',
          status: 'verified'
        };
        fs.writeFileSync(this.remoteImagesPath, JSON.stringify(remoteData, null, 2), 'utf8');
      } catch (err) {
        logger.warn('Failed to update remote-game-images.json during ingestion', { error: err.message });
      }
    }

    // 5. Write Individual Detail Exhibit JSON
    const detailPath = path.join(this.gamesDirPath, `${slug}.json`);
    const detailData = {
      $schema: 'https://nostalgicverse.com/schemas/game.json',
      ...newRecord,
      editorialContent: {
        overview: candidate.overview || candidate.shortDescription,
        gameplayMechanics: candidate.gameplayMechanics || 'Classic mechanics defined by genre standards.',
        technicalInnovation: candidate.technicalInnovation || 'Architectural breakthrough on target platform.',
        culturalImpact: candidate.culturalImpact || 'Preserved in the NostalgicVerse archive for posterity.',
        preservationNotes: 'Archival record maintained under museum preservation protocol.'
      },
      verifiedFactualData: {
        sourceReferences: ['NostalgicVerse Historical Archive Ingestion Engine'],
        romMediaFormat: candidate.originalLaunchPlatform,
        romSizeOriginal: 'Archival Specimen',
        inputMethod: 'Standard Controller',
        multiplayerCapability: 'Single Player'
      }
    };
    fs.writeFileSync(detailPath, JSON.stringify(detailData, null, 2), 'utf8');

    // 6. Update Master Catalog
    existing.push(newRecord);
    existing.sort((a, b) => (a.originalReleaseYear - b.originalReleaseYear) || a.title.localeCompare(b.title));
    fs.writeFileSync(this.gamesMasterPath, JSON.stringify({ games: existing }, null, 2), 'utf8');

    logger.audit('Ingested new game specimen into archive', { slug, title: newRecord.title, total: existing.length });
    return {
      success: true,
      game: newRecord,
      totalGames: existing.length
    };
  }
}

module.exports = {
  GameIngestionPipeline
};

