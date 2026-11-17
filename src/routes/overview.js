const express = require('express');

function createOverviewRouter(db) {
  const router = express.Router();
  router.get('/', async (req, res, next) => {
    try {
      const [[totals]] = await db.execute(
        `SELECT
          (SELECT COUNT(*) FROM projects WHERE team_id = ?) AS projects,
          (SELECT COUNT(*) FROM tasks t JOIN projects p ON p.id = t.project_id WHERE p.team_id = ?) AS tasks,
          (SELECT COUNT(*) FROM team_members WHERE team_id = ?) AS members,
          (SELECT COUNT(*) FROM tasks t JOIN projects p ON p.id = t.project_id WHERE p.team_id = ? AND t.status = 'To Do') AS to_do,
          (SELECT COUNT(*) FROM tasks t JOIN projects p ON p.id = t.project_id WHERE p.team_id = ? AND t.status = 'In Progress') AS in_progress,
          (SELECT COUNT(*) FROM tasks t JOIN projects p ON p.id = t.project_id WHERE p.team_id = ? AND t.status = 'Done') AS done`,
        Array(6).fill(req.user.team_id)
      );
      res.json({ data: totals });
    } catch (error) { next(error); }
  });
  return router;
}

module.exports = createOverviewRouter;
