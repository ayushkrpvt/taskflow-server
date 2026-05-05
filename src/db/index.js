const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT || '5432'),
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

// Convert mysql2-style ? placeholders to PostgreSQL $1, $2, ...
function toPositional(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

// Returns [rows] like mysql2, so controllers need no changes for SELECT/DELETE/UPDATE.
// For INSERT use "RETURNING id" and access rows[0].id instead of result.insertId.
async function query(sql, params = []) {
  const { rows } = await pool.query(toPositional(sql), params);
  return [rows];
}

// Transaction helper — mirrors mysql2 connection interface
async function getConnection() {
  const client = await pool.connect();
  return {
    async query(sql, params = []) {
      const { rows } = await client.query(toPositional(sql), params);
      return [rows];
    },
    beginTransaction: () => client.query('BEGIN'),
    commit:           () => client.query('COMMIT'),
    rollback:         () => client.query('ROLLBACK'),
    release:          () => client.release(),
  };
}

module.exports = { query, getConnection };
