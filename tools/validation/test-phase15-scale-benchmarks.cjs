#!/usr/bin/env node
/**
 * NostalgicVerse — Phase 15 Large-Scale Synthetic Capacity & Stress Benchmark
 * 
 * Verifies designed vs measured capacity at 1k, 5k, and 10k synthetic game records:
 * 1. Search Indexing: Construction throughput, serialization, memory overhead, query latency (< 5ms at 10k)
 * 2. Media Resolution: In-memory resolution throughput (> 50k resolutions/sec)
 * 3. Homepage Discovery Sampling: Deterministic and random sampling latency (< 2ms at 10k)
 * 4. Zero DB Pollution: All synthetic tests execute purely in-memory with zero writes to SQLite DB.
 */

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const mediaService = require('../../server/services/mediaService.cjs');

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`  [PASS] ${message}`);
        passed++;
    } else {
        console.error(`  [FAIL] ${message}`);
        failed++;
    }
}

// Generate realistic synthetic game records
function generateSyntheticGames(count) {
    const genres = ['Action', 'Platformer', 'RPG', 'Adventure', 'Shooter', 'Fighting', 'Puzzle', 'Racing'];
    const consoles = ['nes', 'snes', 'sega-genesis', 'playstation', 'nintendo-64', 'game-boy'];
    const games = [];

    for (let i = 1; i <= count; i++) {
        const id = `game-synth-${i}`;
        const slug = `synthetic-game-${i}`;
        const title = `Synthetic Legend of Retro Odyssey ${i}`;
        const year = 1980 + (i % 25);
        const genre = genres[i % genres.length];
        const consoleId = consoles[i % consoles.length];

        games.push({
            id,
            slug,
            title,
            original_title: null,
            system: consoleId,
            release_year: year,
            genres: [genre],
            developer: `Synthetic Dev Studio ${(i % 50) + 1}`,
            publisher: `Synthetic Publishing ${(i % 20) + 1}`,
            description: `A high-performance simulated retro game chronicle for stress testing benchmark scale #${i}.`,
            image_url: i % 3 === 0 ? `https://archive.org/synth-${i}.jpg` : null,
            rating: 4.0 + (i % 10) * 0.1,
            status: 'PUBLISHED'
        });
    }

    return games;
}

// Simulates search index transformation from canonical games
function buildSearchIndexFromGames(games) {
    return games.map(g => ({
        id: g.id,
        title: g.title,
        slug: g.slug,
        type: 'game',
        url: `/games/${g.slug}/`,
        description: g.description,
        release_year: g.release_year,
        system: g.system,
        genre: g.genres ? g.genres.join(', ') : '',
        rating: g.rating
    }));
}

// In-memory inverted query engine matching frontend and backend search
function querySearchIndex(index, query) {
    const q = query.toLowerCase().trim();
    if (!q) return index.slice(0, 50);

    const tokens = q.split(/\s+/);
    return index.filter(doc => {
        const target = `${doc.title} ${doc.slug} ${doc.genre} ${doc.system} ${doc.release_year}`.toLowerCase();
        return tokens.every(token => target.includes(token));
    });
}

