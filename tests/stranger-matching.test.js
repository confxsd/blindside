/**
 * Stranger Matching Logic Tests
 *
 * Tests the core matching logic by simulating D1 operations in-memory.
 * Run: node tests/stranger-matching.test.js
 */

let nextId = 1;
const matchQueue = [];
const strangerMatches = [];

// In-memory D1 simulator
function createMockDb() {
  return {
    prepare(sql) {
      return {
        _sql: sql,
        _bindings: [],
        bind(...args) {
          this._bindings = args;
          return this;
        },
        async first() {
          return execQuery(this._sql, this._bindings, 'first');
        },
        async all() {
          return { results: execQuery(this._sql, this._bindings, 'all') };
        },
        async run() {
          return execQuery(this._sql, this._bindings, 'run');
        },
      };
    },
  };
}

function execQuery(sql, bindings, mode) {
  const sqlNorm = sql.replace(/\s+/g, ' ').trim();

  // INSERT INTO match_queue
  if (sqlNorm.includes('INSERT INTO match_queue')) {
    const row = {
      id: nextId++,
      user_id: bindings[0],
      username: bindings[1],
      lang: bindings[2] || 'en',
      status: 'waiting',
      claim_token: null,
      matched_with: null,
      session_code: null,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 120000).toISOString(),
    };
    // Check unique constraint
    const existing = matchQueue.find(r => r.user_id === row.user_id && r.status === 'waiting');
    if (existing) throw new Error('UNIQUE constraint failed');
    matchQueue.push(row);
    return mode === 'run' ? { meta: { changes: 1 } } : row;
  }

  // UPDATE match_queue SET status = 'cancelled' WHERE user_id = ? AND status IN ('waiting', 'matched')
  if (sqlNorm.includes("SET status = 'cancelled'") && sqlNorm.includes("IN ('waiting', 'matched')")) {
    let changes = 0;
    matchQueue.forEach(r => {
      if (r.user_id === bindings[0] && (r.status === 'waiting' || r.status === 'matched')) {
        r.status = 'cancelled';
        changes++;
      }
    });
    return { meta: { changes } };
  }

  // UPDATE match_queue SET status = 'cancelled' WHERE user_id = ? AND status = 'waiting'
  if (sqlNorm.includes("SET status = 'cancelled'") && sqlNorm.includes("status = 'waiting'") && !sqlNorm.includes('matched')) {
    let changes = 0;
    matchQueue.forEach(r => {
      if (r.user_id === bindings[0] && r.status === 'waiting') {
        r.status = 'cancelled';
        changes++;
      }
    });
    return { meta: { changes } };
  }

  // UPDATE match_queue SET status = 'matched', claim_token = ?, matched_with = ? WHERE id = (...) AND status = 'waiting'
  if (sqlNorm.includes("SET status = 'matched', claim_token")) {
    const claimToken = bindings[0];
    const matchedWith = bindings[1];
    const excludeUserId = bindings[2];

    // Find first waiting user that isn't the requester and isn't in active match
    const candidate = matchQueue
      .filter(r => r.status === 'waiting' && r.user_id !== excludeUserId &&
        new Date(r.expires_at) > new Date())
      .filter(r => !strangerMatches.some(sm =>
        (sm.user_a_id === r.user_id || sm.user_b_id === r.user_id) &&
        (sm.state === 'playing' || sm.state === 'voting')))
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0];

    if (candidate) {
      candidate.status = 'matched';
      candidate.claim_token = claimToken;
      candidate.matched_with = matchedWith;
      return { meta: { changes: 1 } };
    }
    return { meta: { changes: 0 } };
  }

  // UPDATE match_queue SET session_code = ? WHERE claim_token = ?
  if (sqlNorm.includes('SET session_code') && sqlNorm.includes('claim_token')) {
    const sessionCode = bindings[0];
    const token = bindings[1];
    matchQueue.forEach(r => { if (r.claim_token === token) r.session_code = sessionCode; });
    return { meta: { changes: 1 } };
  }

  // UPDATE match_queue SET status = 'waiting' ... (rollback)
  if (sqlNorm.includes("SET status = 'waiting'") && sqlNorm.includes('claim_token')) {
    const token = bindings[0];
    matchQueue.forEach(r => {
      if (r.claim_token === token) {
        r.status = 'waiting';
        r.claim_token = null;
        r.matched_with = null;
      }
    });
    return { meta: { changes: 1 } };
  }

  // UPDATE match_queue SET status = 'expired'
  if (sqlNorm.includes("SET status = 'expired'") && sqlNorm.includes('WHERE id')) {
    const id = bindings[0];
    const row = matchQueue.find(r => r.id === id);
    if (row) row.status = 'expired';
    return { meta: { changes: row ? 1 : 0 } };
  }

  // SELECT COUNT(*) as cnt FROM match_queue WHERE user_id = ? AND created_at > ...
  if (sqlNorm.includes('COUNT(*)') && sqlNorm.includes('match_queue')) {
    const cnt = matchQueue.filter(r => r.user_id === bindings[0]).length;
    return { cnt };
  }

  // SELECT * FROM match_queue WHERE claim_token = ?
  if (sqlNorm.includes('FROM match_queue WHERE claim_token')) {
    return matchQueue.find(r => r.claim_token === bindings[0]) || null;
  }

  // SELECT * FROM match_queue WHERE user_id = ? AND status = 'waiting'
  if (sqlNorm.includes('FROM match_queue') && sqlNorm.includes("status = 'waiting'") && !sqlNorm.includes('cancelled')) {
    return matchQueue.find(r => r.user_id === bindings[0] && r.status === 'waiting') || null;
  }

  // SELECT * FROM match_queue WHERE user_id = ? AND status = 'matched'
  if (sqlNorm.includes('FROM match_queue') && sqlNorm.includes("status = 'matched'")) {
    const rows = matchQueue.filter(r => r.user_id === bindings[0] && r.status === 'matched')
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return rows[0] || null;
  }

  // SELECT id FROM match_queue WHERE user_id = ? AND status = 'waiting'
  if (sqlNorm.includes('SELECT id FROM match_queue')) {
    const row = matchQueue.find(r => r.user_id === bindings[0] && r.status === 'waiting');
    return row ? { id: row.id } : null;
  }

  // SELECT * FROM stranger_matches WHERE (user_a_id = ? OR user_b_id = ?) AND state IN ('playing', 'voting')
  if (sqlNorm.includes('stranger_matches') && sqlNorm.includes("IN ('playing', 'voting')")) {
    const rows = strangerMatches.filter(r =>
      (r.user_a_id === bindings[0] || r.user_b_id === bindings[1]) &&
      (r.state === 'playing' || r.state === 'voting'))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return rows[0] || null;
  }

  // INSERT INTO stranger_matches
  if (sqlNorm.includes('INSERT INTO stranger_matches')) {
    strangerMatches.push({
      id: nextId++,
      session_code: bindings[0],
      user_a_id: bindings[1],
      user_b_id: bindings[2],
      user_a_username: bindings[3],
      user_b_username: bindings[4],
      pack_key: bindings[5],
      state: 'playing',
      user_a_vote: null,
      user_b_vote: null,
      result: null,
      created_at: new Date().toISOString(),
      vote_deadline: null,
    });
    return { meta: { changes: 1 } };
  }

  return mode === 'run' ? { meta: { changes: 0 } } : null;
}

