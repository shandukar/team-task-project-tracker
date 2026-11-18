const { ValidationError } = require('../validation');

function notFound(req, res) {
  res.status(404).json({ error: { message: 'Route not found.' } });
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { message: 'Request body must contain valid JSON.' } });
  }
  if (error instanceof ValidationError) {
    return res.status(error.status).json({ error: { message: error.message } });
  }
  if (error.status === 404) {
    return res.status(404).json({ error: { message: error.message } });
  }
  if (error.code === 'ER_NO_REFERENCED_ROW_2' || error.code === '23503') {
    return res.status(400).json({ error: { message: 'The selected project or assignee does not exist.' } });
  }
  if (error.code === 'ER_DUP_ENTRY' || error.code === '23505') {
    return res.status(409).json({ error: { message: 'A record with that email already exists.' } });
  }
  console.error(error);
  return res.status(500).json({ error: { message: 'An unexpected server error occurred.' } });
}

module.exports = { notFound, errorHandler };
