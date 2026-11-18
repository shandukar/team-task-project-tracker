require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../src/db');

async function setup() {
  try {
    const schema = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8');
    await pool.query(schema);
    console.log(`PostgreSQL database ${process.env.PGDATABASE || 'team_task_tracker'} schema is ready.`);
  } finally {
    await pool.end();
  }
}

setup().catch((error) => {
  console.error('Could not set up the PostgreSQL database:', error.message);
  process.exitCode = 1;
});
