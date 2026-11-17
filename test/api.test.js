const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const createApp = require('../src/app');

function testDb(query = async () => [[], []]) {
  return {
    execute: async (sql, params = []) => {
      if (sql.includes('FROM auth_sessions')) {
        return [[{ user_id: 1, name: 'Test User', email: 'test@example.com', team_id: 1, team_name: 'Test Team', invite_code: 'TESTCODE' }]];
      }
      return query(sql, params);
    }
  };
}

function makeDb() {
  return testDb(async (sql, params = []) => {
    if (sql.includes('FROM projects WHERE id') && params[0] === 1) return [[{ id: 1, name: 'Demo' }]];
    if (sql.startsWith('INSERT INTO projects')) return [{ insertId: 1 }];
    if (sql.startsWith('UPDATE projects')) return [{ affectedRows: 0 }];
    if (sql.startsWith('DELETE FROM projects')) return [{ affectedRows: 0 }];
    return [[], []];
  });
}

function authed(app) {
  const withCookie = (testRequest) => testRequest.set('Cookie', 'tt_session=test-session');
  return {
    get: (path) => withCookie(request(app).get(path)),
    post: (path) => withCookie(request(app).post(path))
  };
}

test('health endpoint responds with a consistent data envelope', async () => {
  const response = await request(createApp(makeDb())).get('/api/health');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { data: { status: 'ok' } });
});

test('project creation rejects missing required fields before querying the database', async () => {
  let called = false;
  const app = createApp(testDb(async () => { called = true; return [[], []]; }));
  const response = await authed(app).post('/api/projects').send({ description: 'No name' });
  assert.equal(response.status, 400);
  assert.match(response.body.error.message, /Project name is required/);
  assert.equal(called, false);
});

test('create endpoints reject non-object JSON bodies with 400', async () => {
  let called = false;
  const app = createApp(testDb(async () => { called = true; return [[], []]; }));
  const endpoints = ['/api/projects', '/api/members', '/api/tasks'];

  for (const endpoint of endpoints) {
    const response = await authed(app)
      .post(endpoint)
      .set('Content-Type', 'application/json')
      .send([1]);
    assert.equal(response.status, 400);
    assert.match(response.body.error.message, /JSON object/);
  }
  assert.equal(called, false);
});

test('task creation rejects unsupported status and malformed dates', async () => {
  const app = createApp(testDb(async () => { throw new Error('Database should not be called'); }));
  const invalidStatus = await authed(app).post('/api/tasks').send({
    title: 'Build thing', project_id: 1, status: 'Blocked'
  });
  assert.equal(invalidStatus.status, 400);
  const invalidDate = await authed(app).post('/api/projects').send({ name: 'Demo', start_date: '2026-02-30' });
  assert.equal(invalidDate.status, 400);
});

test('project date range and task filters reject invalid values', async () => {
  const app = createApp(testDb(async () => [[], []]));
  const reversedDates = await authed(app).post('/api/projects').send({
    name: 'Demo', start_date: '2026-03-01', end_date: '2026-02-01'
  });
  assert.equal(reversedDates.status, 400);
  const invalidFilter = await authed(app).get('/api/tasks?priority=Urgent');
  assert.equal(invalidFilter.status, 400);
  const unassigned = await authed(app).get('/api/tasks?member_id=unassigned');
  assert.equal(unassigned.status, 200);
});

test('missing records return 404 and invalid identifiers return 400', async () => {
  const app = createApp(makeDb());
  const missing = await authed(app).get('/api/projects/9');
  assert.equal(missing.status, 404);
  const invalid = await authed(app).get('/api/projects/nope');
  assert.equal(invalid.status, 400);
});

test('unknown API routes return a JSON 404 response', async () => {
  const response = await authed(createApp(makeDb())).get('/api/no-such-route');
  assert.equal(response.status, 404);
  assert.ok(response.body.error);
});

test('workspace APIs reject requests without a valid login session', async () => {
  const response = await request(createApp(makeDb())).get('/api/projects');
  assert.equal(response.status, 401);
  assert.match(response.body.error.message, /log in/i);
  const profile = await request(createApp(makeDb())).get('/api/auth/me');
  assert.equal(profile.status, 401);
});

test('login and registration pages are served by the web app', async () => {
  const app = createApp(makeDb());
  const login = await request(app).get('/login.html');
  const register = await request(app).get('/register.html');
  assert.equal(login.status, 200);
  assert.match(login.text, /Welcome back/);
  assert.equal(register.status, 200);
  assert.match(register.text, /Create your account/);
});
