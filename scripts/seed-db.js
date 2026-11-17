require('dotenv').config();
const crypto = require('crypto');
const pool = require('../src/db');

async function seed() {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[projectCount]] = await connection.execute('SELECT COUNT(*) AS count FROM projects');
    if (projectCount.count > 0) {
      throw new Error('Seed stopped: projects table is not empty. Seed only into a fresh database.');
    }
    const inviteCode = crypto.randomBytes(12).toString('hex').toUpperCase();
    const [team] = await connection.execute(
      'INSERT INTO teams (name, invite_code) VALUES (?, ?)',
      ['Demo Team', inviteCode]
    );
    const [projects] = await connection.query(
      `INSERT INTO projects (team_id, name, description, start_date, end_date) VALUES
       (?, 'Website refresh', 'Improve the team website and content.', '2026-01-05', '2026-03-30'),
       (?, 'Mobile app launch', 'Prepare the first mobile app release.', '2026-02-01', '2026-06-15')`,
      [team.insertId, team.insertId]
    );
    const projectIds = [projects.insertId, projects.insertId + 1];
    const [members] = await connection.query(
      `INSERT INTO team_members (team_id, name, email, role) VALUES
       (?, 'Asha Patel', 'asha@example.com', 'Designer'),
       (?, 'Leo Chen', 'leo@example.com', 'Developer'),
       (?, 'Mina Hassan', 'mina@example.com', 'Project manager')`,
      [team.insertId, team.insertId, team.insertId]
    );
    const memberIds = [members.insertId, members.insertId + 1, members.insertId + 2];
    await connection.query(
      `INSERT INTO tasks (title, description, project_id, member_id, status, priority, due_date) VALUES
       (?, 'Collect feedback from the team.', ?, ?, 'To Do', 'Medium', '2026-03-10'),
       (?, 'Build the responsive task board.', ?, ?, 'In Progress', 'High', '2026-04-20'),
       (?, 'Draft release checklist.', ?, ?, 'Done', 'Low', '2026-05-01')`,
      [
        'Plan website content', projectIds[0], memberIds[2],
        'Create task board UI', projectIds[0], memberIds[1],
        'Prepare app checklist', projectIds[1], memberIds[0]
      ]
    );
    await connection.commit();
    console.log(`Added 2 projects, 3 team members, and 3 tasks to Demo Team. Join code: ${inviteCode}`);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

seed().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
