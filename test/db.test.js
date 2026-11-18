const test = require('node:test');
const assert = require('node:assert/strict');
const { postgresPlaceholders } = require('../src/db');

test('PostgreSQL adapter numbers each positional parameter in order', () => {
  assert.equal(
    postgresPlaceholders('SELECT * FROM tasks WHERE team_id = ? AND status = ? AND member_id = ?'),
    'SELECT * FROM tasks WHERE team_id = $1 AND status = $2 AND member_id = $3'
  );
});

test('PostgreSQL adapter leaves statements without parameters unchanged', () => {
  const sql = "SELECT CURRENT_TIMESTAMP + INTERVAL '7 days'";
  assert.equal(postgresPlaceholders(sql), sql);
});