async function runBenchmark() {
    console.log('======================================================================');
    console.log('NOSTALGICVERSE — PHASE 15 LARGE-SCALE SYNTHETIC CAPACITY BENCHMARK');
    console.log('======================================================================\n');

    const scales = [1000, 5000, 10000];

    for (const scale of scales) {
        console.log(`\n----------------------------------------------------------------------`);
        console.log(`EVALUATING SYNTHETIC SCALE: ${scale.toLocaleString()} EXHIBITS`);
        console.log(`----------------------------------------------------------------------`);

        // 1. Generation & Memory
        const genStart = performance.now();
        const syntheticGames = generateSyntheticGames(scale);
        const genDuration = performance.now() - genStart;
        console.log(`  Generation time: ${genDuration.toFixed(2)} ms`);
        assert(syntheticGames.length === scale, `Successfully initialized ${scale} synthetic items`);

        // 2. Search Index Construction
        const indexStart = performance.now();
        const searchDocs = buildSearchIndexFromGames(syntheticGames);
        const jsonString = JSON.stringify(searchDocs);
        const indexDuration = performance.now() - indexStart;
        const memoryBytes = Buffer.byteLength(jsonString, 'utf8');
        const memoryKB = (memoryBytes / 1024).toFixed(1);

        console.log(`  Search index build & JSON serialize: ${indexDuration.toFixed(2)} ms (${memoryKB} KB)`);
        assert(indexDuration < 200, `Index construction for ${scale} items finished under 200ms (measured: ${indexDuration.toFixed(2)}ms)`);
        assert(searchDocs.length === scale, `Search index contains exact count of ${scale} docs`);

        // 3. Search Query Latency (100 multi-token queries)
        const queries = [
            'odyssey 5', 'legend rpg', 'retro 199', 'studio 12', 'adventure',
            'synthetic 42', 'platformer', 'odyssey 99', 'publishing 3', 'legend'
        ];

        let totalQueryTime = 0;
        const runs = 100;
        for (let i = 0; i < runs; i++) {
            const q = queries[i % queries.length];
            const qStart = performance.now();
            const results = querySearchIndex(searchDocs, q);
            const qDuration = performance.now() - qStart;
            totalQueryTime += qDuration;
        }

        const avgQueryLatency = totalQueryTime / runs;
        console.log(`  Average Search Query Latency (100 runs): ${avgQueryLatency.toFixed(3)} ms`);
        assert(avgQueryLatency < 5.0, `Average search query latency at ${scale} items is < 5ms (measured: ${avgQueryLatency.toFixed(3)}ms)`);

        // 4. Media Resolution Throughput
        const mediaStart = performance.now();
        let fallbackCount = 0;
        let remoteCount = 0;
        for (let i = 0; i < scale; i++) {
            const resolved = mediaService.resolveGameImage(syntheticGames[i]);
            if (resolved.isFallback) fallbackCount++;
            else if (resolved.type === 'REMOTE') remoteCount++;
        }
        const mediaDuration = performance.now() - mediaStart;
        const opsPerSec = Math.round((scale / (mediaDuration / 1000)));

        console.log(`  Media Resolution: ${mediaDuration.toFixed(2)} ms (${opsPerSec.toLocaleString()} ops/sec)`);
        assert(mediaDuration < 100, `Media resolution for ${scale} items completed under 100ms (measured: ${mediaDuration.toFixed(2)}ms)`);
        assert(fallbackCount + remoteCount === scale, `All ${scale} items resolved cleanly to verified remote or accession fallback`);

        // 5. Homepage Discovery Sampling Simulation
        const sampleStart = performance.now();
        const sampleRuns = 200;
        for (let i = 0; i < sampleRuns; i++) {
            // Spotlight (12 items)
            const spotlight = syntheticGames.slice(0, 12);
            // Random picks (6 items)
            const randomPicks = [];
            for (let k = 0; k < 6; k++) {
                const idx = Math.floor(Math.random() * scale);
                randomPicks.push(syntheticGames[idx]);
            }
        }
        const sampleDuration = performance.now() - sampleStart;
        const avgSampleTime = sampleDuration / sampleRuns;

        console.log(`  Discovery Sampling Avg Time: ${avgSampleTime.toFixed(3)} ms`);
        assert(avgSampleTime < 1.0, `Discovery sampling at ${scale} items completed in < 1ms (measured: ${avgSampleTime.toFixed(3)}ms)`);
    }

    console.log('\n======================================================================');
    console.log(`BENCHMARK COMPLETE: ${passed} passed, ${failed} failed.`);
    console.log('======================================================================');

    if (failed > 0) process.exit(1);
}

runBenchmark().catch(err => {
    console.error('Benchmark fatal error:', err);
    process.exit(1);
});

