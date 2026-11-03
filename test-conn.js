// test-conn.js - Connection verification and PostgreSQL version check
// Required for Lab 11 - Section (A)
const { pool } = require('./db');

async function verifyDatabaseConnection() {
    console.log("=================================================");
    console.log(" MC212 Lab 11: Database Connectivity Verification");
    console.log(" Team 7 - Judiciary Case Management System");
    console.log("=================================================");
    console.log("Attempting connection to PostgreSQL on Supabase...");

    try {
        const startTime = Date.now();
        const result = await pool.query('SELECT version();');
        const latency = Date.now() - startTime;

        console.log("\n Connection Status: SUCCESS");
        console.log(` Roundtrip Latency: ${latency} ms`);
        console.log(` Rows Returned (result.rowCount): ${result.rowCount}`);
        console.log("\nPostgreSQL Engine Version:");
        console.log("-------------------------------------------------");
        console.log(result.rows[0].version);
        console.log("-------------------------------------------------");
        console.log("\n Connectivity verified! Ready for CRUD operations.\n");
        process.exit(0);
    } catch (err) {
        console.error("\n❌ Connection Status: FAILED");
        console.error("Error Details:", err.message);
        console.error("\nTroubleshooting tips:");
        console.error("1. Check whether DB_PASS in .env is correct.");
        console.error("2. If using Supabase, ensure port 6543 (transaction pooler) or 5432 (session) is reachable.");
        process.exit(1);
    }
}

verifyDatabaseConnection();
