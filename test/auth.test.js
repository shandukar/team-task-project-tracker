const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const createApp = require('../src/app');
const { hashPassword, verifyPassword, newInviteCode } = require('../src/auth');

function registrationDb({ existingTeam = true } = {}) {
  const statements = [];
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    execute: async (sql, params = []) => {
      statements.push({ sql, params });
      if (sql.startsWith('INSERT INTO teams')) return [{ insertId: 7 }, []];
      if (sql.startsWith('SELECT id FROM teams')) return [existingTeam ? [{ id: 7 }] : [], []];
      if (sql.startsWith('INSERT INTO users')) return [{ insertId: 11 }, []];
      return [{ affectedRows: 1 }, []];
    }
  };
  const db = {
    getConnection: async () => connection,
    execute: async (sql, params = []) => {
      statements.push({ sql, params });
      if (sql.includes('FROM auth_sessions')) {
        return [[{ user_id: 11, name: 'Team Owner', email: 'owner@example.com', team_id: 7, team_name: 'Product Team', invite_code: 'A1B2C3D4E5F60718293A4B5C' }]];
      }
      if (sql.includes('FROM users u')) {
        return [[{ id: 11, name: 'Team Owner', email: 'owner@example.com', team_name: 'Product Team', invite_code: 'A1B2C3D4E5F60718293A4B5C' }]];
      }
      return [{ affectedRows: 1 }, []];
    }
  };
  return { db, statements };
}

test('passwords are stored as salted hashes and verify only with the right password', async () => {
  const encoded = await hashPassword('correct horse battery staple');
  assert.notEqual(encoded, 'correct horse battery staple');
  assert.equal(await verifyPassword('correct horse battery staple', encoded), true);
  assert.equal(await verifyPassword('incorrect password', encoded), false);
});

test('invite codes can be safely normalized without changing their value', () => {
  const code = newInviteCode();
  assert.match(code, /^[A-F0-9]{24}$/);
  assert.equal(code, code.toUpperCase());
});

test('login accepts the matching password and rejects incorrect credentials', async () => {
  const passwordHash = await hashPassword('a-safe-password');
  const db = {
    execute: async (sql) => {
      if (sql.includes('FROM users u')) {
        return [[{ id: 21, name: 'Existing User', email: 'user@example.com', password_hash: passwordHash }]];
      }
      return [{ affectedRows: 1 }, []];
    }
  };
  const app = createApp(db);
  const success = await request(app).post('/api/auth/login').send({
    email: 'USER@example.com',
    password: 'a-safe-password'
  });
  assert.equal(success.status, 200);
  assert.match(success.headers['set-cookie'][0], /HttpOnly/);

  const failure = await request(app).post('/api/auth/login').send({
    email: 'user@example.com',
    password: 'wrong-password'
  });
  assert.equal(failure.status, 401);
  assert.match(failure.body.error.message, /incorrect/i);
});

test('registration creates a team, member account, and session transactionally', async () => {
  const { db, statements } = registrationDb();
  const app = createApp(db);
  const response = await request(app).post('/api/auth/register').send({
    name: 'Team Owner',
    email: 'owner@example.com',
    password: 'a-safe-password',
    mode: 'create',
    teamName: 'Product Team'
  });
  assert.equal(response.status, 201);
  assert.equal(response.body.data.email, 'owner@example.com');
  assert.match(response.headers['set-cookie'][0], /HttpOnly/);
  assert.ok(statements.some(({ sql }) => sql.startsWith('INSERT INTO teams')));
  assert.ok(statements.some(({ sql }) => sql.startsWith('INSERT INTO team_memberships')));
  assert.ok(statements.some(({ sql }) => sql.startsWith('INSERT INTO auth_sessions')));
  const profile = await request(app).get('/api/auth/me').set('Cookie', response.headers['set-cookie']);
  assert.equal(profile.status, 200);
  assert.equal(profile.body.data.team_name, 'Product Team');
  assert.equal(profile.body.data.invite_code, 'A1B2C3D4E5F60718293A4B5C');
});

test('registration joins only the team identified by a valid invite code', async () => {
  const { db, statements } = registrationDb();
  const response = await request(createApp(db)).post('/api/auth/register').send({
    name: 'Teammate',
    email: 'member@example.com',
    password: 'a-safe-password',
    mode: 'join',
    inviteCode: 'a1b2c3d4e5f60718293a4b5c'
  });
  assert.equal(response.status, 201);
  assert.equal(statements.some(({ sql }) => sql.startsWith('INSERT INTO teams')), false);
  assert.deepEqual(statements.find(({ sql }) => sql.startsWith('SELECT id FROM teams')).params, ['A1B2C3D4E5F60718293A4B5C']);
  assert.deepEqual(statements.find(({ sql }) => sql.startsWith('INSERT INTO team_memberships')).params, [11, 7, 'member']);
});

test('registration rejects an unknown invite code without creating an account', async () => {
  const { db, statements } = registrationDb({ existingTeam: false });
  const response = await request(createApp(db)).post('/api/auth/register').send({
    name: 'Teammate',
    email: 'member@example.com',
    password: 'a-safe-password',
    mode: 'join',
    inviteCode: 'UNKNOWN'
  });
  assert.equal(response.status, 400);
  assert.equal(statements.some(({ sql }) => sql.startsWith('INSERT INTO users')), false);
});
