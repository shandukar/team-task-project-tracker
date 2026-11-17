require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');

async function ensureTeamColumn(connection, tableName, constraintName) {
  const database = process.env.DB_NAME || 'team_task_tracker';
  const [[column]] = await connection.execute(
    `SELECT COUNT(*) AS count FROM information_schema.columns
     WHERE table_schema = ? AND table_name = ? AND column_name = 'team_id'`,
    [database, tableName]
  );
  if (!column.count) {
    await connection.query(`ALTER TABLE \`${tableName}\` ADD COLUMN team_id INT UNSIGNED NULL`);
  }
  const [[index]] = await connection.execute(
    `SELECT COUNT(*) AS count FROM information_schema.statistics
     WHERE table_schema = ? AND table_name = ? AND index_name = ?`,
    [database, tableName, `idx_${tableName}_team`]
  );
  if (!index.count) {
    await connection.query(`ALTER TABLE \`${tableName}\` ADD KEY idx_${tableName}_team (team_id)`);
  }
  const [[constraint]] = await connection.execute(
    `SELECT COUNT(*) AS count FROM information_schema.table_constraints
     WHERE constraint_schema = ? AND table_name = ? AND constraint_name = ?`,
    [database, tableName, constraintName]
  );
  if (!constraint.count) {
    await connection.query(
      `ALTER TABLE \`${tableName}\` ADD CONSTRAINT \`${constraintName}\`
       FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE`
    );
  }
}

async function setup() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true
  });
  try {
    const schema = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8');
    await connection.query(schema);
    await ensureTeamColumn(connection, 'projects', 'fk_projects_team');
    await ensureTeamColumn(connection, 'team_members', 'fk_team_members_team');

    const database = process.env.DB_NAME || 'team_task_tracker';
    const [[oldEmailIndex]] = await connection.execute(
      `SELECT COUNT(*) AS count FROM information_schema.statistics
       WHERE table_schema = ? AND table_name = 'team_members' AND index_name = 'uq_team_members_email'`,
      [database]
    );
    if (oldEmailIndex.count) {
      await connection.query('ALTER TABLE team_members DROP INDEX uq_team_members_email');
    }
    const [[teamEmailIndex]] = await connection.execute(
      `SELECT COUNT(*) AS count FROM information_schema.statistics
       WHERE table_schema = ? AND table_name = 'team_members' AND index_name = 'uq_team_members_team_email'`,
      [database]
    );
    if (!teamEmailIndex.count) {
      await connection.query(
        'ALTER TABLE team_members ADD UNIQUE KEY uq_team_members_team_email (team_id, email)'
      );
    }

    const [[legacyRows]] = await connection.execute(
      'SELECT (SELECT COUNT(*) FROM projects WHERE team_id IS NULL) + (SELECT COUNT(*) FROM team_members WHERE team_id IS NULL) AS count'
    );
    if (legacyRows.count) {
      const inviteCode = crypto.randomBytes(12).toString('hex').toUpperCase();
      const [team] = await connection.execute(
        'INSERT INTO teams (name, invite_code) VALUES (?, ?)',
        ['Migrated workspace', inviteCode]
      );
      await connection.execute('UPDATE projects SET team_id = ? WHERE team_id IS NULL', [team.insertId]);
      await connection.execute('UPDATE team_members SET team_id = ? WHERE team_id IS NULL', [team.insertId]);
      console.log(`Existing records moved into "Migrated workspace". Join code: ${inviteCode}`);
    }
    console.log(`Database ${process.env.DB_NAME || 'team_task_tracker'} schema is ready.`);
  } finally {
    await connection.end();
  }
}

setup().catch((error) => {
  console.error('Could not set up the database:', error.message);
  process.exitCode = 1;
});
