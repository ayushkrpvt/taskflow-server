const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');

function signAccess(user) {
  return jwt.sign(
    { id: user.id, role: user.role, department_id: user.department_id, name: user.name, email: user.email },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' }
  );
}

function signRefresh(user) {
  return jwt.sign(
    { id: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d' }
  );
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const [rows] = await db.query('SELECT * FROM users WHERE email = ? AND is_active = true', [email]);
    const user = rows[0];
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });

    await db.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);

    const accessToken  = signAccess(user);
    const refreshToken = signRefresh(user);
    const tokenHash    = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt    = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
      [user.id, tokenHash, expiresAt]
    );

    res.json({
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, department_id: user.department_id },
    });
  } catch (err) { next(err); }
}

async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ message: 'No refresh token' });

    let payload;
    try {
      payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const [rows] = await db.query(
      'SELECT * FROM refresh_tokens WHERE token_hash = ? AND revoked = false AND expires_at > NOW()',
      [tokenHash]
    );
    if (!rows[0]) return res.status(401).json({ message: 'Refresh token revoked or expired' });

    const [users] = await db.query('SELECT * FROM users WHERE id = ? AND is_active = true', [payload.id]);
    const user = users[0];
    if (!user) return res.status(401).json({ message: 'User not found' });

    res.json({ accessToken: signAccess(user) });
  } catch (err) { next(err); }
}

async function logout(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      await db.query('UPDATE refresh_tokens SET revoked = true WHERE token_hash = ?', [tokenHash]);
    }
    res.json({ message: 'Logged out' });
  } catch (err) { next(err); }
}

async function me(req, res, next) {
  try {
    const [rows] = await db.query(
      'SELECT id, name, email, role, department_id, is_active, last_login_at, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'User not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
}

module.exports = { login, refresh, logout, me };
