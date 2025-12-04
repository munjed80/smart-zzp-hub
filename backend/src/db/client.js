import pkg from 'pg';
const { Pool } = pkg;

// Read DATABASE_URL from environment
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn(
    'WARNING: DATABASE_URL is not set. Database operations will fail until a valid connection string is provided.'
  );
}

// Create a connection pool
const pool = new Pool({
  connectionString,
  // Add SSL configuration for production environments
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * Execute a SQL query against the database
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise} - Query result
 */
export async function query(text, params) {
  return pool.query(text, params);
}

export { pool };
