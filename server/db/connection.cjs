const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const dbPath = process.env.DATABASE_URL || process.env.DB_PATH || path.join(__dirname, '../../data/nostalgicverse.db');

// Ensure data dir exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  }
});

// Configure SQLite for production-level reliability
db.serialize(() => {
    db.run('PRAGMA foreign_keys = ON');
    db.run('PRAGMA journal_mode = WAL');
    db.run('PRAGMA synchronous = NORMAL');
    db.run('PRAGMA busy_timeout = 5000');
    db.run('PRAGMA cache_size = -8000'); // 8MB cache
    db.run('PRAGMA mmap_size = 67108864'); // 64MB memory-mapped I/O
    db.run('PRAGMA temp_store = MEMORY');
    db.run('PRAGMA wal_autocheckpoint = 1000');
});

const wait = ms => new Promise(r => setTimeout(r, ms));
let transactionMutex = Promise.resolve();

async function executeWithRetry(fn, maxRetries = 3) {
    let attempt = 0;
    while (true) {
        try {
            return await fn();
        } catch (err) {
            const isBusy = err && (
                err.code === 'SQLITE_BUSY' || 
                err.code === 'SQLITE_LOCKED' || 
                (err.message && (err.message.includes('busy') || err.message.includes('locked')))
            );
            if (isBusy && attempt < maxRetries) {
                attempt++;
                const delay = (attempt * 25) + Math.floor(Math.random() * 20);
                await wait(delay);
                continue;
            }
            throw err;
        }
    }
}

// Promisify database methods for async/await usage with retry resilience
const dbAsync = {
  run(sql, params = []) {
    return executeWithRetry(() => new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
      });
    }));
  },
  get(sql, params = []) {
    return executeWithRetry(() => new Promise((resolve, reject) => {
      db.get(sql, params, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    }));
  },
  all(sql, params = []) {
    return executeWithRetry(() => new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    }));
  },
  exec(sql) {
    return executeWithRetry(() => new Promise((resolve, reject) => {
      db.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    }));
  },
  transaction(fn) {
    let releaseLock;
    const lockPromise = new Promise(resolve => { releaseLock = resolve; });
    const prevLock = transactionMutex;
    transactionMutex = transactionMutex.then(() => lockPromise);

    return prevLock.then(async () => {
      try {
        await executeWithRetry(() => new Promise((resolve, reject) => {
          db.run('BEGIN IMMEDIATE', (err) => {
            if (err) reject(err);
            else resolve();
          });
        }));
        const result = await fn(dbAsync);
        await new Promise((resolve, reject) => {
          db.run('COMMIT', (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        return result;
      } catch (err) {
        await new Promise((resolve) => {
          db.run('ROLLBACK', () => resolve());
        });
        throw err;
      } finally {
        releaseLock();
      }
    });
  },
  close() {
    return new Promise((resolve, reject) => {
      db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
};

module.exports = {
  db,
  dbAsync
};

