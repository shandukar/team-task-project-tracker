const express = require('express');
const { validateMember, requiredId } = require('../validation');

function createMembersRouter(db) {
  const router = express.Router();

  router.get('/', async (req, res, next) => {
    try {
      const [rows] = await db.execute(
        'SELECT id, name, email, role, created_at, updated_at FROM team_members WHERE team_id = ? ORDER BY name',
        [req.user.team_id]
      );
      res.json({ data: rows });
    } catch (error) { next(error); }
  });

  router.post('/', async (req, res, next) => {
    try {
      const member = validateMember(req.body);
      const [result] = await db.execute(
        'INSERT INTO team_members (team_id, name, email, role) VALUES (?, ?, ?, ?) RETURNING id',
        [req.user.team_id, member.name, member.email, member.role]
      );
      const [rows] = await db.execute('SELECT * FROM team_members WHERE id = ? AND team_id = ?', [result.insertId, req.user.team_id]);
      res.status(201).json({ data: rows[0] });
    } catch (error) { next(error); }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const id = requiredId(req.params.id, 'Member ID');
      const [rows] = await db.execute('SELECT * FROM team_members WHERE id = ? AND team_id = ?', [id, req.user.team_id]);
      if (!rows.length) return res.status(404).json({ error: { message: 'Team member not found.' } });
      res.json({ data: rows[0] });
    } catch (error) { next(error); }
  });

  router.put('/:id', async (req, res, next) => {
    try {
      const id = requiredId(req.params.id, 'Member ID');
      const member = validateMember(req.body);
      await db.execute(
        'UPDATE team_members SET name = ?, email = ?, role = ? WHERE id = ? AND team_id = ?',
        [member.name, member.email, member.role, id, req.user.team_id]
      );
      const [rows] = await db.execute('SELECT * FROM team_members WHERE id = ? AND team_id = ?', [id, req.user.team_id]);
      if (!rows.length) return res.status(404).json({ error: { message: 'Team member not found.' } });
      res.json({ data: rows[0] });
    } catch (error) { next(error); }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      const id = requiredId(req.params.id, 'Member ID');
      const [result] = await db.execute('DELETE FROM team_members WHERE id = ? AND team_id = ?', [id, req.user.team_id]);
      if (!result.affectedRows) return res.status(404).json({ error: { message: 'Team member not found.' } });
      res.json({ data: { message: 'Team member deleted; assigned tasks are now unassigned.' } });
    } catch (error) { next(error); }
  });

  return router;
}

module.exports = createMembersRouter;
