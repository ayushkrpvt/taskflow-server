const db = require('../db');

async function list(req, res, next) {
  try {
    // Return flat list with parent name for display
    const { parent_id, type } = req.query;
    let sql = `SELECT t.id, t.name, t.type, t.parent_id, p.name AS parent_name, t.created_at
               FROM territories t LEFT JOIN territories p ON p.id = t.parent_id WHERE 1=1`;
    const params = [];
    if (parent_id !== undefined) { sql += ' AND t.parent_id = ?'; params.push(parent_id === 'null' ? null : parseInt(parent_id)); }
    if (type) { sql += ' AND t.type = ?'; params.push(type); }
    sql += ' ORDER BY t.name';
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { name, type, parent_id } = req.body;
    const [rows] = await db.query(
      'INSERT INTO territories (name, type, parent_id) VALUES (?, ?, ?) RETURNING id',
      [name, type, parent_id || null]
    );
    res.status(201).json({ id: rows[0].id, name, type, parent_id: parent_id || null });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const { name } = req.body;
    await db.query('UPDATE territories SET name=? WHERE id=?', [name, req.params.id]);
    res.json({ message: 'Territory updated' });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    await db.query('DELETE FROM territories WHERE id=?', [req.params.id]);
    res.json({ message: 'Territory deleted' });
  } catch (err) { next(err); }
}

async function getUserTerritories(req, res, next) {
  try {
    const [rows] = await db.query(
      `SELECT t.id, t.name, t.type, t.parent_id, p.name AS parent_name
       FROM territories t
       JOIN employee_territories et ON et.territory_id = t.id
       LEFT JOIN territories p ON p.id = t.parent_id
       WHERE et.user_id = ?
       ORDER BY t.type, t.name`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

async function setUserTerritories(req, res, next) {
  try {
    const { territory_ids } = req.body; // array of ints
    const userId = req.params.id;
    const conn = await db.getConnection();
    await conn.beginTransaction();
    try {
      await conn.query('DELETE FROM employee_territories WHERE user_id = ?', [userId]);
      if (territory_ids && territory_ids.length > 0) {
        for (const tid of territory_ids) {
          await conn.query(
            'INSERT INTO employee_territories (user_id, territory_id) VALUES (?, ?) ON CONFLICT DO NOTHING',
            [userId, tid]
          );
        }
      }
      await conn.commit();
      res.json({ message: 'Territories updated' });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) { next(err); }
}

module.exports = { list, create, update, remove, getUserTerritories, setUserTerritories };
