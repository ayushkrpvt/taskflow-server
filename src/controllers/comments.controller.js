const db = require('../db');

async function create(req, res, next) {
  try {
    const { task_id, comment, is_internal } = req.body;
    const { role, id: userId } = req.user;
    const internal = role === 'employee' ? false : (is_internal ?? false);

    const [rows] = await db.query(
      'INSERT INTO task_comments (task_id, user_id, comment, is_internal) VALUES (?, ?, ?, ?) RETURNING id',
      [task_id, userId, comment, internal]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const { role, id: userId } = req.user;
    const [rows] = await db.query('SELECT * FROM task_comments WHERE id = ?', [req.params.id]);
    const comment = rows[0];
    if (!comment) return res.status(404).json({ message: 'Comment not found' });
    if (comment.user_id !== userId && role !== 'super_admin') {
      return res.status(403).json({ message: 'Forbidden' });
    }
    await db.query('DELETE FROM task_comments WHERE id = ?', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
}

module.exports = { create, remove };
