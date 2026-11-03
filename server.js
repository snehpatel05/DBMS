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

// URL prefix normalization for hosting environments (like Vercel serverless)
app.use((req, res, next) => {
    if (!req.url.startsWith('/api') && (
        req.url.startsWith('/cases') ||
        req.url.startsWith('/stats') ||
        req.url.startsWith('/hearings') ||
        req.url.startsWith('/orders') ||
        req.url.startsWith('/witnesses') ||
        req.url.startsWith('/users') ||
        req.url.startsWith('/auth')
    )) {
        req.url = '/api' + req.url;
    }
    next();
});

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
// 1. DASHBOARD & SYSTEM METRICS (Role-Tailored KPIs)
// ==============================================================
app.get('/api/stats', async (req, res) => {
    try {
        const userRole = req.headers['x-user-role'];
        const userId = req.headers['x-user-id'] ? parseInt(req.headers['x-user-id'], 10) : null;

        // Judicial Bench View (Judge)
        if (userRole === 'Judge' && userId) {
            const sql = `
                SELECT 
                    (SELECT COUNT(*) FROM hearing WHERE judge_id = $1) AS listed_hearings,
                    (SELECT COUNT(*) FROM court_order WHERE judge_id = $1 AND published_date IS NULL) AS draft_orders,
                    (SELECT COUNT(*) FROM court_order WHERE judge_id = $1 AND published_date IS NOT NULL) AS published_decrees,
                    (SELECT COUNT(*) FROM court_case WHERE case_status = 'Disposed') AS disposed_matters,
                    (SELECT COUNT(*) FROM court_case WHERE statutory_urgency = 'Urgent') AS urgent_track;
            `;
            const r = await query(sql, [userId]);
            const s = r.rows[0];
            return res.json({
                success: true,
                role: 'Judge',
                cards: [
                    { label: 'Assigned Bench Hearings', value: s.listed_hearings, sub: 'Calendar sessions before your bench', color: '#1F4D3F' },
                    { label: 'Draft Orders Reserved', value: s.draft_orders, sub: 'Awaiting signature & decree publication', color: '#B7791F' },
                    { label: 'Published Judgments', value: s.published_decrees, sub: 'Legally signed judicial decrees', color: '#10B981' },
                    { label: 'Disposed Cases', value: s.disposed_matters, sub: 'Court matters concluded with final order', color: '#667085' },
                    { label: 'Urgent Track Matters', value: s.urgent_track, sub: 'Statutory expedited hearings', color: '#B42318' }
                ]
            });
        }

        // Legal Counsel View (Advocate)
        if (userRole === 'Advocate' && userId) {
            const sql = `
                SELECT 
                    (SELECT COUNT(*) FROM case_advocate WHERE advocate_id = $1) AS retainer_cases,
                    (SELECT COUNT(*) FROM case_advocate WHERE advocate_id = $1 AND case_role = 'Lead') AS lead_briefs,
                    (SELECT COUNT(*) FROM hearing WHERE cnr IN (SELECT cnr FROM case_advocate WHERE advocate_id = $1)) AS appearances,
                    (SELECT COUNT(*) FROM document WHERE advocate_id = $1) AS docs_filed,
                    (SELECT COUNT(*) FROM vakalatnama WHERE advocate_id = $1) AS vakalatnamas;
            `;
            const r = await query(sql, [userId]);
            const s = r.rows[0];
            return res.json({
                success: true,
                role: 'Advocate',
                cards: [
                    { label: 'My Client Retainers', value: s.retainer_cases, sub: 'Active disputes representing clients', color: '#1D5FA8' },
                    { label: 'Lead Counsel Briefs', value: s.lead_briefs, sub: 'Senior advocate authority', color: '#1F4D3F' },
                    { label: 'Court Appearances', value: s.appearances, sub: 'Scheduled bench trial sessions', color: '#B7791F' },
                    { label: 'Pleadings & Briefs Filed', value: s.docs_filed, sub: 'Petitions, affidavits & exhibits', color: '#6941C6' },
                    { label: 'Vakalatnama Powers', value: s.vakalatnamas, sub: 'Digital power of attorney on record', color: '#10B981' }
                ]
            });
        }

        // Citizen Transparency View (Litigant)
        if (userRole === 'Litigant' && userId) {
            const sql = `
                SELECT 
                    (SELECT COUNT(*) FROM case_party WHERE litigant_id = $1) AS my_matters,
                    (SELECT party_role FROM case_party WHERE litigant_id = $1 LIMIT 1) AS my_role,
                    (SELECT COUNT(*) FROM hearing WHERE cnr IN (SELECT cnr FROM case_party WHERE litigant_id = $1)) AS hearings,
                    (SELECT COUNT(*) FROM court_order WHERE published_date IS NOT NULL AND cnr IN (SELECT cnr FROM case_party WHERE litigant_id = $1)) AS decrees,
                    (SELECT COUNT(*) FROM summons WHERE cnr IN (SELECT cnr FROM case_party WHERE litigant_id = $1)) AS summons;
            `;
            const r = await query(sql, [userId]);
            const s = r.rows[0];
            return res.json({
                success: true,
                role: 'Litigant',
                cards: [
                    { label: 'My Court Matters', value: s.my_matters, sub: `Active dispute matters on record (${s.my_role || 'Party'})`, color: '#667085' },
                    { label: 'Scheduled Trial Dates', value: s.hearings, sub: 'Appearances before the judicial bench', color: '#1D5FA8' },
                    { label: 'Certified Court Decrees', value: s.decrees, sub: 'Official published orders in matter', color: '#10B981' },
                    { label: 'Summons Issued', value: s.summons, sub: 'Witness summons dispatched for case', color: '#B7791F' }
                ]
            });
        }

        // Registry & Supervisory View (Clerk & Court Administrator)
        const statsQuery = `
            SELECT 
                (SELECT COUNT(*) FROM court_case) AS total_cases,
                (SELECT COUNT(*) FROM court_case WHERE case_status = 'Pending') AS pending_cases,
                (SELECT COUNT(*) FROM court_case WHERE statutory_urgency = 'Urgent') AS urgent_cases,
                (SELECT COUNT(*) FROM court_case WHERE case_status = 'Disposed') AS disposed_cases,
                (SELECT COUNT(*) FROM cause_list) AS total_causelists,
                (SELECT COUNT(*) FROM witness) AS total_witnesses,
                (SELECT COUNT(*) FROM hearing) AS total_hearings,
                (SELECT COUNT(*) FROM court_order WHERE published_date IS NOT NULL) AS published_orders;
        `;
        const result = await query(statsQuery);
        const s = result.rows[0];
        res.json({
            success: true,
            role: userRole || 'Clerk',
            cards: [
                { label: 'Total Registered Cases', value: s.total_cases, sub: 'Active registry dockets', color: '#1F4D3F' },
                { label: 'Pending Scrutiny / Trial', value: s.pending_cases, sub: 'Awaiting judicial disposal', color: '#B7791F' },
                { label: 'Urgent Track Filings', value: s.urgent_cases, sub: 'Statutory priority proceedings', color: '#B42318' },
                { label: 'Disposed Matters', value: s.disposed_cases, sub: 'Decrees pronounced & finalized', color: '#667085' },
                { label: 'Cause Lists Issued', value: s.total_causelists, sub: 'Daily court roster calendars', color: '#1D5FA8' },
                { label: 'Witness Summons Active', value: s.total_witnesses, sub: 'Enrolled witness repository', color: '#6941C6' }
            ],
            stats: s
        });
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
        const userRole = req.headers['x-user-role'];
        const userId = req.headers['x-user-id'] ? parseInt(req.headers['x-user-id'], 10) : null;
        let conditions = [];
        let params = [];

        // Role-Based Filtering
        if (userRole === 'Judge' && userId) {
            params.push(userId);
            conditions.push(`judge_id = $${params.length}`);
        } else if (userRole === 'Advocate' && userId) {
            params.push(userId);
            conditions.push(`cnr IN (SELECT cnr FROM case_advocate WHERE advocate_id = $${params.length})`);
        } else if (userRole === 'Litigant' && userId) {
            params.push(userId);
            conditions.push(`cnr IN (SELECT cnr FROM case_party WHERE litigant_id = $${params.length})`);
        }

        if (outcome && outcome !== 'ALL') {
            params.push(outcome);
            conditions.push(`outcome = $${params.length}`);
        }
        if (search) {
            params.push(`%${search.trim()}%`);
            conditions.push(`cnr ILIKE $${params.length}`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const rowLimit = parseInt(limit || '100', 10);
        params.push(rowLimit);

        const sql = `
            SELECT cnr, hearing_seq_no, hearing_date, outcome, bench_note, judge_id, causelist_id
            FROM v_hearing_with_date
            ${whereClause}
            ORDER BY hearing_date DESC NULLS LAST, cnr ASC
            LIMIT $${params.length};
        `;
        const result = await query(sql, params);
        console.log(`[READ v_hearing_with_date] (${userRole || 'Public'}) Fetched ${result.rowCount} records`);

        res.json({ success: true, rowCount: result.rowCount, data: result.rows });
    } catch (err) {
        console.error('[HEARINGS ERROR]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// JUDGE BENCH NOTE & OUTCOME RECORDER (R11 Judicial Authority)
app.put('/api/hearings/:cnr/:seq', async (req, res) => {
    const userRole = req.headers['x-user-role'];
    if (userRole && !['Judge', 'Court Administrator'].includes(userRole)) {
        return res.status(403).json({ success: false, error: 'Access denied: Judicial recording of bench notes and trial outcomes is restricted to Presiding Judges.' });
    }

    const { cnr, seq } = req.params;
    const { outcome, bench_note } = req.body;

    try {
        const sql = `
            UPDATE hearing
            SET outcome = COALESCE($1, outcome),
                bench_note = COALESCE($2, bench_note)
            WHERE cnr = $3 AND hearing_seq_no = $4
            RETURNING *;
        `;
        const result = await query(sql, [
            outcome || null,
            bench_note !== undefined ? bench_note.trim() : null,
            cnr,
            parseInt(seq, 10)
        ]);

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, error: `Hearing sequence #${seq} for case ${cnr} not found.` });
        }

        console.log(`[BENCH NOTE] Judge updated hearing ${cnr} #${seq}`);
        res.json({
            success: true,
            rowCount: result.rowCount,
            message: 'Hearing outcome and judicial bench note recorded on official docket.',
            data: result.rows[0]
        });
    } catch (err) {
        console.error('[BENCH NOTE ERROR]', err.message);
        res.status(400).json({ success: false, error: err.message });
    }
});

// ==============================================================
// 4. TABLE 3: COURT ORDERS & JUDGMENTS (R14 via View)
// ==============================================================
app.get('/api/orders', async (req, res) => {
    try {
        const { type, publish_status, search, limit } = req.query;
        const userRole = req.headers['x-user-role'];
        const userId = req.headers['x-user-id'] ? parseInt(req.headers['x-user-id'], 10) : null;
        let conditions = [];
        let params = [];

        // Role-Based Filtering
        if (userRole === 'Judge' && userId) {
            params.push(userId);
            conditions.push(`judge_id = $${params.length}`);
        } else if (userRole === 'Advocate' && userId) {
            params.push(userId);
            conditions.push(`cnr IN (SELECT cnr FROM case_advocate WHERE advocate_id = $${params.length})`);
        } else if (userRole === 'Litigant' && userId) {
            params.push(userId);
            conditions.push(`cnr IN (SELECT cnr FROM case_party WHERE litigant_id = $${params.length})`);
        }

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
        console.log(`[READ v_order_with_status] (${userRole || 'Public'}) Fetched ${result.rowCount} records`);

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

// ==============================================================
// 6. TABLE 5: PLEADINGS & LEGAL DOCUMENTS (R15 - Advocate Desk)
// ==============================================================
app.get('/api/documents', async (req, res) => {
    try {
        const userRole = req.headers['x-user-role'];
        const userId = req.headers['x-user-id'] ? parseInt(req.headers['x-user-id'], 10) : null;
        const { cnr, type, limit } = req.query;
        let conditions = [];
        let params = [];

        if (userRole === 'Advocate' && userId) {
            params.push(userId);
            conditions.push(`d.advocate_id = $${params.length}`);
        } else if (userRole === 'Litigant' && userId) {
            params.push(userId);
            conditions.push(`d.cnr IN (SELECT cnr FROM case_party WHERE litigant_id = $${params.length})`);
        }

        if (cnr) {
            params.push(`%${cnr.trim()}%`);
            conditions.push(`d.cnr ILIKE $${params.length}`);
        }
        if (type && type !== 'ALL') {
            params.push(type);
            conditions.push(`d.document_type = $${params.length}`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const rowLimit = parseInt(limit || '100', 10);
        params.push(rowLimit);

        const sql = `
            SELECT d.cnr, d.doc_seq_no, d.document_type, d.upload_date, d.advocate_id,
                   u.name AS advocate_name
            FROM document d
            LEFT JOIN system_users u ON d.advocate_id = u.user_id
            ${whereClause}
            ORDER BY d.upload_date DESC, d.doc_seq_no DESC
            LIMIT $${params.length};
        `;
        const result = await query(sql, params);
        console.log(`[READ document] (${userRole || 'Public'}) Fetched ${result.rowCount} records`);

        res.json({ success: true, rowCount: result.rowCount, data: result.rows });
    } catch (err) {
        console.error('[DOCUMENTS ERROR]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/documents', async (req, res) => {
    const userRole = req.headers['x-user-role'];
    const userId = req.headers['x-user-id'] ? parseInt(req.headers['x-user-id'], 10) : null;
    if (userRole && !['Advocate', 'Clerk', 'Court Administrator'].includes(userRole)) {
        return res.status(403).json({ success: false, error: 'Access denied: Only Advocates and Registry staff may file legal pleadings.' });
    }

    const { cnr, document_type, advocate_id } = req.body;
    if (!cnr || !document_type) {
        return res.status(400).json({ success: false, error: 'CNR and Document Type are required.' });
    }

    const advId = advocate_id ? parseInt(advocate_id, 10) : (userId || 1);

    try {
        const seqRes = await query('SELECT COALESCE(MAX(doc_seq_no), 0) + 1 AS next_seq FROM document WHERE cnr = $1', [cnr]);
        const nextSeq = seqRes.rows[0].next_seq;

        const sql = `
            INSERT INTO document (cnr, doc_seq_no, document_type, upload_date, advocate_id)
            VALUES ($1, $2, $3, CURRENT_DATE, $4)
            RETURNING *;
        `;
        const result = await query(sql, [cnr, nextSeq, document_type, advId]);
        console.log(`[CREATE document] Filed ${document_type} on case ${cnr}`);

        res.status(201).json({
            success: true,
            rowCount: result.rowCount,
            message: `${document_type} filed successfully on record.`,
            data: result.rows[0]
        });
    } catch (err) {
        console.error('[CREATE DOCUMENT ERROR]', err.message);
        res.status(400).json({ success: false, error: err.message });
    }
});

// ==============================================================
// 7. TABLE 6: VAKALATNAMA AUTHORIZATIONS (R16)
// ==============================================================
app.get('/api/vakalatnamas', async (req, res) => {
    try {
        const userRole = req.headers['x-user-role'];
        const userId = req.headers['x-user-id'] ? parseInt(req.headers['x-user-id'], 10) : null;
        let conditions = [];
        let params = [];

        if (userRole === 'Advocate' && userId) {
            params.push(userId);
            conditions.push(`v.advocate_id = $${params.length}`);
        } else if (userRole === 'Litigant' && userId) {
            params.push(userId);
            conditions.push(`v.litigant_id = $${params.length}`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const sql = `
            SELECT v.auth_id, v.signed_date, v.e_signature_flag, v.cnr,
                   v.litigant_id, ul.name AS litigant_name,
                   v.advocate_id, ua.name AS advocate_name
            FROM vakalatnama v
            LEFT JOIN system_users ul ON v.litigant_id = ul.user_id
            LEFT JOIN system_users ua ON v.advocate_id = ua.user_id
            ${whereClause}
            ORDER BY v.auth_id ASC
            LIMIT 100;
        `;
        const result = await query(sql, params);
        res.json({ success: true, rowCount: result.rowCount, data: result.rows });
    } catch (err) {
        console.error('[VAKALATNAMA ERROR]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==============================================================
// 8. TABLE 7: ADVOCATE ASSIGNMENT (R9 - Lead Assigner Trigger)
// ==============================================================
app.post('/api/case-advocates', async (req, res) => {
    const { cnr, advocate_id, case_role, assigned_by } = req.body;
    if (!cnr || !advocate_id) {
        return res.status(400).json({ success: false, error: 'CNR and Advocate ID are required.' });
    }

    try {
        const sql = `
            INSERT INTO case_advocate (cnr, advocate_id, case_role, assigned_date, assigned_by)
            VALUES ($1, $2, $3, CURRENT_DATE, $4)
            RETURNING *;
        `;
        const result = await query(sql, [
            cnr,
            parseInt(advocate_id, 10),
            case_role || 'Associate',
            assigned_by ? parseInt(assigned_by, 10) : null
        ]);

        res.status(201).json({
            success: true,
            rowCount: result.rowCount,
            message: 'Advocate counsel successfully retained on docket.',
            data: result.rows[0]
        });
    } catch (err) {
        console.error('[ASSIGN ADVOCATE ERROR]', err.message);
        res.status(400).json({ success: false, error: err.message });
    }
});

// ==============================================================
// 9. DATABASE HEALTH & 18 BCNF TABLES AUDIT (Administrator Desk)
// ==============================================================
app.get('/api/system/health', async (req, res) => {
    const role = req.headers['x-user-role'];
    if (role !== 'Court Administrator') {
        return res.status(403).json({ success: false, error: 'Access denied: System audit is reserved for Court Administrators.' });
    }

    try {
        const sql = `
            SELECT 'system_users' AS table_name, 'R1' AS relation, 'User Accounts Master' AS description, COUNT(*) AS row_count FROM system_users UNION ALL
            SELECT 'advocate' AS table_name, 'R2' AS relation, 'Bar Council Advocates', COUNT(*) AS row_count FROM advocate UNION ALL
            SELECT 'litigant' AS table_name, 'R3' AS relation, 'Registered Litigants', COUNT(*) AS row_count FROM litigant UNION ALL
            SELECT 'judge' AS table_name, 'R4' AS relation, 'Judicial Officers', COUNT(*) AS row_count FROM judge UNION ALL
            SELECT 'clerk' AS table_name, 'R5' AS relation, 'Registry Clerks', COUNT(*) AS row_count FROM clerk UNION ALL
            SELECT 'court_administrator' AS table_name, 'R6' AS relation, 'Supervisors', COUNT(*) AS row_count FROM court_administrator UNION ALL
            SELECT 'court_case' AS table_name, 'R7' AS relation, 'Court Cases Ledger', COUNT(*) AS row_count FROM court_case UNION ALL
            SELECT 'case_party' AS table_name, 'R8' AS relation, 'Case Litigant Parties', COUNT(*) AS row_count FROM case_party UNION ALL
            SELECT 'case_advocate' AS table_name, 'R9' AS relation, 'Retained Advocates', COUNT(*) AS row_count FROM case_advocate UNION ALL
            SELECT 'cause_list' AS table_name, 'R10' AS relation, 'Daily Cause Lists', COUNT(*) AS row_count FROM cause_list UNION ALL
            SELECT 'hearing' AS table_name, 'R11' AS relation, 'Court Hearings', COUNT(*) AS row_count FROM hearing UNION ALL
            SELECT 'witness' AS table_name, 'R12' AS relation, 'Summoned Witnesses', COUNT(*) AS row_count FROM witness UNION ALL
            SELECT 'summons' AS table_name, 'R13' AS relation, 'Witness Summons', COUNT(*) AS row_count FROM summons UNION ALL
            SELECT 'court_order' AS table_name, 'R14' AS relation, 'Judicial Decrees & Orders', COUNT(*) AS row_count FROM court_order UNION ALL
            SELECT 'document' AS table_name, 'R15' AS relation, 'Legal Pleadings & Exhibits', COUNT(*) AS row_count FROM document UNION ALL
            SELECT 'vakalatnama' AS table_name, 'R16' AS relation, 'Powers of Attorney', COUNT(*) AS row_count FROM vakalatnama UNION ALL
            SELECT 'alert' AS table_name, 'R17' AS relation, 'System Notifications', COUNT(*) AS row_count FROM alert UNION ALL
            SELECT 'alert_recipient' AS table_name, 'R18' AS relation, 'Alert Deliveries', COUNT(*) AS row_count FROM alert_recipient;
        `;
        const result = await query(sql);
        res.json({ success: true, count: result.rowCount, tables: result.rows });
    } catch (err) {
        console.error('[AUDIT ERROR]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`=================================================`);
        console.log(` District Judiciary Enterprise Management Active`);
        console.log(` Endpoint: http://localhost:${PORT}`);
        console.log(` Database: Supabase PostgreSQL 17 (ap-northeast-1)`);
        console.log(`=================================================`);
    });
}

module.exports = app;
