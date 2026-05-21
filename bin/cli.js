#!/usr/bin/env node

const { exec } = require('child_process');
const path = require('path');
const Store = require('../lib/store');
const { createServer } = require('../lib/server');

// Simple argument parsing helper
function parseArgs() {
  const args = process.argv.slice(2);
  const params = {
    port: 3000,
    file: './mockpulse.json',
    dev: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--port' || arg === '-p') {
      const val = parseInt(args[i + 1], 10);
      if (!isNaN(val)) {
        params.port = val;
        i++;
      }
    } else if (arg === '--file' || arg === '-f') {
      if (args[i + 1] && !args[i + 1].startsWith('-')) {
        params.file = args[i + 1];
        i++;
      }
    } else if (arg === '--dev' || arg === '-d') {
      params.dev = true;
    }
  }

  return params;
}

function openBrowser(url) {
  const start =
    process.platform === 'darwin'
      ? 'open'
      : process.platform === 'win32'
      ? 'start'
      : 'xdg-open';
  
  const cmd = process.platform === 'win32' ? `start "" "${url}"` : `${start} "${url}"`;
  
  exec(cmd, (err) => {
    if (err) {
      // Fail silently if browser couldn't be opened (e.g. headless environment)
    }
  });
}

function main() {
  const params = parseArgs();
  
  console.log('\x1b[35m%s\x1b[0m', ' __  __            _    ____       _         ');
  console.log('\x1b[35m%s\x1b[0m', '|  \\/  | ___   ___| | _|  _ \\ _   | |___  ___ ');
  console.log('\x1b[35m%s\x1b[0m', '| |\\/| |/ _ \\ / __| |/ / |_) | | | | / __|/ _ \\');
  console.log('\x1b[35m%s\x1b[0m', '| |  | | (_) | (__|   <|  __/| |_| | \\__ \\  __/');
  console.log('\x1b[35m%s\x1b[0m', '|_|  |_|\\___/ \\___|_|\\_\\_|    \\__,_|_|___/\\___|');
  console.log('\x1b[36m%s\x1b[0m', '                  - Mocking APIs, simplified. -             \n');

  console.log(`[MockPulse] Loading routes configuration from: ${path.resolve(params.file)}`);
  
  const store = new Store(params.file);
  const app = createServer(store, params.port);

  const server = app.listen(params.port, () => {
    const localUrl = `http://localhost:${params.port}`;
    const dashboardUrl = `${localUrl}/_dashboard/`;

    console.log(`\x1b[32m[MockPulse] Server is up and running!\x1b[0m`);
    console.log(`\x1b[34m[MockPulse] Mock API Server:\x1b[0m    ${localUrl}`);
    console.log(`\x1b[34m[MockPulse] Developer Dashboard:\x1b[0m ${dashboardUrl}\n`);
    console.log(`[MockPulse] Press Ctrl+C to stop.`);

    // Automatically open browser to dashboard
    openBrowser(dashboardUrl);
  });

  // Handle graceful shutdowns
  const shutdown = () => {
    console.log('\n[MockPulse] Shutting down gracefully...');
    server.close(() => {
      console.log('[MockPulse] Stopped.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main();
