const { SESSION_COOKIE, hashToken, readCookie } = require('../auth');

function requireAuth(db) {
  return async (req, res, next) => {
    const token = readCookie(req, SESSION_COOKIE);
    if (!token) return res.status(401).json({ error: { message: 'Please log in to continue.' } });
    try {
      const [rows] = await db.execute(
        `SELECT u.id AS user_id, u.name, u.email, tm.team_id, t.name AS team_name, t.invite_code
         FROM auth_sessions s
         JOIN users u ON u.id = s.user_id
         JOIN team_memberships tm ON tm.user_id = u.id
         JOIN teams t ON t.id = tm.team_id
         WHERE s.token_hash = ? AND s.expires_at > UTC_TIMESTAMP()`,
        [hashToken(token)]
      );
      if (!rows.length) return res.status(401).json({ error: { message: 'Your session has expired. Please log in again.' } });
      req.user = rows[0];
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = requireAuth;
