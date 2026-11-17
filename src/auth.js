const crypto = require('node:crypto');
const { promisify } = require('node:util');

const scrypt = promisify(crypto.scrypt);
const SESSION_COOKIE = 'tt_session';
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

async function verifyPassword(password, encodedHash) {
  const [algorithm, saltHex, hashHex] = String(encodedHash).split('$');
  if (algorithm !== 'scrypt' || !/^[a-f0-9]{32}$/.test(saltHex) || !/^[a-f0-9]{128}$/.test(hashHex)) {
    return false;
  }
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

function newInviteCode() {
  return crypto.randomBytes(12).toString('hex').toUpperCase();
}

function cookieOptions() {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DURATION_MS / 1000}${secure}`;
}

function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; ${cookieOptions()}`);
}

function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
}

function readCookie(req, name) {
  const cookies = req.headers.cookie || '';
  const entry = cookies.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return entry ? entry.slice(name.length + 1) : null;
}

async function createSession(db, userId, res) {
  const token = crypto.randomBytes(32).toString('base64url');
  await db.execute(
    'INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 DAY))',
    [hashToken(token), userId]
  );
  if (res) setSessionCookie(res, token);
  return token;
}

module.exports = {
  SESSION_COOKIE,
  hashToken,
  hashPassword,
  verifyPassword,
  newInviteCode,
  readCookie,
  createSession,
  setSessionCookie,
  clearSessionCookie
};
