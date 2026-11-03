// db.js - PostgreSQL Connection Pool Configuration
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

// Support both DATABASE_URL (recommended for Supabase) and individual config fields
const poolConfig = process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      }
    : {
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        port: parseInt(process.env.DB_PORT || '5432', 10),
        ssl: { rejectUnauthorized: false }
      };

const pool = new Pool(poolConfig);

// Helper query function for safe parameterized execution
const query = (text, params) => pool.query(text, params);

module.exports = {
    pool,
    query
};
