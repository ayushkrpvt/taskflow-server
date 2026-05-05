const db = require('../db');

async function list(req, res, next) {
  try {
    const { role, id: userId, department_id } = req.user;
    const { project_id, status, department_id: deptFilter, assigned_to } = req.query;

    let sql = `SELECT t.*, p.name AS project_name, d.name AS department_name,
                      u.name AS assigned_to_name, ab.name AS assigned_by_name
               FROM tasks t
               JOIN projects p  ON p.id = t.project_id
               LEFT JOIN departments d  ON d.id = t.department_id
               LEFT JOIN users u        ON u.id = t.assigned_to
               LEFT JOIN users ab       ON ab.id = t.assigned_by
               WHERE t.parent_task_id IS NULL`;
    const p = [];

    if (role === 'employee') { sql += ' AND t.assigned_to = ?'; p.push(userId); }
    else if (role === 'hod') { sql += ' AND t.department_id = ?'; p.push(department_id); }

    if (project_id) { sql += ' AND t.project_id = ?'; p.push(project_id); }
    if (status)     { sql += ' AND t.status = ?';     p.push(status); }
    if (deptFilter && !['employee','hod'].includes(role)) { sql += ' AND t.department_id = ?'; p.push(deptFilter); }
    if (assigned_to && role !== 'employee') { sql += ' AND t.assigned_to = ?'; p.push(assigned_to); }

    sql += ' ORDER BY t.due_date ASC NULLS LAST, t.priority DESC';
    const [rows] = await db.query(sql, p);
    res.json(rows);
  } catch (err) { next(err); }
}

async function get(req, res, next) {
  try {
    const [tasks] = await db.query(
      `SELECT t.*, p.name AS project_name, d.name AS department_name,
              u.name AS assigned_to_name, ab.name AS assigned_by_name, rv.name AS reviewed_by_name
       FROM tasks t
       JOIN projects p        ON p.id  = t.project_id
       LEFT JOIN departments d ON d.id  = t.department_id
       LEFT JOIN users u       ON u.id  = t.assigned_to
       LEFT JOIN users ab      ON ab.id = t.assigned_by
       LEFT JOIN users rv      ON rv.id = t.reviewed_by
       WHERE t.id = ?`,
      [req.params.id]
    );
    if (!tasks[0]) return res.status(404).json({ message: 'Task not found' });

    const [history] = await db.query(
      `SELECT tsh.*, u.name AS changed_by_name FROM task_status_history tsh
       JOIN users u ON u.id = tsh.changed_by WHERE tsh.task_id = ? ORDER BY tsh.created_at`,
      [req.params.id]
    );

    const internalFilter = req.user.role === 'employee' ? 'AND tc.is_internal = false' : '';
    const [comments] = await db.query(
      `SELECT tc.*, u.name AS user_name, u.role FROM task_comments tc
       JOIN users u ON u.id = tc.user_id WHERE tc.task_id = ? ${internalFilter} ORDER BY tc.created_at`,
      [req.params.id]
    );

    const [attachments] = await db.query(
      'SELECT * FROM task_attachments WHERE task_id = ? ORDER BY created_at',
      [req.params.id]
    );

    // Fetch subtasks with joined names
    const [subtasks] = await db.query(
      `SELECT t.*, d.name AS department_name, u.name AS assigned_to_name
       FROM tasks t
       LEFT JOIN departments d ON d.id = t.department_id
       LEFT JOIN users u       ON u.id = t.assigned_to
       WHERE t.parent_task_id = ?
       ORDER BY t.created_at ASC`,
      [req.params.id]
    );

    res.json({ ...tasks[0], history, comments, attachments, subtasks });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { project_id, title, description, department_id, tat_type, tat_days,
            due_date, priority, depends_on, parent_task_id } = req.body;
    const { role, id: userId, department_id: userDeptId } = req.user;

    if (role === 'hod' && Number(department_id) !== Number(userDeptId)) {
      return res.status(403).json({ message: 'HOD can only create tasks for their own department' });
    }

    // Validate no nesting: parent must not itself be a subtask
    if (parent_task_id) {
      const [parents] = await db.query('SELECT parent_task_id FROM tasks WHERE id = ?', [parent_task_id]);
      if (!parents[0]) return res.status(404).json({ message: 'Parent task not found' });
      if (parents[0].parent_task_id) return res.status(400).json({ message: 'Cannot create a subtask of a subtask' });
    }

    const [rows] = await db.query(
      `INSERT INTO tasks (project_id, title, description, department_id, status, tat_type, tat_days,
                          due_date, priority, depends_on, parent_task_id, is_from_template, created_by)
       VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, false, ?) RETURNING id`,
      [project_id, title, description, department_id || null, tat_type || 'days',
       tat_days || null, due_date || null, priority || 'medium',
       depends_on || null, parent_task_id || null, userId]
    );
    const taskId = rows[0].id;
    await db.query(
      'INSERT INTO task_status_history (task_id, changed_by, old_status, new_status) VALUES (?, ?, NULL, ?)',
      [taskId, userId, 'pending']
    );
    res.status(201).json({ id: taskId, title });
  } catch (err) { next(err); }
}

