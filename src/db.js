const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || undefined,
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE || 'team_task_tracker',
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: true } : undefined,
  max: 10
});

function postgresPlaceholders(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

async function execute(client, sql, params = []) {
  const rawResult = params.length
    ? await client.query(postgresPlaceholders(sql), params)
    : await client.query(sql);
  const result = Array.isArray(rawResult) ? rawResult[rawResult.length - 1] : rawResult;
  if (result.command === 'SELECT') return [result.rows];
  return [{
    affectedRows: result.rowCount,
    insertId: result.rows?.[0]?.id,
    rowCount: result.rowCount,
    rows: result.rows || []
  }];
}

module.exports = {
  execute: (sql, params) => execute(pool, sql, params),
  query: (sql, params) => execute(pool, sql, params),
  end: () => pool.end(),
  postgresPlaceholders,
  getConnection: async () => {
    const client = await pool.connect();
    return {
      execute: (sql, params) => execute(client, sql, params),
      query: (sql, params) => execute(client, sql, params),
      beginTransaction: () => client.query('BEGIN'),
      commit: () => client.query('COMMIT'),
      rollback: () => client.query('ROLLBACK'),
      release: () => client.release()
    };
  }
};
