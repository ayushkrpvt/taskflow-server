const db = require('../db');

async function list(_req, res, next) {
  try {
    const [rows] = await db.query(
      `SELECT v.*, p2.territory_id, t.name AS territory_name
       FROM v_project_summary v
       JOIN projects p2 ON p2.id = v.project_id
       LEFT JOIN territories t ON t.id = p2.territory_id
       ORDER BY v.project_id DESC`
    );
    res.json(rows);
  } catch (err) { next(err); }
}

async function get(req, res, next) {
  try {
    const [rows] = await db.query(
      `SELECT v.*, p2.territory_id, t.name AS territory_name
       FROM v_project_summary v
       JOIN projects p2 ON p2.id = v.project_id
       LEFT JOIN territories t ON t.id = p2.territory_id
       WHERE v.project_id = ?`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Project not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { name, description, template_id, start_date, expected_end_date, territory_id } = req.body;
    const conn = await db.getConnection();
    await conn.beginTransaction();
    try {
      const [pRows] = await conn.query(
        'INSERT INTO projects (name, description, template_id, start_date, expected_end_date, territory_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id',
        [name, description, template_id || null, start_date || null, expected_end_date || null, territory_id || null, req.user.id]
      );
      const projectId = pRows[0].id;

      if (template_id) {
        const [templateTasks] = await conn.query(
          'SELECT * FROM template_tasks WHERE template_id = ? AND is_active = true ORDER BY step_order',
          [template_id]
        );
        // Map template_task.id → new task.id for wiring depends_on
        const idMap = {};
        for (const tt of templateTasks) {
          const [tRows] = await conn.query(
            `INSERT INTO tasks (project_id, title, description, department_id, status, tat_type, tat_days,
                               is_from_template, template_task_id, priority, territory_id, created_by)
             VALUES (?, ?, ?, ?, 'pending', 'days', ?, true, ?, 'medium', ?, ?) RETURNING id`,
            [projectId, tt.title, tt.description, tt.department_id, tt.tat_days, tt.id, territory_id || null, req.user.id]
          );
          idMap[tt.id] = tRows[0].id;
        }
        for (const tt of templateTasks) {
          if (tt.depends_on && idMap[tt.depends_on]) {
            await conn.query(
              'UPDATE tasks SET depends_on = ? WHERE id = ?',
              [idMap[tt.depends_on], idMap[tt.id]]
            );
          }
        }
      }

      await conn.commit();
      res.status(201).json({ id: projectId, name });
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
    const { name, description, status, start_date, expected_end_date, territory_id } = req.body;
    await db.query(
      'UPDATE projects SET name=?, description=?, status=?, start_date=?, expected_end_date=?, territory_id=? WHERE id=?',
      [name, description, status, start_date || null, expected_end_date || null, territory_id || null, req.params.id]
    );
    res.json({ message: 'Project updated' });
  } catch (err) { next(err); }
}

module.exports = { list, get, create, update };