async function assign(req, res, next) {
  try {
    const { assigned_to, tat_type, tat_days, due_date } = req.body;
    const taskId = req.params.id;
    const { role, id: userId, department_id: userDeptId } = req.user;

    const [tasks] = await db.query('SELECT * FROM tasks WHERE id = ?', [taskId]);
    const task = tasks[0];
    if (!task) return res.status(404).json({ message: 'Task not found' });
    if (role === 'hod' && Number(task.department_id) !== Number(userDeptId)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    if (task.depends_on) {
      const [blockers] = await db.query('SELECT status FROM tasks WHERE id = ?', [task.depends_on]);
      if (blockers[0] && blockers[0].status !== 'completed') {
        return res.status(409).json({ message: 'Blocking task is not yet completed' });
      }
    }

    const effectiveTatType = tat_type || task.tat_type;
    const effectiveTatDays = tat_days || task.tat_days;
    let computedDueDate = due_date || null;
    if (effectiveTatType === 'days' && effectiveTatDays) {
      const d = new Date();
      d.setDate(d.getDate() + Number(effectiveTatDays));
      computedDueDate = d.toISOString().slice(0, 10);
    }

    const oldStatus = task.status;
    await db.query(
      `UPDATE tasks SET assigned_to=?, assigned_by=?, assigned_at=NOW(),
                       status='assigned', tat_type=?, tat_days=?, due_date=? WHERE id=?`,
      [assigned_to, userId, effectiveTatType, effectiveTatDays, computedDueDate, taskId]
    );
    await db.query(
      'INSERT INTO task_status_history (task_id, changed_by, old_status, new_status) VALUES (?, ?, ?, ?)',
      [taskId, userId, oldStatus, 'assigned']
    );
    res.json({ message: 'Task assigned' });
  } catch (err) { next(err); }
}

async function updateStatus(req, res, next) {
  try {
    const { status, note } = req.body;
    const taskId = req.params.id;
    const { role, id: userId } = req.user;

    const [tasks] = await db.query('SELECT * FROM tasks WHERE id = ?', [taskId]);
    const task = tasks[0];
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const allowed = getAllowedTransitions(task.status, role);
    if (!allowed.includes(status)) {
      return res.status(409).json({ message: `Cannot transition from ${task.status} to ${status}` });
    }

    // Block parent task submission if any subtask is not completed
    if (!task.parent_task_id && ['submitted', 'completed'].includes(status)) {
      const [subtasks] = await db.query(
        'SELECT id, status FROM tasks WHERE parent_task_id = ?', [taskId]
      );
      const incomplete = subtasks.filter(s => s.status !== 'completed' && s.status !== 'cancelled');
      if (incomplete.length > 0) {
        return res.status(409).json({
          message: `${incomplete.length} subtask(s) are not yet completed. Complete all subtasks first.`
        });
      }
    }

    let updateSql = 'UPDATE tasks SET status=?';
    const updateParams = [status];
    if (status === 'submitted') updateSql += ', submitted_at=NOW()';
    if (status === 'completed') { updateSql += ', completed_at=NOW(), reviewed_by=?'; updateParams.push(userId); }
    updateSql += ' WHERE id=?';
    updateParams.push(taskId);

    await db.query(updateSql, updateParams);
    await db.query(
      'INSERT INTO task_status_history (task_id, changed_by, old_status, new_status, note) VALUES (?, ?, ?, ?, ?)',
      [taskId, userId, task.status, status, note || null]
    );
    res.json({ message: 'Status updated' });
  } catch (err) { next(err); }
}

function getAllowedTransitions(currentStatus, role) {
  const transitions = {
    pending:        { super_admin: ['assigned','cancelled'], admin: ['assigned','cancelled'], hod: ['assigned','cancelled'], employee: [] },
    assigned:       { super_admin: ['in_progress','pending','cancelled'], admin: ['in_progress','pending','cancelled'], hod: ['in_progress','pending','cancelled'], employee: ['in_progress'] },
    in_progress:    { super_admin: ['submitted','cancelled'], admin: ['submitted','cancelled'], hod: ['submitted','cancelled'], employee: ['submitted'] },
    submitted:      { super_admin: ['completed','needs_revision'], admin: ['completed','needs_revision'], hod: ['completed','needs_revision'], employee: [] },
    needs_revision: { super_admin: ['in_progress','cancelled'], admin: ['in_progress','cancelled'], hod: ['in_progress','cancelled'], employee: ['in_progress'] },
    completed:      { super_admin: [], admin: [], hod: [], employee: [] },
    cancelled:      { super_admin: ['pending'], admin: ['pending'], hod: [], employee: [] },
  };
  return (transitions[currentStatus] || {})[role] || [];
}

async function update(req, res, next) {
  try {
    const { title, description, priority, due_date, tat_type, tat_days } = req.body;
    await db.query(
      'UPDATE tasks SET title=?, description=?, priority=?, due_date=?, tat_type=?, tat_days=? WHERE id=?',
      [title, description, priority, due_date || null, tat_type, tat_days || null, req.params.id]
    );
    res.json({ message: 'Task updated' });
  } catch (err) { next(err); }
}

module.exports = { list, get, create, assign, updateStatus, update };
