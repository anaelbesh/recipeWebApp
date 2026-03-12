// Loaded by ts-node-dev via: --require ./preload.js
// Plain JS (not TypeScript) so it runs before any module is transpiled.
// Using __dirname guarantees we always find .env relative to this file,
// regardless of the CWD when the dev server or test runner is started.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
