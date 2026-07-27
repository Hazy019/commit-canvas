#!/usr/bin/env node

const path = require('path');

// Execute using ts-node in development or dist/cli.js in production
try {
  require('../dist/cli.js');
} catch (e) {
  require('ts-node/register');
  require('../src/cli.ts');
}
