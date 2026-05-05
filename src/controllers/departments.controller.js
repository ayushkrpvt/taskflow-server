const db = require('../db');

async function list(_req, res, next) {
  try {
    const [rows] = await db.query('SELECT * FROM departments ORDER BY name');
    res.json(rows);
  } catch (err) { next(err); }
}

async function get(req, res, next) {
  try {
    const [rows] = await db.query('SELECT * FROM departments WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ message: 'Department not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { name, description } = req.body;
    const [rows] = await db.query(
      'INSERT INTO departments (name, description) VALUES (?, ?) RETURNING id',
      [name, description]
    );
    res.status(201).json({ id: rows[0].id, name, description });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const { name, description, is_active } = req.body;
    await db.query(
      'UPDATE departments SET name=?, description=?, is_active=? WHERE id=?',
      [name, description, is_active ?? true, req.params.id]
    );
    res.json({ message: 'Department updated' });
  } catch (err) { next(err); }
}

module.exports = { list, get, create, update };
