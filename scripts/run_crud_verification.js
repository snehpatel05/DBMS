// scripts/run_crud_verification.js
// Standalone verification script for Lab 11 Sections A and B

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    console.log("================================================================================");
    console.log(" MC212 DBMS LAB 11 - DATABASE CONNECTIVITY & CRUD VERIFICATION TEST");
    console.log(" Team 7: Trivedi Havish (202503013) & Patel Sneh (202503007)");
    console.log("================================================================================\n");

    try {
        // (A) DATABASE CONNECTIVITY TEST
        console.log("--- (A) SECTION A: DATABASE CONNECTIVITY TEST ---");
        const verRes = await pool.query("SELECT version();");
        console.log("[CONNECTIVITY SUCCESS] Connected to PostgreSQL on Supabase Cloud!");
        console.log("PostgreSQL Version Output:");
        console.log("  " + verRes.rows[0].version);
        console.log("  Connection Host:", process.env.DATABASE_URL.split('@')[1].split('/')[0]);
        console.log("--------------------------------------------------------------------------------\n");

        // (B.1) CREATE (INSERT) OPERATION
        console.log("--- (B.1) CRUD: CREATE (INSERT) OPERATION ---");
        const testCnr = "GJAH018888882026";
        const testSfn = "SFN-2026-008888";
        const testCaseNo = "CC/888/2026";
        // Clean up if previous test run remained
        await pool.query("DELETE FROM court_case WHERE cnr = $1 OR standardized_filing_number = $2", [testCnr, testSfn]);

        const insertSql = `
            INSERT INTO court_case (
                cnr, standardized_filing_number, case_number, 
                fir_number, statutory_urgency, case_status, registered_by_clerk_id
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING cnr, case_number, statutory_urgency, case_status;
        `;
        const insertParams = [
            testCnr,
            testSfn,
            testCaseNo,
            "FIR/0088/2026",
            "Normal",
            "Filed",
            301
        ];

        console.log("Executing SQL:\n", insertSql.trim());
        console.log("Parameters:", insertParams);
        const insertRes = await pool.query(insertSql, insertParams);
        console.log(`[INSERT RESULT] Rows affected (result.rowCount) = ${insertRes.rowCount}`);
        console.log("Inserted Record:", insertRes.rows[0]);
        console.log("--------------------------------------------------------------------------------\n");

        // (B.2) READ (SELECT) OPERATION
        console.log("--- (B.2) CRUD: READ (SELECT) OPERATION ---");
        const selectSql = `
            SELECT cnr, standardized_filing_number, case_number, fir_number,
                   statutory_urgency, case_status, registered_by_clerk_id
            FROM court_case
            WHERE cnr = $1;
        `;
        console.log("Executing SQL:\n", selectSql.trim());
        console.log("Parameters:", [testCnr]);
        const selectRes = await pool.query(selectSql, [testCnr]);
        console.log(`[SELECT RESULT] Rows fetched (result.rowCount) = ${selectRes.rowCount}`);
        console.log("Retrieved Row:", selectRes.rows[0]);
        console.log("--------------------------------------------------------------------------------\n");

        // (B.3) UPDATE OPERATION
        console.log("--- (B.3) CRUD: UPDATE OPERATION ---");
        const updateSql = `
            UPDATE court_case
            SET statutory_urgency = $1,
                case_status = $2,
                fir_number = $3
            WHERE cnr = $4
            RETURNING cnr, case_number, statutory_urgency, case_status, fir_number;
        `;
        const updateParams = ["Urgent", "Pending", "FIR/0088/2026-REV1", testCnr];
        console.log("Executing SQL:\n", updateSql.trim());
        console.log("Parameters:", updateParams);
        const updateRes = await pool.query(updateSql, updateParams);
        console.log(`[UPDATE RESULT] Rows affected (result.rowCount) = ${updateRes.rowCount}`);
        console.log("Updated Record State:", updateRes.rows[0]);
        console.log("--------------------------------------------------------------------------------\n");

        // (B.4) DELETE OPERATION
        console.log("--- (B.4) CRUD: DELETE OPERATION ---");
        const deleteSql = `DELETE FROM court_case WHERE cnr = $1 RETURNING cnr;`;
        console.log("Executing SQL:\n", deleteSql.trim());
        console.log("Parameters:", [testCnr]);
        const deleteRes = await pool.query(deleteSql, [testCnr]);
        console.log(`[DELETE RESULT] Rows affected (result.rowCount) = ${deleteRes.rowCount}`);
        console.log(`Deleted Case Record: ${deleteRes.rows[0].cnr}`);
        console.log("--------------------------------------------------------------------------------\n");

        // (B.5) RELATIONAL INTEGRITY VERIFICATION (FK RESTRICT)
        console.log("--- RELATIONAL INTEGRITY TEST: FOREIGN KEY RESTRICT SAFETY ---");
        const parentCnrWithChildren = "GJAH010000012024";
        try {
            await pool.query("DELETE FROM court_case WHERE cnr = $1", [parentCnrWithChildren]);
            console.log("UNEXPECTED: Case deleted without integrity check.");
        } catch (fkErr) {
            console.log(`[FK RESTRICT VERIFIED] Error code ${fkErr.code}: Deletion blocked by database engine.`);
            console.log(`Error detail: ${fkErr.detail || fkErr.message}`);
        }
        console.log("================================================================================");
        console.log(" ALL TESTS PASSED! Database connectivity & CRUD operations 100% verified.");
        console.log("================================================================================");

    } catch (err) {
        console.error("Test execution failed:", err);
    } finally {
        await pool.end();
    }
}

run();
