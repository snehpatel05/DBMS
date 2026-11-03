// server.js - Multi-Table Judiciary Management System
// Exposes REST APIs for court_case, hearings, orders, witnesses, and relational dossier
const express = require('express');
const cors = require('cors');
const path = require('path');
const { pool, query } = require('./db');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==============================================================
// 1. AUTHENTICATION & ROLE SWITCHING (RBAC)
// ==============================================================
app.post('/api/auth/login', async (req, res) => {
    const { identifier } = req.body;
    if (!identifier) {
        return res.status(400).json({ success: false, error: 'User ID or Email is required.' });
    }

    try {
        const isNum = !isNaN(identifier);
        const sql = isNum
            ? 'SELECT user_id, name, email, user_role FROM system_users WHERE user_id = $1;'
            : 'SELECT user_id, name, email, user_role FROM system_users WHERE email ILIKE $1;';
        const params = [isNum ? parseInt(identifier, 10) : identifier.trim()];

        const result = await query(sql, params);
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, error: 'User account not found.' });
        }

        const user = result.rows[0];
        console.log(`[RBAC AUTH] Active user session: ${user.name} (${user.user_role})`);
        res.json({ success: true, user });
    } catch (err) {
        console.error('[AUTH ERROR]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Admin endpoint: List system users
app.get('/api/users', async (req, res) => {
    const role = req.headers['x-user-role'];
    if (role !== 'Court Administrator') {
        return res.status(403).json({ success: false, error: 'Access denied. Administrator privileges required.' });
    }

    try {
        const sql = `
            SELECT u.user_id, u.name, u.email, u.user_role, u.created_by_admin_id,
                   a.bar_enrollment_no, ca.localization_setting
            FROM system_users u
            LEFT JOIN advocate a ON u.user_id = a.user_id
            LEFT JOIN court_administrator ca ON u.user_id = ca.user_id
            ORDER BY u.user_id ASC
            LIMIT 100;
        `;
        const result = await query(sql);
        res.json({ success: true, rowCount: result.rowCount, data: result.rows });
    } catch (err) {
        console.error('[USERS ERROR]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==============================================================
// 1. DASHBOARD & SYSTEM METRICS
// ==============================================================
app.get('/api/stats', async (req, res) => {
    try {
        const statsQuery = `
            SELECT 
                (SELECT COUNT(*) FROM court_case) AS total_cases,
                (SELECT COUNT(*) FROM court_case WHERE case_status = 'Pending') AS pending_cases,
                (SELECT COUNT(*) FROM court_case WHERE statutory_urgency = 'Urgent') AS urgent_cases,
                (SELECT COUNT(*) FROM court_case WHERE case_status = 'Disposed') AS disposed_cases,
                (SELECT COUNT(*) FROM hearing) AS total_hearings,
                (SELECT COUNT(*) FROM court_order) AS total_orders,
                (SELECT COUNT(*) FROM court_order WHERE published_date IS NOT NULL) AS published_orders,
                (SELECT COUNT(*) FROM witness) AS total_witnesses;
        `;
        const result = await query(statsQuery);
        res.json({ success: true, stats: result.rows[0] });
    } catch (err) {
        console.error('[STATS ERROR]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==============================================================
// 2. TABLE 1: COURT_CASE (R7) - FULL CRUD
// ==============================================================

// READ CASES (with role-based access filtering & search)
app.get('/api/cases', async (req, res) => {
    try {
        const { search, status, urgency, limit } = req.query;
        const userRole = req.headers['x-user-role'];
        const userId = req.headers['x-user-id'] ? parseInt(req.headers['x-user-id'], 10) : null;

        let conditions = [];
        let params = [];
        let joinClause = '';

        // RBAC Filter: Litigants only see cases they are involved in
        if (userRole === 'Litigant' && userId) {
            joinClause += ` JOIN case_party cp ON c.cnr = cp.cnr`;
            params.push(userId);
            conditions.push(`cp.litigant_id = $${params.length}`);
        }
        // RBAC Filter: Advocates only see cases they are assigned to
        else if (userRole === 'Advocate' && userId) {
            joinClause += ` JOIN case_advocate ca ON c.cnr = ca.cnr`;
            params.push(userId);
            conditions.push(`ca.advocate_id = $${params.length}`);
        }
        // Judges, Clerks, and Court Administrators have universal access to all cases (SRS Matrix)

        if (search) {
            params.push(`%${search.trim()}%`);
            conditions.push(`(c.cnr ILIKE $${params.length} OR c.case_number ILIKE $${params.length} OR c.standardized_filing_number ILIKE $${params.length})`);
        }
        if (status && status !== 'ALL') {
            params.push(status);
            conditions.push(`c.case_status = $${params.length}`);
        }
        if (urgency && urgency !== 'ALL') {
            params.push(urgency);
            conditions.push(`c.statutory_urgency = $${params.length}`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const rowLimit = parseInt(limit || '100', 10);
        params.push(rowLimit);

        const sql = `
            SELECT DISTINCT c.cnr, c.standardized_filing_number, c.case_number, c.fir_number, 
                   c.statutory_urgency, c.case_status, c.registered_by_clerk_id
            FROM court_case c
            ${joinClause}
            ${whereClause}
            ORDER BY c.cnr DESC
            LIMIT $${params.length};
        `;

        const result = await query(sql, params);
        console.log(`[READ court_case] (${userRole || 'Public'}) Fetched ${result.rowCount} records`);

        res.json({
            success: true,
            rowCount: result.rowCount,
            data: result.rows
        });
    } catch (err) {
        console.error('[READ CASES ERROR]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// READ RELATIONAL DOSSIER (Joins R7, R8, R9, R11, R14)
app.get('/api/cases/:cnr/dossier', async (req, res) => {
    const { cnr } = req.params;
    try {
        // Case Master
        const caseRes = await query('SELECT * FROM court_case WHERE cnr = $1', [cnr]);
        if (caseRes.rowCount === 0) {
            return res.status(404).json({ success: false, error: 'Case not found' });
        }

        // Linked Parties (R8 + R1)
        const partiesRes = await query(`
            SELECT cp.party_role, cp.litigant_id, u.name, u.email
            FROM case_party cp
            JOIN system_users u ON cp.litigant_id = u.user_id
            WHERE cp.cnr = $1
            ORDER BY cp.party_role;
        `, [cnr]);

        // Linked Advocates (R9 + R1 + R2)
        const advocatesRes = await query(`
            SELECT ca.case_role, ca.advocate_id, ca.assigned_date, ca.assigned_by,
                   u.name, a.bar_enrollment_no
            FROM case_advocate ca
            JOIN system_users u ON ca.advocate_id = u.user_id
            JOIN advocate a ON ca.advocate_id = a.user_id
            WHERE ca.cnr = $1
            ORDER BY ca.case_role;
        `, [cnr]);

        // Linked Hearings (R11 View with Date from R10)
        const hearingsRes = await query(`
            SELECT hearing_seq_no, hearing_date, outcome, bench_note, judge_id, causelist_id
            FROM v_hearing_with_date
            WHERE cnr = $1
            ORDER BY hearing_seq_no;
        `, [cnr]);

        // Linked Orders (R14 View with publish_status)
        const ordersRes = await query(`
            SELECT order_seq_no, order_type, draft_timestamp, published_date, publish_status, judge_id, hearing_seq_no
            FROM v_order_with_status
            WHERE cnr = $1
            ORDER BY order_seq_no;
        `, [cnr]);

        // Linked Documents (R15)
        const docsRes = await query(`
            SELECT d.doc_seq_no, d.document_type, d.upload_date, d.advocate_id, u.name as advocate_name
            FROM document d
            LEFT JOIN system_users u ON d.advocate_id = u.user_id
            WHERE d.cnr = $1
            ORDER BY d.doc_seq_no;
        `, [cnr]);

        res.json({
            success: true,
            dossier: {
                case_details: caseRes.rows[0],
                parties: partiesRes.rows,
                advocates: advocatesRes.rows,
                hearings: hearingsRes.rows,
                orders: ordersRes.rows,
                documents: docsRes.rows
            }
        });
    } catch (err) {
        console.error('[DOSSIER ERROR]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// CREATE (INSERT)
app.post('/api/cases', async (req, res) => {
    const userRole = req.headers['x-user-role'];
    if (userRole && !['Clerk', 'Court Administrator', 'Lead Advocate', 'Advocate'].includes(userRole)) {
        return res.status(403).json({ success: false, error: 'Access denied: Only Court Clerks and authorized advocates may file cases.' });
    }

    const { cnr, filing_no, case_no, fir_no, urgency, status, clerk_id } = req.body;

    if (!cnr || !filing_no || !case_no || !clerk_id) {
        return res.status(400).json({
            success: false,
            error: 'Mandatory fields missing: CNR, Standardized Filing No, Case No, and Clerk ID are required.'
        });
    }

    try {
        const sql = `
            INSERT INTO court_case (
                cnr, standardized_filing_number, case_number, fir_number, 
                statutory_urgency, case_status, registered_by_clerk_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *;
        `;
        const params = [
            cnr.trim().toUpperCase(),
            filing_no.trim(),
            case_no.trim(),
            fir_no && fir_no.trim() ? fir_no.trim() : null,
            urgency || 'Normal',
            status || 'Filed',
            parseInt(clerk_id, 10)
        ];

        const result = await query(sql, params);
        console.log(`[CREATE court_case] Inserted case ${cnr}. result.rowCount = ${result.rowCount}`);

        res.status(201).json({
            success: true,
            rowCount: result.rowCount,
            message: `Case ${cnr} successfully filed.`,
            data: result.rows[0]
        });
    } catch (err) {
        console.error('[CREATE ERROR]', err.message);
        res.status(400).json({ success: false, error: err.message });
    }
});

// UPDATE
app.put('/api/cases/:cnr', async (req, res) => {
    const { cnr } = req.params;
    const { urgency, status, fir_no } = req.body;

    try {
        const sql = `
            UPDATE court_case
            SET statutory_urgency = $1, 
                case_status = $2,
                fir_number = $3
            WHERE cnr = $4
            RETURNING *;
        `;
        const params = [
            urgency,
            status,
            fir_no && fir_no.trim() ? fir_no.trim() : null,
            cnr
        ];

        const result = await query(sql, params);
        console.log(`[UPDATE court_case] Updated case ${cnr}. result.rowCount = ${result.rowCount}`);

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, rowCount: 0, error: `Case ${cnr} does not exist.` });
        }

        res.json({
            success: true,
            rowCount: result.rowCount,
            message: `Case ${cnr} updated successfully.`,
            data: result.rows[0]
        });
    } catch (err) {
        console.error('[UPDATE ERROR]', err.message);
        res.status(400).json({ success: false, error: err.message });
    }
});

// DELETE
app.delete('/api/cases/:cnr', async (req, res) => {
    const userRole = req.headers['x-user-role'];
    if (userRole && !['Clerk', 'Court Administrator'].includes(userRole)) {
        return res.status(403).json({ success: false, error: 'Access denied: Case deletion is restricted to Registry Clerks and Administrators.' });
    }

    const { cnr } = req.params;

    try {
        const sql = `DELETE FROM court_case WHERE cnr = $1;`;
        const result = await query(sql, [cnr]);
        console.log(`[DELETE court_case] Deleted case ${cnr}. result.rowCount = ${result.rowCount}`);

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, rowCount: 0, error: `Case ${cnr} not found.` });
        }

        res.json({
            success: true,
            rowCount: result.rowCount,
            message: `Case ${cnr} successfully purged from database.`
        });
    } catch (err) {
        console.error('[DELETE ERROR]', err.message);
        if (err.code === '23503') {
            res.status(409).json({
                success: false,
                error: `Foreign Key Constraint RESTRICT: Cannot delete case ${cnr} because dependent hearings, orders, or assigned parties exist in related tables.`
            });
        } else {
            res.status(400).json({ success: false, error: err.message });
        }
    }
});

// ==============================================================
// 3. TABLE 2: HEARINGS & CAUSE LISTS (R11 & R10 via View)
// ==============================================================
app.get('/api/hearings', async (req, res) => {
    try {
        const { outcome, search, limit } = req.query;
        let conditions = [];
        let params = [];

        if (outcome && outcome !== 'ALL') {
            params.push(outcome);
            conditions.push(`outcome = $${params.length}`);
        }
        if (search) {
            params.push(`%${search.trim()}%`);
            conditions.push(`cnr ILIKE $${params.length}`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const rowLimit = parseInt(limit || '50', 10);
        params.push(rowLimit);

        const sql = `
            SELECT cnr, hearing_seq_no, hearing_date, outcome, bench_note, judge_id, causelist_id
            FROM v_hearing_with_date
            ${whereClause}
            ORDER BY hearing_date DESC NULLS LAST, cnr ASC
            LIMIT $${params.length};
        `;
        const result = await query(sql, params);
        console.log(`[READ v_hearing_with_date] Fetched ${result.rowCount} records`);

        res.json({ success: true, rowCount: result.rowCount, data: result.rows });
    } catch (err) {
        console.error('[HEARINGS ERROR]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==============================================================
// 4. TABLE 3: COURT ORDERS & JUDGMENTS (R14 via View)
// ==============================================================
app.get('/api/orders', async (req, res) => {
    try {
        const { type, publish_status, search, limit } = req.query;
        let conditions = [];
        let params = [];

        if (type && type !== 'ALL') {
            params.push(type);
            conditions.push(`order_type = $${params.length}`);
        }
        if (publish_status && publish_status !== 'ALL') {
            params.push(publish_status);
            conditions.push(`publish_status = $${params.length}`);
        }
        if (search) {
            params.push(`%${search.trim()}%`);
            conditions.push(`cnr ILIKE $${params.length}`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const rowLimit = parseInt(limit || '100', 10);
        params.push(rowLimit);

        const sql = `
            SELECT cnr, order_seq_no, order_type, draft_timestamp, published_date, 
                   publish_status, judge_id, hearing_seq_no
            FROM v_order_with_status
            ${whereClause}
            ORDER BY draft_timestamp DESC
            LIMIT $${params.length};
        `;
        const result = await query(sql, params);
        console.log(`[READ v_order_with_status] Fetched ${result.rowCount} records`);

        res.json({ success: true, rowCount: result.rowCount, data: result.rows });
    } catch (err) {
        console.error('[ORDERS ERROR]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUBLISH ORDER
app.put('/api/orders/:cnr/:seq/publish', async (req, res) => {
    const userRole = req.headers['x-user-role'];
    if (userRole && !['Judge', 'Court Administrator'].includes(userRole)) {
        return res.status(403).json({ success: false, error: 'Access denied: Only a presiding Judge has authority to sign and publish judicial decrees.' });
    }

    const { cnr, seq } = req.params;
    try {
        const sql = `
            UPDATE court_order 
            SET published_date = CURRENT_DATE 
            WHERE cnr = $1 AND order_seq_no = $2 AND published_date IS NULL
            RETURNING *;
        `;
        const result = await query(sql, [cnr, parseInt(seq, 10)]);
        if (result.rowCount === 0) {
            return res.status(400).json({ success: false, error: 'Order already published or not found.' });
        }
        console.log(`[PUBLISH ORDER] Order ${cnr} #${seq} published. result.rowCount = ${result.rowCount}`);
        res.json({ success: true, rowCount: result.rowCount, message: 'Order successfully published.' });
    } catch (err) {
        console.error('[PUBLISH ERROR]', err.message);
        res.status(400).json({ success: false, error: err.message });
    }
});

// ==============================================================
// 5. TABLE 4: WITNESSES & SUMMONS (R12 & R13)
// ==============================================================
app.get('/api/witnesses', async (req, res) => {
    try {
        const { search, limit } = req.query;
        let params = [];
        let whereClause = '';

        if (search) {
            params.push(`%${search.trim()}%`);
            whereClause = `WHERE w.name ILIKE $1 OR w.contact_number ILIKE $1`;
        }

        const rowLimit = parseInt(limit || '50', 10);
        params.push(rowLimit);

        const sql = `
            SELECT w.witness_id, w.name, w.contact_number,
                   COUNT(s.summons_date) AS summons_count
            FROM witness w
            LEFT JOIN summons s ON w.witness_id = s.witness_id
            ${whereClause}
            GROUP BY w.witness_id, w.name, w.contact_number
            ORDER BY w.witness_id ASC
            LIMIT $${params.length};
        `;
        const result = await query(sql, params);
        console.log(`[READ witness] Fetched ${result.rowCount} records`);

        res.json({ success: true, rowCount: result.rowCount, data: result.rows });
    } catch (err) {
        console.error('[WITNESS ERROR]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// CREATE WITNESS
app.post('/api/witnesses', async (req, res) => {
    const { witness_id, name, contact_number } = req.body;
    if (!witness_id || !name || !contact_number) {
        return res.status(400).json({ success: false, error: 'Witness ID, Name, and Contact Number are required.' });
    }

    try {
        const sql = `
            INSERT INTO witness (witness_id, name, contact_number)
            VALUES ($1, $2, $3)
            RETURNING *;
        `;
        const result = await query(sql, [parseInt(witness_id, 10), name.trim(), contact_number.trim()]);
        console.log(`[CREATE witness] Created witness ${witness_id}. result.rowCount = ${result.rowCount}`);

        res.status(201).json({
            success: true,
            rowCount: result.rowCount,
            message: `Witness ${name} registered.`,
            data: result.rows[0]
        });
    } catch (err) {
        console.error('[CREATE WITNESS ERROR]', err.message);
        res.status(400).json({ success: false, error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
if (require.main === module || !process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`=================================================`);
        console.log(` District Judiciary Enterprise Management Active`);
        console.log(` Endpoint: http://localhost:${PORT}`);
        console.log(` Database: Supabase PostgreSQL 17 (ap-northeast-1)`);
        console.log(`=================================================`);
    });
}

module.exports = app;
