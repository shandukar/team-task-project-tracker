const express = require('express');
const {
  validateTask,
  requiredId,
  TASK_STATUSES,
  TASK_PRIORITIES,
  ValidationError
} = require('../validation');

function createTasksRouter(db) {
  const router = express.Router();

  router.get('/', async (req, res, next) => {
    try {
      const clauses = ['p.team_id = ?'];
      const params = [req.user.team_id];
      if (req.query.project_id !== undefined && req.query.project_id !== '') {
        clauses.push('t.project_id = ?');
        params.push(requiredId(req.query.project_id, 'Project ID'));
      }
      if (req.query.member_id === 'unassigned') {
        clauses.push('t.member_id IS NULL');
      } else if (req.query.member_id !== undefined && req.query.member_id !== '') {
        clauses.push('t.member_id = ?');
        params.push(requiredId(req.query.member_id, 'Assignee ID'));
      }
      if (req.query.status) {
        if (!TASK_STATUSES.includes(req.query.status)) {
          throw new ValidationError(`Status must be one of: ${TASK_STATUSES.join(', ')}.`);
        }
        clauses.push('t.status = ?');
        params.push(req.query.status);
      }
      if (req.query.priority) {
        if (!TASK_PRIORITIES.includes(req.query.priority)) {
          throw new ValidationError(`Priority must be one of: ${TASK_PRIORITIES.join(', ')}.`);
        }
        clauses.push('t.priority = ?');
        params.push(req.query.priority);
      }
      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
      const [rows] = await db.execute(
        `SELECT t.*, p.name AS project_name, m.name AS member_name
         FROM tasks t JOIN projects p ON p.id = t.project_id
         LEFT JOIN team_members m ON m.id = t.member_id
         ${where} ORDER BY t.created_at DESC`,
        params
      );
      res.json({ data: rows });
    } catch (error) { next(error); }
  });

  router.post('/', async (req, res, next) => {
    try {
      const task = validateTask(req.body);
      const [result] = await db.execute(
        'INSERT INTO tasks (title, description, project_id, member_id, status, priority, due_date)\n' +
        'SELECT $1, $2, p.id, $3, $4, $5, $6 FROM projects p\n' +
        'WHERE p.id = $7 AND p.team_id = $8 AND ($9::integer IS NULL OR EXISTS (SELECT 1 FROM team_members m WHERE m.id = $10 AND m.team_id = $11))\n' +
        'RETURNING id',
        [
          task.title, task.description, task.member_id, task.status, task.priority, task.due_date,
          task.project_id, req.user.team_id, task.member_id, task.member_id, req.user.team_id
        ]
      );
      if (!result.affectedRows) {
        return res.status(400).json({ error: { message: 'The selected project or assignee does not belong to your team.' } });
      }
      const [rows] = await db.execute(
        `SELECT t.*, p.name AS project_name, m.name AS member_name
         FROM tasks t JOIN projects p ON p.id = t.project_id
         LEFT JOIN team_members m ON m.id = t.member_id WHERE t.id = ? AND p.team_id = ?`,
        [result.insertId, req.user.team_id]
      );
      res.status(201).json({ data: rows[0] });
    } catch (error) { next(error); }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const id = requiredId(req.params.id, 'Task ID');
      const [rows] = await db.execute(
        `SELECT t.*, p.name AS project_name, m.name AS member_name
         FROM tasks t JOIN projects p ON p.id = t.project_id
         LEFT JOIN team_members m ON m.id = t.member_id WHERE t.id = ? AND p.team_id = ?`,
        [id, req.user.team_id]
      );
      if (!rows.length) return res.status(404).json({ error: { message: 'Task not found.' } });
      res.json({ data: rows[0] });
    } catch (error) { next(error); }
  });

  router.put('/:id', async (req, res, next) => {
    try {
      const id = requiredId(req.params.id, 'Task ID');
      const task = validateTask(req.body);
      const [projectRows] = await db.execute(
        'SELECT id FROM projects WHERE id = ? AND team_id = ?',
        [task.project_id, req.user.team_id]
      );
      if (!projectRows.length) {
        return res.status(400).json({ error: { message: 'The selected project does not belong to your team.' } });
      }
      if (task.member_id !== null) {
        const [memberRows] = await db.execute(
          'SELECT id FROM team_members WHERE id = ? AND team_id = ?',
          [task.member_id, req.user.team_id]
        );
        if (!memberRows.length) {
          return res.status(400).json({ error: { message: 'The selected assignee does not belong to your team.' } });
        }
      }
      await db.execute(
        `UPDATE tasks SET title = ?, description = ?, project_id = ?, member_id = ?,
         status = ?, priority = ?, due_date = ? WHERE id = ?
         AND project_id IN (SELECT id FROM projects WHERE team_id = ?)`,
        [task.title, task.description, task.project_id, task.member_id, task.status, task.priority, task.due_date, id, req.user.team_id]
      );
      const [rows] = await db.execute(
        `SELECT t.*, p.name AS project_name, m.name AS member_name
         FROM tasks t JOIN projects p ON p.id = t.project_id
         LEFT JOIN team_members m ON m.id = t.member_id WHERE t.id = ? AND p.team_id = ?`,
        [id, req.user.team_id]
      );
      if (!rows.length) return res.status(404).json({ error: { message: 'Task not found.' } });
      res.json({ data: rows[0] });
    } catch (error) { next(error); }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      const id = requiredId(req.params.id, 'Task ID');
      const [result] = await db.execute(
        'DELETE FROM tasks WHERE id = ? AND project_id IN (SELECT id FROM projects WHERE team_id = ?)',
        [id, req.user.team_id]
      );
      if (!result.affectedRows) return res.status(404).json({ error: { message: 'Task not found.' } });
      res.json({ data: { message: 'Task deleted.' } });
    } catch (error) { next(error); }
  });

  return router;
}

module.exports = createTasksRouter;
