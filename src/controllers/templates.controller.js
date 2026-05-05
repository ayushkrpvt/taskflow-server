const db = require('../db');

async function list(_req, res, next) {
  try {
    const [rows] = await db.query(
      `SELECT t.*, u.name AS created_by_name,
              COUNT(tt.id) AS task_count
       FROM templates t
       JOIN users u ON u.id = t.created_by
       LEFT JOIN template_tasks tt ON tt.template_id = t.id AND tt.is_active = true
       WHERE t.is_active = true
       GROUP BY t.id, u.name ORDER BY t.name`
    );
    res.json(rows);
  } catch (err) { next(err); }
}

async function get(req, res, next) {
  try {
    const [templates] = await db.query(
      'SELECT t.*, u.name AS created_by_name FROM templates t JOIN users u ON u.id = t.created_by WHERE t.id = ?',
      [req.params.id]
    );
    if (!templates[0]) return res.status(404).json({ message: 'Template not found' });
    const [tasks] = await db.query(
      `SELECT tt.*, d.name AS department_name
       FROM template_tasks tt LEFT JOIN departments d ON d.id = tt.department_id
       WHERE tt.template_id = ? AND tt.is_active = true ORDER BY tt.step_order`,
      [req.params.id]
    );
    res.json({ ...templates[0], tasks });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { name, description, tasks } = req.body;
    const conn = await db.getConnection();
    await conn.beginTransaction();
    try {
      const [tRows] = await conn.query(
        'INSERT INTO templates (name, description, created_by) VALUES (?, ?, ?) RETURNING id',
        [name, description, req.user.id]
      );
      const templateId = tRows[0].id;
      if (tasks && tasks.length > 0) {
        for (const t of tasks) {
          await conn.query(
            'INSERT INTO template_tasks (template_id, title, description, department_id, step_order, tat_days) VALUES (?, ?, ?, ?, ?, ?)',
            [templateId, t.title, t.description, t.department_id, t.step_order, t.tat_days || 1]
          );
        }
      }
      await conn.commit();
      res.status(201).json({ id: templateId, name });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const { name, description, tasks } = req.body;
    const templateId = req.params.id;
    const conn = await db.getConnection();
    await conn.beginTransaction();
    try {
      await conn.query(
        'UPDATE templates SET name=?, description=? WHERE id=?',
        [name, description, templateId]
      );
      // Replace all tasks: delete existing, re-insert
      await conn.query('DELETE FROM template_tasks WHERE template_id=?', [templateId]);
      if (tasks && tasks.length > 0) {
        for (const t of tasks) {
          await conn.query(
            'INSERT INTO template_tasks (template_id, title, description, department_id, step_order, tat_days) VALUES (?, ?, ?, ?, ?, ?)',
            [templateId, t.title, t.description || null, t.department_id || null, t.step_order, t.tat_days || 1]
          );
        }
      }
      await conn.commit();
      res.json({ message: 'Template updated' });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) { next(err); }
}

module.exports = { list, get, create, update };
