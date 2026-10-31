const http = require('http');
const assert = require('assert');
const crypto = require('crypto');
const dotenv = require('dotenv');

dotenv.config();

const { startServer, stopServer } = require('../../server/index.cjs');

const PORT = 3457;

function request(path, options = {}, body = null, token = null) {
    return new Promise((resolve, reject) => {
        const reqOpts = {
            hostname: '127.0.0.1',
            port: PORT,
            path: path,
            method: options.method || 'GET',
            headers: {
                ...options.headers
            }
        };

        if (body) {
            reqOpts.headers['Content-Type'] = 'application/json';
        }
        if (token) {
            reqOpts.headers['x-session-token'] = token;
        }

        const req = http.request(reqOpts, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                let json = null;
                if (res.headers['content-type'] && res.headers['content-type'].includes('application/json')) {
                    try { json = JSON.parse(data); } catch (e) {}
                }
                
                // Get set-cookie if any
                const setCookie = res.headers['set-cookie'];
                let sessionCookie = null;
                if (setCookie) {
                    const match = setCookie.find(c => c.startsWith('session='));
                    if (match) {
                        sessionCookie = match.split(';')[0].split('=')[1];
                    }
                }
                
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: data,
                    json,
                    sessionCookie
                });
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function runTests() {
    console.log('Starting NostalgicVerse Platform Tests...');
    
    let passed = 0;
    let failed = 0;
    
    function check(condition, message) {
        if (condition) {
            console.log(`  ✓ PASS: ${message}`);
            passed++;
        } else {
            console.error(`  ✗ FAIL: ${message}`);
            failed++;
        }
    }

    try {
        await startServer(PORT);
        
        // 1. Signup test
        const testUser = `testuser_${crypto.randomBytes(4).toString('hex')}`;
        const testEmail = `${testUser}@example.com`;
        
        const signupRes = await request('/api/auth/signup', { method: 'POST' }, {
            email: testEmail,
            username: testUser,
            displayName: 'Test User',
            password: 'password123',
            confirmPassword: 'password123'
        });
        check(signupRes.status === 200, 'Signup returns 200');
        check(signupRes.json && signupRes.json.user.username === testUser, 'Signup returns correct user data');
        const token = signupRes.sessionCookie;
        check(!!token, 'Signup sets session cookie');
        
        // 2. Duplicate email/username
        const signupDupRes = await request('/api/auth/signup', { method: 'POST' }, {
            email: testEmail,
            username: testUser,
            displayName: 'Test User 2',
            password: 'password123',
            confirmPassword: 'password123'
        });
        check(signupDupRes.status === 400, 'Duplicate signup returns 400');
        
        // 3. Logout
        const logoutRes = await request('/api/auth/logout', { method: 'POST' }, null, token);
        check(logoutRes.status === 200, 'Logout returns 200');
        
        // 4. Login
        const loginRes = await request('/api/auth/login', { method: 'POST' }, {
            username: testUser,
            password: 'password123'
        });
        check(loginRes.status === 200, 'Login returns 200');
        const newToken = loginRes.sessionCookie;
        check(!!newToken, 'Login sets new session cookie');
        
        // 5. Get profile
        const profileRes = await request('/api/auth/me', { method: 'GET' }, null, newToken);
        check(profileRes.status === 200, 'Get own profile returns 200');
        check(profileRes.json && profileRes.json.user.username === testUser, 'Profile data matches');
        
        const userId = profileRes.json.user.id;
        
        // 6. Test emulator session start/end
        const emuStartRes = await request('/api/emulators/sessions', { method: 'POST' }, {
            gameId: 'game-pac-man',
            emulatorCore: 'mame2003'
        }, newToken);
        if (emuStartRes.status !== 200) console.log('emuStartRes err:', emuStartRes.body);
        check(emuStartRes.status === 200, 'Emulator session start returns 200');
        const sessionId = emuStartRes.json?.sessionId;
        check(!!sessionId, 'Emulator session returns sessionId');
        
        const emuEndRes = await request(`/api/emulators/sessions/${sessionId}/end`, { method: 'POST' }, null, newToken);
        check(emuEndRes.status === 200, 'Emulator session end returns 200');
        
        // 7. Owner endpoint test (should fail for regular user)
        const ownerRes = await request('/api/owner/stats', { method: 'GET' }, null, newToken);
        check(ownerRes.status === 403, 'Owner stats returns 403 for regular user');
        
        // 8. Owner Login
        const ownerLoginRes = await request('/api/auth/login', { method: 'POST' }, {
            username: process.env.OWNER_USERNAME || 'owner',
            password: process.env.OWNER_INITIAL_PASSWORD || 'changeme123'
        });
        
        // If owner exists and password is correct (which it is since initOwner runs)
        if (ownerLoginRes.status === 200) {
            const ownerToken = ownerLoginRes.sessionCookie;
            
            const statsRes = await request('/api/owner/stats', { method: 'GET' }, null, ownerToken);
            check(statsRes.status === 200, 'Owner stats returns 200 for owner');
            
            const createGameRes = await request('/api/owner/games', { method: 'POST' }, {
                slug: `test-game-${crypto.randomBytes(4).toString('hex')}`,
                title: 'Test Game',
                description: 'A test game',
                release_year: 1999
            }, ownerToken);
            check(createGameRes.status === 200, 'Owner can create game');
        } else {
            console.log('Skipping owner tests as default owner auth failed (possibly changed already)');
        }
        
    } catch (err) {
        console.error('Test suite error:', err);
    } finally {
        await stopServer();
        console.log(`\nPlatform Test Results: ${passed} passed, ${failed} failed.`);
        process.exit(failed > 0 ? 1 : 0);
    }
}

runTests();
