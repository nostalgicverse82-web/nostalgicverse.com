/**
 * NostalgicVerse - Compatibility Launcher
 * 
 * Delegates entirely to the canonical NostalgicVerse server implementation.
 * Please use `npm start` or `node server/index.cjs` directly in the future.
 */

'use strict';

const { server, startServer } = require('./server/index.cjs');

// Start the canonical server and export the server instance
startServer();
module.exports = server;

