const express = require('express');
const { validateProject, requiredId } = require('../validation');

function createProjectsRouter(db) {
  const router = express.Router();

  router.get('/', async (req, res, next) => {
    try {
      const [rows] = await db.execute(
        'SELECT id, name, description, start_date, end_date, created_at, updated_at FROM projects WHERE team_id = ? ORDER BY created_at DESC',
        [req.user.team_id]
      );
      res.json({ data: rows });
    } catch (error) { next(error); }
  });

  router.post('/', async (req, res, next) => {
    try {
      const project = validateProject(req.body);
      const [result] = await db.execute(
        'INSERT INTO projects (team_id, name, description, start_date, end_date) VALUES (?, ?, ?, ?, ?) RETURNING id',
        [req.user.team_id, project.name, project.description, project.start_date, project.end_date]
      );
      const [rows] = await db.execute('SELECT * FROM projects WHERE id = ? AND team_id = ?', [result.insertId, req.user.team_id]);
      res.status(201).json({ data: rows[0] });
    } catch (error) { next(error); }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const id = requiredId(req.params.id, 'Project ID');
      const [rows] = await db.execute('SELECT * FROM projects WHERE id = ? AND team_id = ?', [id, req.user.team_id]);
      if (!rows.length) return res.status(404).json({ error: { message: 'Project not found.' } });
      res.json({ data: rows[0] });
    } catch (error) { next(error); }
  });

  router.put('/:id', async (req, res, next) => {
    try {
      const id = requiredId(req.params.id, 'Project ID');
      const project = validateProject(req.body);
      await db.execute(
        'UPDATE projects SET name = ?, description = ?, start_date = ?, end_date = ? WHERE id = ? AND team_id = ?',
        [project.name, project.description, project.start_date, project.end_date, id, req.user.team_id]
      );
      const [rows] = await db.execute('SELECT * FROM projects WHERE id = ? AND team_id = ?', [id, req.user.team_id]);
      if (!rows.length) return res.status(404).json({ error: { message: 'Project not found.' } });
      res.json({ data: rows[0] });
    } catch (error) { next(error); }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      const id = requiredId(req.params.id, 'Project ID');
      const [result] = await db.execute('DELETE FROM projects WHERE id = ? AND team_id = ?', [id, req.user.team_id]);
      if (!result.affectedRows) return res.status(404).json({ error: { message: 'Project not found.' } });
      res.json({ data: { message: 'Project and its tasks deleted.' } });
    } catch (error) { next(error); }
  });

  return router;
}

module.exports = createProjectsRouter;
