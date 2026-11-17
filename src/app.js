const express = require('express');
const path = require('path');
const pool = require('./db');
const createProjectsRouter = require('./routes/projects');
const createMembersRouter = require('./routes/members');
const createTasksRouter = require('./routes/tasks');
const createOverviewRouter = require('./routes/overview');
const createAuthRouter = require('./routes/auth');
const requireAuth = require('./middleware/require-auth');
const { notFound, errorHandler } = require('./middleware/errors');

function createApp(db = pool) {
  const app = express();
  app.use(express.json({ limit: '100kb' }));
  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.get('/api/health', (req, res) => res.json({ data: { status: 'ok' } }));
  app.use('/api/auth', createAuthRouter(db));
  app.use('/api', requireAuth(db));
  app.use('/api/projects', createProjectsRouter(db));
  app.use('/api/members', createMembersRouter(db));
  app.use('/api/tasks', createTasksRouter(db));
  app.use('/api/overview', createOverviewRouter(db));
  app.use('/api', notFound);
  app.use(errorHandler);
  return app;
}

module.exports = createApp;
