// db.js - PostgreSQL Connection Pool Configuration
// Optimized for Cloud-Hosted Supabase / PostgreSQL instances
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

// Secure TLS SSL configuration with strict validation option
const sslConfig = process.env.DB_SSL === 'false' 
    ? false 
    : {
        rejectUnauthorized: process.env.DB_REJECT_UNAUTHORIZED === 'true'
      };

// PostgreSQL Connection Pool options adhering to enterprise connection limits
const poolConfig = process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        max: parseInt(process.env.DB_POOL_MAX || '20', 10),
        idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
        connectionTimeoutMillis: parseInt(process.env.DB_CONN_TIMEOUT || '2000', 10),
        ssl: sslConfig
      }
    : {
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        port: parseInt(process.env.DB_PORT || '5432', 10),
        max: parseInt(process.env.DB_POOL_MAX || '20', 10),
        idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
        connectionTimeoutMillis: parseInt(process.env.DB_CONN_TIMEOUT || '2000', 10),
        ssl: sslConfig
      };

const pool = new Pool(poolConfig);

// Helper query function for safe parameterized execution
const query = (text, params) => pool.query(text, params);

module.exports = {
    pool,
    query
};
