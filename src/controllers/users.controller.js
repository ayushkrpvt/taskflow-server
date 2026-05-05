const bcrypt = require('bcrypt');
const db = require('../db');

async function list(req, res, next) {
  try {
    const { role, department_id, is_active } = req.query;
    let sql = `SELECT u.id, u.name, u.email, u.role, u.department_id, d.name AS department_name,
                      u.is_active, u.last_login_at, u.created_at
               FROM users u LEFT JOIN departments d ON d.id = u.department_id WHERE 1=1`;
    const params = [];
    if (role)          { sql += ' AND u.role = ?';          params.push(role); }
    if (department_id) { sql += ' AND u.department_id = ?'; params.push(department_id); }
    if (is_active !== undefined) { sql += ' AND u.is_active = ?'; params.push(is_active === 'true'); }
    sql += ' ORDER BY u.name';
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) { next(err); }
}

async function get(req, res, next) {
  try {
    const [rows] = await db.query(
      `SELECT u.id, u.name, u.email, u.role, u.department_id, d.name AS department_name,
              u.is_active, u.last_login_at, u.created_at
       FROM users u LEFT JOIN departments d ON d.id = u.department_id WHERE u.id = ?`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'User not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { name, email, password, role, department_id } = req.body;
    const hash = await bcrypt.hash(password, 12);
    const [rows] = await db.query(
      'INSERT INTO users (name, email, password_hash, role, department_id, created_by) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
      [name, email, hash, role, department_id || null, req.user.id]
    );
    res.status(201).json({ id: rows[0].id, name, email, role, department_id });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: 'Email already exists' });
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { name, email, role, department_id, is_active } = req.body;
    await db.query(
      'UPDATE users SET name=?, email=?, role=?, department_id=?, is_active=? WHERE id=?',
      [name, email, role, department_id || null, is_active ?? true, req.params.id]
    );
    res.json({ message: 'User updated' });
  } catch (err) { next(err); }
}

async function changePassword(req, res, next) {
  try {
    const hash = await bcrypt.hash(req.body.password, 12);
    await db.query('UPDATE users SET password_hash=? WHERE id=?', [hash, req.params.id]);
    res.json({ message: 'Password updated' });
  } catch (err) { next(err); }
}

module.exports = { list, get, create, update, changePassword };
