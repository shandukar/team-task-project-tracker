const express = require('express');
const { validateRegistration, validateLogin } = require('../validation');
const {
  hashPassword,
  verifyPassword,
  newInviteCode,
  createSession,
  setSessionCookie,
  clearSessionCookie,
  readCookie,
  SESSION_COOKIE,
  hashToken
} = require('../auth');
const requireAuth = require('../middleware/require-auth');

function createAuthRouter(db) {
  const router = express.Router();

  router.post('/register', async (req, res, next) => {
    let connection;
    let transactionStarted = false;
    try {
      const registration = validateRegistration(req.body);
      const passwordHash = await hashPassword(registration.password);
      connection = await db.getConnection();
      await connection.beginTransaction();
      transactionStarted = true;
      let teamId;
      let role = 'member';
      let inviteCode;
      if (registration.mode === 'create') {
        inviteCode = newInviteCode();
        const [teamResult] = await connection.execute(
          'INSERT INTO teams (name, invite_code) VALUES (?, ?)',
          [registration.teamName, inviteCode]
        );
        teamId = teamResult.insertId;
        role = 'owner';
      } else {
        const [teams] = await connection.execute(
          'SELECT id FROM teams WHERE invite_code = ?',
          [registration.inviteCode]
        );
        if (!teams.length) {
          await connection.rollback();
          return res.status(400).json({ error: { message: 'That invite code is not valid.' } });
        }
        teamId = teams[0].id;
      }
      const [userResult] = await connection.execute(
        'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
        [registration.name, registration.email, passwordHash]
      );
      await connection.execute(
        'INSERT INTO team_memberships (user_id, team_id, membership_role) VALUES (?, ?, ?)',
        [userResult.insertId, teamId, role]
      );
      const sessionToken = await createSession(connection, userResult.insertId);
      await connection.commit();
      transactionStarted = false;
      setSessionCookie(res, sessionToken);
      return res.status(201).json({ data: { id: userResult.insertId, name: registration.name, email: registration.email } });
    } catch (error) {
      if (connection && transactionStarted) await connection.rollback();
      return next(error);
    } finally {
      if (connection) connection.release();
    }
  });

  router.post('/login', async (req, res, next) => {
    try {
      const credentials = validateLogin(req.body);
      const [rows] = await db.execute(
        `SELECT u.id, u.name, u.email, u.password_hash
         FROM users u WHERE u.email = ?`,
        [credentials.email]
      );
      if (!rows.length || !(await verifyPassword(credentials.password, rows[0].password_hash))) {
        return res.status(401).json({ error: { message: 'Email or password is incorrect.' } });
      }
      await createSession(db, rows[0].id, res);
      return res.json({ data: { id: rows[0].id, name: rows[0].name, email: rows[0].email } });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/me', requireAuth(db), async (req, res, next) => {
    try {
      const [rows] = await db.execute(
        `SELECT u.id, u.name, u.email, t.name AS team_name, t.invite_code
         FROM users u
         JOIN team_memberships tm ON tm.user_id = u.id
         JOIN teams t ON t.id = tm.team_id
         WHERE u.id = ?`,
        [req.user.user_id]
      );
      if (!rows.length) return res.status(404).json({ error: { message: 'Account workspace not found.' } });
      return res.json({ data: rows[0] });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/logout', async (req, res, next) => {
    try {
      const token = readCookie(req, SESSION_COOKIE);
      if (token) {
        await db.execute('DELETE FROM auth_sessions WHERE token_hash = ?', [hashToken(token)]);
      }
      clearSessionCookie(res);
      return res.json({ data: { message: 'Logged out.' } });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = createAuthRouter;