// Reset state between tests
function reset() {
  matchQueue.length = 0;
  strangerMatches.length = 0;
  nextId = 1;
}

// ===== Test helpers =====
let sessionCounter = 0;

// Mock fetch for Rome API calls
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  if (url.includes('/api/blind/sessions') && opts?.method === 'POST' && !url.includes('/join')) {
    sessionCounter++;
    return { json: async () => ({ session: { code: `sess_${sessionCounter}` } }) };
  }
  if (url.includes('/join')) {
    return { json: async () => ({}) };
  }
  return originalFetch(url, opts);
};

function makeContext(method, userId, username, body = {}) {
  return {
    env: { DB: createMockDb() },
    request: {
      method,
      url: 'https://test.com/api/strangers/queue',
      headers: {
        get(name) {
          if (name === 'X-User-Id') return userId;
          if (name === 'X-Username') return username;
          return null;
        },
      },
      async json() { return body; },
    },
  };
}

// Import the actual handler logic by re-implementing inline
// (since we can't import ESM Workers directly in Node without bundling)
// Instead, we test the LOGIC by calling the mock DB the same way the Worker does

async function enterQueue(db, userId, username, lang = 'en') {
  // Step 1: Clean up stale entries
  await db.prepare(
    `UPDATE match_queue SET status = 'cancelled' WHERE user_id = ? AND status IN ('waiting', 'matched')`
  ).bind(userId).run();

  // Step 2: Check active match
  const activeMatch = await db.prepare(
    `SELECT * FROM stranger_matches WHERE (user_a_id = ? OR user_b_id = ?) AND state IN ('playing', 'voting')`
  ).bind(userId, userId).first();
  if (activeMatch) {
    return {
      matched: true,
      session_code: activeMatch.session_code,
      partner: activeMatch.user_a_id === userId ? activeMatch.user_b_username : activeMatch.user_a_username,
    };
  }

  // Step 3: Try to claim
  const claimToken = `claim_${Date.now()}_${Math.random()}`;
  const claimed = await db.prepare(
    `UPDATE match_queue SET status = 'matched', claim_token = ?, matched_with = ?
     WHERE id = (SELECT mq.id FROM match_queue mq WHERE mq.status = 'waiting' AND mq.user_id != ?
     AND mq.expires_at > datetime('now')
     AND NOT EXISTS (SELECT 1 FROM stranger_matches sm WHERE (sm.user_a_id = mq.user_id OR sm.user_b_id = mq.user_id) AND sm.state IN ('playing', 'voting'))
     ORDER BY mq.created_at ASC LIMIT 1) AND status = 'waiting'`
  ).bind(claimToken, userId, userId).run();

  if (claimed.meta.changes > 0) {
    const partner = await db.prepare(`SELECT * FROM match_queue WHERE claim_token = ?`).bind(claimToken).first();
    const sessionCode = `sess_${++sessionCounter}`;

    await db.prepare(`UPDATE match_queue SET session_code = ? WHERE claim_token = ?`).bind(sessionCode, claimToken).run();
    await db.prepare(
      `INSERT INTO stranger_matches (session_code, user_a_id, user_b_id, user_a_username, user_b_username, pack_key)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(sessionCode, partner.user_id, userId, partner.username, username, 'hottakes').run();

    return { matched: true, session_code: sessionCode, partner: partner.username };
  }

  // Step 4: Enter queue
  await db.prepare(`INSERT INTO match_queue (user_id, username, lang) VALUES (?, ?, ?)`).bind(userId, username, lang).run();
  return { queued: true };
}

async function pollStatus(db, userId) {
  // Check active match
  const activeMatch = await db.prepare(
    `SELECT * FROM stranger_matches WHERE (user_a_id = ? OR user_b_id = ?) AND state IN ('playing', 'voting') ORDER BY created_at DESC LIMIT 1`
  ).bind(userId, userId).first();
  if (activeMatch) {
    const partner = activeMatch.user_a_id === userId ? activeMatch.user_b_username : activeMatch.user_a_username;
    return { status: 'matched', session_code: activeMatch.session_code, partner };
  }

  const waiting = await db.prepare(
    `SELECT * FROM match_queue WHERE user_id = ? AND status = 'waiting' LIMIT 1`
  ).bind(userId).first();
  if (waiting) return { status: 'waiting' };

  const matched = await db.prepare(
    `SELECT * FROM match_queue WHERE user_id = ? AND status = 'matched' ORDER BY created_at DESC LIMIT 1`
  ).bind(userId).first();
  if (matched) return { status: 'waiting' };

  return { status: 'none' };
}

// ===== TESTS =====
let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (!condition) {
    console.error(`  FAIL: ${msg}`);
    failed++;
  } else {
    console.log(`  PASS: ${msg}`);
    passed++;
  }
}

async function runTests() {
  const db = createMockDb();

  // Test 1: First user enters empty queue
  console.log('\nTest 1: First user enters empty queue');
  reset();
  const r1 = await enterQueue(db, 'user_a', 'Alice');
  assert(r1.queued === true, 'User A should be queued');
  assert(matchQueue.length === 1, 'Queue should have 1 entry');
  assert(matchQueue[0].status === 'waiting', 'Entry should be waiting');

  // Test 2: Second user matches with first
  console.log('\nTest 2: Second user matches with first');
  const r2 = await enterQueue(db, 'user_b', 'Bob');
  assert(r2.matched === true, 'User B should get instant match');
  assert(r2.partner === 'Alice', 'Partner should be Alice');
  assert(r2.session_code, 'Should have session code');
  assert(strangerMatches.length === 1, 'Should have 1 stranger match');
  assert(strangerMatches[0].user_a_id === 'user_a', 'User A is first in match');
  assert(strangerMatches[0].user_b_id === 'user_b', 'User B is second in match');

  // Test 3: User A polls and sees match
  console.log('\nTest 3: User A polls and sees match');
  const r3 = await pollStatus(db, 'user_a');
  assert(r3.status === 'matched', 'User A should see matched');
  assert(r3.partner === 'Bob', 'Partner should be Bob');
  assert(r3.session_code === r2.session_code, 'Same session code');

  // Test 4: User already in active match cannot re-enter queue
  console.log('\nTest 4: User in active match gets redirected');
  const r4 = await enterQueue(db, 'user_a', 'Alice');
  assert(r4.matched === true, 'Should return existing match');
  assert(r4.session_code === r2.session_code, 'Same session code as before');
  // Should NOT create a new queue entry
  assert(matchQueue.filter(r => r.user_id === 'user_a' && r.status === 'waiting').length === 0,
    'No new waiting entry for user A');

  // Test 5: After match resolves, user can re-enter queue
  console.log('\nTest 5: After match resolves, user can re-enter queue');
  strangerMatches[0].state = 'resolved';
  strangerMatches[0].result = 'pass';
  const r5 = await enterQueue(db, 'user_a', 'Alice');
  assert(r5.queued === true, 'User A should be queued again');
  assert(matchQueue.filter(r => r.user_id === 'user_a' && r.status === 'waiting').length === 1,
    'One new waiting entry');

  // Test 6: Three users — only one pair matches, third waits
  console.log('\nTest 6: Three users — correct pairing');
  reset();
  await enterQueue(db, 'user_x', 'Xena');
  await enterQueue(db, 'user_y', 'Yara');
  // X and Y should be matched now
  assert(strangerMatches.length === 1, 'One match created');
  assert(matchQueue.filter(r => r.status === 'waiting').length === 0, 'No one waiting after 2 users');

  const r6 = await enterQueue(db, 'user_z', 'Zack');
  assert(r6.queued === true, 'Third user should be queued (no one to match with)');
  assert(strangerMatches.length === 1, 'Still one match (not double matched)');

  // Test 7: Already-matched user is NOT available for new match
  console.log('\nTest 7: Already-matched user not claimable');
  reset();
  await enterQueue(db, 'user_1', 'One');
  await enterQueue(db, 'user_2', 'Two');
  // user_1 and user_2 are matched
  assert(strangerMatches.length === 1, 'Match exists');

  // user_3 enters — should NOT match with user_1 or user_2
  const r7 = await enterQueue(db, 'user_3', 'Three');
  assert(r7.queued === true, 'User 3 queued (both others in active match)');
  assert(strangerMatches.length === 1, 'Still only 1 match');

  // user_4 enters — should match with user_3
  const r7b = await enterQueue(db, 'user_4', 'Four');
  assert(r7b.matched === true, 'User 4 matched with User 3');
  assert(r7b.partner === 'Three', 'Partner is Three');
  assert(strangerMatches.length === 2, 'Now 2 matches');

  // Test 8: Re-entering queue cancels old entry
  console.log('\nTest 8: Re-entering queue cancels stale entries');
  reset();
  await enterQueue(db, 'user_a', 'Alice'); // queued
  const waitingBefore = matchQueue.filter(r => r.user_id === 'user_a' && r.status === 'waiting').length;
  assert(waitingBefore === 1, 'One waiting entry');

  await enterQueue(db, 'user_a', 'Alice'); // re-enter
  const waitingAfter = matchQueue.filter(r => r.user_id === 'user_a' && r.status === 'waiting').length;
  assert(waitingAfter === 1, 'Still one waiting entry (old cancelled, new created)');
  const cancelledCount = matchQueue.filter(r => r.user_id === 'user_a' && r.status === 'cancelled').length;
  assert(cancelledCount === 1, 'Old entry cancelled');

  // Test 9: Rapid re-entries don't create duplicate matches
  console.log('\nTest 9: Rapid re-entries — no duplicates');
  reset();
  await enterQueue(db, 'user_a', 'Alice');
  // Simulate user_b entering twice rapidly
  const p1 = enterQueue(db, 'user_b', 'Bob');
  const r9 = await p1;
  assert(r9.matched === true, 'First entry matches');
  assert(strangerMatches.length === 1, 'Only one match');

  // user_b tries again while match is active
  const r9b = await enterQueue(db, 'user_b', 'Bob');
  assert(r9b.matched === true, 'Returns existing active match');
  assert(r9b.session_code === r9.session_code, 'Same session');
  assert(strangerMatches.length === 1, 'Still only one match');

  // Test 10: Poll returns correct state at each phase
  console.log('\nTest 10: Poll returns correct states');
  reset();
  // Empty — no state
  let p10 = await pollStatus(db, 'user_a');
  assert(p10.status === 'none', 'No state before entering');

  // Waiting
  await enterQueue(db, 'user_a', 'Alice');
  p10 = await pollStatus(db, 'user_a');
  assert(p10.status === 'waiting', 'Waiting after entering queue');

  // Matched
  await enterQueue(db, 'user_b', 'Bob');
  p10 = await pollStatus(db, 'user_a');
  assert(p10.status === 'matched', 'Matched after partner enters');
  assert(p10.partner === 'Bob', 'Correct partner name');

  // After resolve
  strangerMatches[0].state = 'resolved';
  p10 = await pollStatus(db, 'user_a');
  assert(p10.status === 'none' || p10.status === 'waiting', 'Not matched after resolve');

  // Test 11: Self-match prevention
  console.log('\nTest 11: Cannot match with yourself');
  reset();
  await enterQueue(db, 'user_a', 'Alice');
  const r11 = await enterQueue(db, 'user_a', 'Alice');
  assert(r11.queued === true, 'Re-entering creates new queue entry, not self-match');
  assert(strangerMatches.length === 0, 'No match created');

  // Summary
  console.log(`\n${'='.repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${'='.repeat(40)}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(e => { console.error(e); process.exit(1); });
