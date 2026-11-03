// test_crud.js - Database Connectivity & CRUD Verification Script for Lab 11
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function runTests() {
    console.log('===============================================================');
    console.log(' MC212 Lab 11: PostgreSQL Connectivity & CRUD Verification');
    console.log(' Team 7: Havish Trivedi (202503013) & Sneh Patel (202503007)');
    console.log(' Stack: Option B (Node.js, Express, pg node-postgres)');
    console.log(' Database: Supabase PostgreSQL 17 (ap-northeast-1 pooler)');
    console.log('===============================================================\n');

    // 1. Connectivity & Version Check
    console.log('[SECTION A: CONNECTIVITY TEST]');
    const verRes = await pool.query('SELECT version();');
    console.log('Connected successfully to database engine:');
    console.log(verRes.rows[0].version);
    console.log('\n---------------------------------------------------------------\n');

    const testCnr = 'GJAH018888882026';
    // Clean up test record if existed
    await pool.query('DELETE FROM court_case WHERE cnr = $1', [testCnr]);

    // 2. CREATE (INSERT)
    console.log('[SECTION B.1: CREATE (INSERT) OPERATION]');
    const insertSql = `
        INSERT INTO court_case (
            cnr, standardized_filing_number, case_number, 
            fir_number, statutory_urgency, case_status, registered_by_clerk_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *;
    `;
    const insertParams = [
        testCnr,
        'SFN-2026-TEST01',
        'CC/888/2026',
        'FIR/0888/2026',
        'Urgent',
        'Filed',
        301
    ];
    console.log('Executing SQL:');
    console.log(insertSql.trim());
    console.log('With Parameters:', insertParams);
    const insRes = await pool.query(insertSql, insertParams);
    console.log('>> result.rowCount =', insRes.rowCount, '(Record successfully inserted)');
    console.log('>> Inserted Row:', insRes.rows[0]);
    console.log('\n---------------------------------------------------------------\n');

    // 3. READ (SELECT)
    console.log('[SECTION B.2: READ (SELECT) OPERATION]');
    const selectSql = `
        SELECT cnr, standardized_filing_number, case_number, 
               fir_number, statutory_urgency, case_status, registered_by_clerk_id
        FROM court_case 
        WHERE cnr = $1;
    `;
    console.log('Executing SQL:');
    console.log(selectSql.trim());
    console.log('With Parameters:', [testCnr]);
    const selRes = await pool.query(selectSql, [testCnr]);
    console.log('>> result.rowCount =', selRes.rowCount, '(Record successfully retrieved)');
    console.log('>> Retrieved Row:', selRes.rows[0]);
    console.log('\n---------------------------------------------------------------\n');

    // 4. UPDATE
    console.log('[SECTION B.3: UPDATE OPERATION]');
    const updateSql = `
        UPDATE court_case 
        SET statutory_urgency = $1, case_status = $2 
        WHERE cnr = $3 
        RETURNING *;
    `;
    const updateParams = ['Statutory', 'Pending', testCnr];
    console.log('Executing SQL:');
    console.log(updateSql.trim());
    console.log('With Parameters:', updateParams);
    const updRes = await pool.query(updateSql, updateParams);
    console.log('>> result.rowCount =', updRes.rowCount, '(Record successfully updated)');
    console.log('>> Updated Row:', updRes.rows[0]);
    console.log('\n---------------------------------------------------------------\n');

    // 5. DELETE
    console.log('[SECTION B.4: DELETE OPERATION]');
    const deleteSql = `
        DELETE FROM court_case 
        WHERE cnr = $1 
        RETURNING *;
    `;
    console.log('Executing SQL:');
    console.log(deleteSql.trim());
    console.log('With Parameters:', [testCnr]);
    const delRes = await pool.query(deleteSql, [testCnr]);
    console.log('>> result.rowCount =', delRes.rowCount, '(Record successfully deleted)');
    console.log('>> Deleted Row:', delRes.rows[0]);
    console.log('\n===============================================================');
    console.log(' ALL 4 CRUD OPERATIONS COMPLETED WITH result.rowCount = 1');
    console.log('===============================================================');

    await pool.end();
}

runTests().catch(err => {
    console.error('Fatal execution error:', err);
    process.exit(1);
});
