const http = require('http');
const Store = require('./lib/store');
const { createServer } = require('./lib/server');

const TEST_PORT = 4567;
const BASE_URL = `http://localhost:${TEST_PORT}`;

// Helper to make HTTP requests programmatically using node's native http module
function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : '';
    const options = {
      hostname: 'localhost',
      port: TEST_PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (body) {
      options.headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : null;
          resolve({ status: res.statusCode, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (body) {
      req.write(payload);
    }
    req.end();
  });
}

async function runTests() {
  console.log('\x1b[36m[Test] Starting MockPulse Integration Tests...\x1b[0m');

  // Boot MockPulse Server
  const store = new Store('./test-mockpulse.json');
  // Clear any existing test file
  store.resetAllStates();
  
  const app = createServer(store, TEST_PORT);
  const server = app.listen(TEST_PORT);

  try {
    // 1. Verify GET /api/users returns default 3 users
    console.log('[Test] 1. Verifying GET /api/users...');
    const getRes1 = await request('GET', '/api/users');
    if (getRes1.status !== 200 || !Array.isArray(getRes1.body) || getRes1.body.length !== 3) {
      throw new Error(`Expected GET /api/users to return 3 users. Got status ${getRes1.status}, body length: ${getRes1.body ? getRes1.body.length : 'none'}`);
    }
    console.log('  \x1b[32m✔ Passed: GET /api/users returns 3 initial users\x1b[0m');

    // 2. Verify POST /api/users appends a user (Stateful check)
    console.log('[Test] 2. Verifying stateful POST /api/users...');
    const newUser = { id: "4", name: "Steve Wozniak", email: "woz@apple.com", role: "Engineer" };
    const postRes = await request('POST', '/api/users', newUser);
    if (postRes.status !== 201) {
      throw new Error(`Expected POST /api/users to return 201. Got ${postRes.status}`);
    }
    console.log('  \x1b[32m✔ Passed: POST /api/users returns 201 Created\x1b[0m');

    // 3. Verify GET /api/users returns 4 users now
    console.log('[Test] 3. Verifying GET /api/users updates after stateful POST...');
    const getRes2 = await request('GET', '/api/users');
    if (getRes2.body.length !== 4 || getRes2.body[3].name !== "Steve Wozniak") {
      throw new Error(`Expected GET /api/users to return 4 users with Steve Wozniak. Got length: ${getRes2.body.length}`);
    }
    console.log('  \x1b[32m✔ Passed: GET /api/users contains the added user\x1b[0m');

    // 4. Verify DELETE /api/users/:id removes a user (Stateful check)
    console.log('[Test] 4. Verifying stateful DELETE /api/users/2...');
    const deleteRes = await request('DELETE', '/api/users/2');
    if (deleteRes.status !== 200) {
      throw new Error(`Expected DELETE to return 200. Got ${deleteRes.status}`);
    }
    console.log('  \x1b[32m✔ Passed: DELETE /api/users/2 returns 200 OK\x1b[0m');

    // 5. Verify GET /api/users returns 3 users again (Alan Turing deleted)
    console.log('[Test] 5. Verifying GET /api/users updates after stateful DELETE...');
    const getRes3 = await request('GET', '/api/users');
    const hasTuring = getRes3.body.some(u => u.id === "2" || u.name === "Alan Turing");
    if (getRes3.body.length !== 3 || hasTuring) {
      throw new Error(`Expected 3 users without Alan Turing. Got length: ${getRes3.body.length}, Turing exists: ${hasTuring}`);
    }
    console.log('  \x1b[32m✔ Passed: GET /api/users reflects the deletion of Turing\x1b[0m');

    // 6. Verify latency check on GET /api/delayed (simulated delayed endpoint)
    console.log('[Test] 6. Verifying endpoint latency...');
    const start = Date.now();
    const delayRes = await request('GET', '/api/delayed');
    const elapsed = Date.now() - start;
    if (elapsed < 1400) { // Should take ~1500ms
      throw new Error(`Expected latency of ~1500ms, but request completed in ${elapsed}ms`);
    }
    console.log(`  \x1b[32m✔ Passed: Latency simulation took ${elapsed}ms\x1b[0m`);

    // 7. Verify 404 Logging
    console.log('[Test] 7. Verifying 404 handler...');
    const notFoundRes = await request('GET', '/api/non-existent');
    if (notFoundRes.status !== 404 || !notFoundRes.body.error) {
      throw new Error(`Expected 404 response. Got status: ${notFoundRes.status}`);
    }
    console.log('  \x1b[32m✔ Passed: Unmapped paths return 404 Not Found\x1b[0m');

    console.log('\n\x1b[32;1m[Test] ALL INTEGRATION TESTS PASSED SUCCESSFULLY! ✔\x1b[0m');

  } catch (error) {
    console.error('\n\x1b[31;1m[Test] TEST RUN FAILED ❌\x1b[0m');
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    // Shutdown server
    console.log('[Test] Shutting down test server...');
    server.close(() => {
      console.log('[Test] Test server stopped.');
      
      // Clean up test file
      const fs = require('fs');
      const testFilePath = './test-mockpulse.json';
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    });
  }
}

runTests();
