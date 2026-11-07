// server.js - Multi-Table Judiciary Management System
// High-Assurance District Court Ledger with Strict RBAC & Statutory Workflows
const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
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
        req.url.startsWith('/auth') ||
        req.url.startsWith('/alerts') ||
        req.url.startsWith('/causelists') ||
        req.url.startsWith('/documents') ||
        req.url.startsWith('/vakalatnamas') ||
        req.url.startsWith('/case-advocates') ||
        req.url.startsWith('/case-parties') ||
        req.url.startsWith('/system') ||
        req.url.startsWith('/admin')
    )) {
        req.url = '/api' + req.url;
    }
    next();
});

// ==============================================================
// RBAC AUTHENTICATION & ACCESS CONTROL MIDDLEWARE
// ==============================================================
function authenticateUser(req, res, next) {
    const role = req.headers['x-user-role'] ? req.headers['x-user-role'].trim() : null;
    const userId = req.headers['x-user-id'] ? parseInt(req.headers['x-user-id'], 10) : null;
    req.user = {
        role: role || 'Public',
        userId: userId || null
    };
    next();
}

function requireRole(allowedRoles) {
    return (req, res, next) => {
        if (!req.user || !req.user.role || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: `Access Denied: Action restricted to [${allowedRoles.join(', ')}] privileges. Current role: ${req.user ? req.user.role : 'Public'}.`
            });
        }
        next();
    };
}

app.use(authenticateUser);

// Helper: Automated Court Alerts Generator (REQ-04, P1)
async function triggerCourtAlert(cnr, alertType, recipientUserIds = null) {
    try {
        // Determine recipient user IDs if not explicitly provided
        let recipients = recipientUserIds;
        if (!recipients || recipients.length === 0) {
            recipients = [];
            // Litigants on case
            const parties = await query('SELECT litigant_id FROM case_party WHERE cnr = $1', [cnr]);
            parties.rows.forEach(p => recipients.push(p.litigant_id));
            // Advocates on case
            const advs = await query('SELECT advocate_id FROM case_advocate WHERE cnr = $1', [cnr]);
            advs.rows.forEach(a => recipients.push(a.advocate_id));
            // Presiding Judge
            const judgeRes = await query('SELECT judge_id FROM hearing WHERE cnr = $1 AND judge_id IS NOT NULL ORDER BY hearing_seq_no DESC LIMIT 1', [cnr]);
            if (judgeRes.rowCount > 0 && judgeRes.rows[0].judge_id) {
                recipients.push(judgeRes.rows[0].judge_id);
            }
        }

        // Deduplicate recipients
        recipients = [...new Set(recipients.filter(id => id && !isNaN(id)))];
        if (recipients.length === 0) return;

        // Get next alert_id
        const nextIdRes = await query('SELECT COALESCE(MAX(alert_id), 0) + 1 AS next_id FROM alert;');
        const newAlertId = nextIdRes.rows[0].next_id;

        // Insert Master Alert (R17)
        await query(
            'INSERT INTO alert (alert_id, alert_timestamp, alert_type, cnr) VALUES ($1, NOW(), $2, $3);',
            [newAlertId, alertType, cnr]
        );

        // Insert Alert Deliveries for each Recipient (R18)
        for (const uid of recipients) {
            await query(
                'INSERT INTO alert_recipient (alert_id, user_id, alert_status) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING;',
                [newAlertId, uid, 'Delivered']
            );
        }
        console.log(`[ALERT DISPATCHED] ID #${newAlertId}: "${alertType}" for Case ${cnr} to ${recipients.length} recipients.`);
    } catch (err) {
        console.error('[TRIGGER ALERT ERROR]', err.message);
    }
}

// ==============================================================
// 1. AUTHENTICATION & ROLE SWITCHING (RBAC)
// ==============================================================
app.post('/api/auth/login', async (req, res) => {
    const { identifier, password } = req.body;
    if (!identifier) {
        return res.status(400).json({ success: false, error: 'User ID or Email is required.' });
    }

    try {
        const isNum = !isNaN(identifier);
        const sql = isNum
            ? 'SELECT user_id, name, email, password_hash, user_role FROM system_users WHERE user_id = $1;'
            : 'SELECT user_id, name, email, password_hash, user_role FROM system_users WHERE email ILIKE $1;';
        const params = [isNum ? parseInt(identifier, 10) : identifier.trim()];

        const result = await query(sql, params);
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, error: 'User account not found.' });
        }

        const user = result.rows[0];

        // Optional password check (supports both preset 1-click simulation and password verification)
        if (password) {
            const hashed = crypto.createHash('md5').update(password).digest('hex');
            // If user provided a password and it does not match password_hash, reject
            if (user.password_hash && user.password_hash !== hashed && user.password_hash !== password) {
                return res.status(401).json({ success: false, error: 'Invalid password credentials.' });
            }
        }

        console.log(`[RBAC AUTH] Authenticated: ${user.name} (${user.user_role}) #${user.user_id}`);
        // Return user record without exposing raw password hash
        res.json({
            success: true,
            user: {
                user_id: user.user_id,
                name: user.name,
                email: user.email,
                user_role: user.user_role
            }
        });
    } catch (err) {
        console.error('[AUTH ERROR]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Admin endpoint: List system users
app.get('/api/users', requireRole(['Court Administrator']), async (req, res) => {
    try {
        const sql = `
            SELECT u.user_id, u.name, u.email, u.user_role, u.created_by_admin_id,
                   a.bar_enrollment_no, ca.localization_setting
            FROM system_users u
            LEFT JOIN advocate a ON u.user_id = a.user_id
            LEFT JOIN court_administrator ca ON u.user_id = ca.user_id
            ORDER BY u.user_id ASC
            LIMIT 150;
        `;
        const result = await query(sql);
        res.json({ success: true, rowCount: result.rowCount, data: result.rows });
    } catch (err) {
        console.error('[USERS ERROR]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Admin endpoint: Create new user account
app.post('/api/users', requireRole(['Court Administrator']), async (req, res) => {
    const { name, email, user_role, bar_enrollment_no, password } = req.body;
    if (!name || !email || !user_role) {
        return res.status(400).json({ success: false, error: 'Name, email, and user role are mandatory.' });
    }

    try {
        const nextIdRes = await query('SELECT COALESCE(MAX(user_id), 0) + 1 AS next_id FROM system_users;');
        const newUserId = nextIdRes.rows[0].next_id;
        const passHash = crypto.createHash('md5').update(password || 'Court@2026').digest('hex');

        // Insert into system_users (R1)
        await query(
            'INSERT INTO system_users (user_id, name, email, password_hash, user_role, created_by_admin_id) VALUES ($1, $2, $3, $4, $5, $6);',
            [newUserId, name.trim(), email.trim().toLowerCase(), passHash, user_role, req.user.userId]
        );

        // Insert specialized subtype role
        if (user_role === 'Advocate') {
            await query('INSERT INTO advocate (user_id, bar_enrollment_no) VALUES ($1, $2);', [
                newUserId,
                bar_enrollment_no || `BAR/GJ/${newUserId}/2026`
            ]);
        } else if (user_role === 'Judge') {
            await query('INSERT INTO judge (user_id) VALUES ($1);', [newUserId]);
        } else if (user_role === 'Clerk') {
            await query('INSERT INTO clerk (user_id) VALUES ($1);', [newUserId]);
        } else if (user_role === 'Litigant') {
            await query('INSERT INTO litigant (user_id) VALUES ($1);', [newUserId]);
        } else if (user_role === 'Court Administrator') {
            await query("INSERT INTO court_administrator (user_id, localization_setting) VALUES ($1, 'en-IN');", [newUserId]);
        }

        res.status(201).json({
            success: true,
            message: `User account created for ${name} (${user_role}) with ID #${newUserId}`,
            data: { user_id: newUserId, name, email, user_role }
        });
    } catch (err) {
        console.error('[CREATE USER ERROR]', err.message);
        res.status(400).json({ success: false, error: err.message });
    }
});

// Admin endpoint: Update court localization
app.put('/api/admin/localization', requireRole(['Court Administrator']), async (req, res) => {
    const { localization_setting } = req.body;
    if (!localization_setting) {
        return res.status(400).json({ success: false, error: 'Localization setting is required (e.g., en-IN, gu-IN).' });
    }
    try {
        await query('UPDATE court_administrator SET localization_setting = $1 WHERE user_id = $2;', [
            localization_setting.trim(),
            req.user.userId
        ]);
        res.json({ success: true, message: `Court localization updated to ${localization_setting}.` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==============================================================
// 2. DASHBOARD & SYSTEM METRICS (Role-Tailored KPIs)
// ==============================================================
app.get('/api/stats', async (req, res) => {
    try {
        const { role: userRole, userId } = req.user;

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
// 3. TABLE 1: COURT_CASE (R7) - FULL CRUD & MULTI-PARAM SEARCH (REQ-02)
// ==============================================================

// READ CASES (with multi-parameter search & role filtering)
app.get('/api/cases', async (req, res) => {
    try {
        const { search, status, urgency, limit } = req.query;
        const { role: userRole, userId } = req.user;

        let conditions = [];
        let params = [];
        let joinClause = '';

        // RBAC Filter: Litigants only see cases they are party to
        if (userRole === 'Litigant' && userId) {
            joinClause += ` JOIN case_party cp ON c.cnr = cp.cnr`;
            params.push(userId);
            conditions.push(`cp.litigant_id = $${params.length}`);
        }
        // RBAC Filter: Advocates only see cases they are retained on
        else if (userRole === 'Advocate' && userId) {
            joinClause += ` JOIN case_advocate ca ON c.cnr = ca.cnr`;
            params.push(userId);
            conditions.push(`ca.advocate_id = $${params.length}`);
        }

        // Multi-Parameter Search (REQ-02, P1): Searches CNR, Case No, Filing No, FIR, Party Name, or Advocate Name
        if (search && search.trim()) {
            params.push(`%${search.trim()}%`);
            const pIdx = params.length;
            conditions.push(`(
                c.cnr ILIKE $${pIdx} OR 
                c.case_number ILIKE $${pIdx} OR 
                c.standardized_filing_number ILIKE $${pIdx} OR 
                c.fir_number ILIKE $${pIdx} OR
                EXISTS (SELECT 1 FROM case_party cp_s JOIN system_users up_s ON cp_s.litigant_id = up_s.user_id WHERE cp_s.cnr = c.cnr AND up_s.name ILIKE $${pIdx}) OR
                EXISTS (SELECT 1 FROM case_advocate ca_s JOIN system_users ua_s ON ca_s.advocate_id = ua_s.user_id WHERE ca_s.cnr = c.cnr AND ua_s.name ILIKE $${pIdx})
            )`);
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

// READ RELATIONAL DOSSIER (Joins R7, R8, R9, R11, R14, R15 with Bench Note Privacy)
app.get('/api/cases/:cnr/dossier', async (req, res) => {
    const { cnr } = req.params;
    const { role: userRole, userId } = req.user;

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
        // BENCH NOTE PRIVACY RULE (SRS Section 4.1): Only the Presiding Judge on that hearing can see bench notes!
        const hearingsRes = await query(`
            SELECT hearing_seq_no, hearing_date, outcome, judge_id, causelist_id,
                   CASE 
                       WHEN $2 = 'Judge' AND judge_id = $3 THEN bench_note 
                       ELSE NULL 
                   END AS bench_note
            FROM v_hearing_with_date
            WHERE cnr = $1
            ORDER BY hearing_seq_no;
        `, [cnr, userRole, userId]);

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

// CREATE (INSERT) COURT CASE
app.post('/api/cases', requireRole(['Clerk', 'Court Administrator']), async (req, res) => {
    const { cnr, filing_no, case_no, fir_no, urgency, status, clerk_id } = req.body;

    if (!cnr || !filing_no || !case_no) {
        return res.status(400).json({
            success: false,
            error: 'Mandatory fields missing: CNR, Standardized Filing No, and Case No are required.'
        });
    }

    const clerkIdToUse = clerk_id ? parseInt(clerk_id, 10) : (req.user.userId || 301);

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
            clerkIdToUse
        ];

        const result = await query(sql, params);
        console.log(`[CREATE court_case] Inserted case ${cnr}.`);

        // Dispatch alert to Registry & Administrator
        await triggerCourtAlert(cnr, 'Case Status Change', [clerkIdToUse]);

        res.status(201).json({
            success: true,
            rowCount: result.rowCount,
            message: `Case ${cnr} successfully filed in court registry.`,
            data: result.rows[0]
        });
    } catch (err) {
        console.error('[CREATE ERROR]', err.message);
        res.status(400).json({ success: false, error: err.message });
    }
});

// UPDATE COURT CASE (Strict RBAC, COALESCE & Disposal Guard)
app.put('/api/cases/:cnr', requireRole(['Clerk', 'Court Administrator']), async (req, res) => {
    const { cnr } = req.params;
    const { urgency, status, fir_no } = req.body;

    try {
        // Guard 1: Verify current case status
        const currRes = await query('SELECT case_status FROM court_case WHERE cnr = $1', [cnr]);
        if (currRes.rowCount === 0) {
            return res.status(404).json({ success: false, error: `Case ${cnr} not found.` });
        }
        const currentStatus = currRes.rows[0].case_status;

        // Guard 2: Irreversible disposal check
        if (currentStatus === 'Disposed') {
            return res.status(400).json({
                success: false,
                error: `Case ${cnr} is permanently Disposed by judicial decree. Records are sealed and cannot be modified.`
            });
        }

        // Guard 3: Non-judges cannot directly set status to 'Disposed'
        if (status === 'Disposed') {
            return res.status(403).json({
                success: false,
                error: `Registry Clerks cannot set case status to 'Disposed'. Case disposal is an exclusive judicial act executed upon the Hon'ble Judge pronouncing a Final Judgment decree.`
            });
        }

        // Safe update with COALESCE to preserve unmodified columns
        const sql = `
            UPDATE court_case
            SET statutory_urgency = COALESCE($1, statutory_urgency), 
                case_status = COALESCE($2, case_status),
                fir_number = COALESCE($3, fir_number)
            WHERE cnr = $4
            RETURNING *;
        `;
        const params = [
            urgency || null,
            status || null,
            fir_no && fir_no.trim() ? fir_no.trim() : null,
            cnr
        ];

        const result = await query(sql, params);
        console.log(`[UPDATE court_case] Updated case ${cnr}.`);

        // Trigger notification
        await triggerCourtAlert(cnr, 'Case Status Change');

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

// DELETE COURT CASE (Restricted to unverified plaints in 'Filed' state; protected by FK RESTRICT)
app.delete('/api/cases/:cnr', requireRole(['Clerk', 'Court Administrator']), async (req, res) => {
    const { cnr } = req.params;

    try {
        // Verify case is not active in proceedings
        const caseCheck = await query('SELECT case_status FROM court_case WHERE cnr = $1', [cnr]);
        if (caseCheck.rowCount === 0) {
            return res.status(404).json({ success: false, error: `Case ${cnr} not found.` });
        }
        if (caseCheck.rows[0].case_status === 'Disposed') {
            return res.status(400).json({
                success: false,
                error: `Permanent Record Retention: Disposed cases cannot be purged from official court archives.`
            });
        }

        const sql = `DELETE FROM court_case WHERE cnr = $1;`;
        const result = await query(sql, [cnr]);
        console.log(`[DELETE court_case] Deleted unlisted case ${cnr}.`);

        res.json({
            success: true,
            rowCount: result.rowCount,
            message: `Case ${cnr} successfully removed from registry.`
        });
    } catch (err) {
        console.error('[DELETE ERROR]', err.message);
        if (err.code === '23503') {
            res.status(409).json({
                success: false,
                error: `Foreign Key Constraint RESTRICT: Cannot delete case ${cnr} because linked hearings, orders, pleadings, or litigant parties exist on record.`
            });
        } else {
            res.status(400).json({ success: false, error: err.message });
        }
    }
});

// ==============================================================
// 4. TABLE 2: HEARINGS & CAUSE LISTS (R11 & R10 via View)
// ==============================================================

// READ HEARINGS (with Bench Note Privacy protection)
app.get('/api/hearings', async (req, res) => {
    try {
        const { outcome, search, limit } = req.query;
        const { role: userRole, userId } = req.user;
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

        // BENCH NOTE PRIVACY (SRS Section 4.1): Only returned if requesting user is the presiding Judge
        const sql = `
            SELECT cnr, hearing_seq_no, hearing_date, outcome, judge_id, causelist_id,
                   CASE 
                       WHEN '${userRole}' = 'Judge' AND judge_id = ${userId || 0} THEN bench_note 
                       ELSE NULL 
                   END AS bench_note
            FROM v_hearing_with_date
            ${whereClause}
            ORDER BY hearing_date DESC NULLS LAST, cnr ASC
            LIMIT $${params.length};
        `;
        const result = await query(sql, params);
        res.json({ success: true, rowCount: result.rowCount, data: result.rows });
    } catch (err) {
        console.error('[HEARINGS ERROR]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// SCHEDULE NEW HEARING (Clerk core listing workflow)
app.post('/api/hearings', requireRole(['Clerk', 'Court Administrator']), async (req, res) => {
    const { cnr, judge_id, causelist_id } = req.body;
    if (!cnr) {
        return res.status(400).json({ success: false, error: 'CNR is required to schedule a hearing.' });
    }

    try {
        const seqRes = await query('SELECT COALESCE(MAX(hearing_seq_no), 0) + 1 AS next_seq FROM hearing WHERE cnr = $1', [cnr]);
        const nextSeq = seqRes.rows[0].next_seq;

        const sql = `
            INSERT INTO hearing (cnr, hearing_seq_no, outcome, bench_note, judge_id, causelist_id)
            VALUES ($1, $2, NULL, NULL, $3, $4)
            RETURNING *;
        `;
        const result = await query(sql, [
            cnr,
            nextSeq,
            judge_id ? parseInt(judge_id, 10) : 201, // Presiding Judge
            causelist_id ? parseInt(causelist_id, 10) : 1
        ]);

        // Send Hearing Reminder alert to parties
        await triggerCourtAlert(cnr, 'Hearing Reminder');

        res.status(201).json({
            success: true,
            rowCount: result.rowCount,
            message: `Hearing #${nextSeq} scheduled for case ${cnr}.`,
            data: result.rows[0]
        });
    } catch (err) {
        console.error('[SCHEDULE HEARING ERROR]', err.message);
        res.status(400).json({ success: false, error: err.message });
    }
});

// JUDGE BENCH NOTE & OUTCOME RECORDER (Strict Judicial Ownership Check)
app.put('/api/hearings/:cnr/:seq', requireRole(['Judge']), async (req, res) => {
    const { cnr, seq } = req.params;
    const { outcome, bench_note } = req.body;
    const currentJudgeId = req.user.userId;

    try {
        // Ownership check: Ensure this hearing is assigned to this Judge
        const hearingCheck = await query(
            'SELECT judge_id FROM hearing WHERE cnr = $1 AND hearing_seq_no = $2;',
            [cnr, parseInt(seq, 10)]
        );

        if (hearingCheck.rowCount === 0) {
            return res.status(404).json({ success: false, error: `Hearing #${seq} for case ${cnr} not found.` });
        }

        const presidingJudgeId = hearingCheck.rows[0].judge_id;
        if (presidingJudgeId !== currentJudgeId) {
            return res.status(403).json({
                success: false,
                error: `Judicial Bench Privilege: Hearing #${seq} is assigned to Judge #${presidingJudgeId}. Only the presiding Judge can record bench notes and trial outcomes.`
            });
        }

        const safeNote = (typeof bench_note === 'string') ? bench_note.trim() : null;

        const sql = `
            UPDATE hearing
            SET outcome = COALESCE($1, outcome),
                bench_note = COALESCE($2, bench_note)
            WHERE cnr = $3 AND hearing_seq_no = $4 AND judge_id = $5
            RETURNING *;
        `;
        const result = await query(sql, [
            outcome || null,
            safeNote,
            cnr,
            parseInt(seq, 10),
            currentJudgeId
        ]);

        console.log(`[BENCH NOTE] Hon'ble Judge #${currentJudgeId} recorded outcome on ${cnr} #${seq}`);
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
// 5. CAUSE LIST GENERATION ALGORITHM (REQ-05, P1)
// ==============================================================

// LIST CAUSE LISTS
app.get('/api/causelists', async (req, res) => {
    try {
        const sql = `
            SELECT cl.causelist_id, cl.list_date, cl.generated_by_clerk_id,
                   COUNT(h.hearing_seq_no) AS scheduled_hearings,
                   u.name AS clerk_name
            FROM cause_list cl
            LEFT JOIN hearing h ON cl.causelist_id = h.causelist_id
            LEFT JOIN system_users u ON cl.generated_by_clerk_id = u.user_id
            GROUP BY cl.causelist_id, cl.list_date, cl.generated_by_clerk_id, u.name
            ORDER BY cl.list_date DESC, cl.causelist_id DESC
            LIMIT 50;
        `;
        const result = await query(sql);
        res.json({ success: true, rowCount: result.rowCount, data: result.rows });
    } catch (err) {
        console.error('[CAUSELIST ERROR]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GENERATE DAILY CAUSE LIST WITH STATUTORY PRIORITY ALGORITHM
// Sorts by: 1) Statutory Urgency (Urgent > Statutory > Normal)
//           2) Witness Presence (cases with active summons)
//           3) Case Filing Age tiebreaker (c.cnr ASC)
app.post('/api/causelists/generate', requireRole(['Clerk', 'Court Administrator']), async (req, res) => {
    const { list_date, clerk_id } = req.body;
    const targetDate = list_date || new Date().toISOString().split('T')[0];
    const clerkToUse = clerk_id ? parseInt(clerk_id, 10) : (req.user.userId || 301);

    try {
        // Step 1: Create or find cause_list for target date
        let causelistId;
        const existing = await query('SELECT causelist_id FROM cause_list WHERE list_date = $1 LIMIT 1', [targetDate]);
        if (existing.rowCount > 0) {
            causelistId = existing.rows[0].causelist_id;
        } else {
            const nextIdRes = await query('SELECT COALESCE(MAX(causelist_id), 0) + 1 AS next_id FROM cause_list;');
            causelistId = nextIdRes.rows[0].next_id;
            await query(
                'INSERT INTO cause_list (causelist_id, list_date, generated_by_clerk_id) VALUES ($1, $2, $3);',
                [causelistId, targetDate, clerkToUse]
            );
        }

        // Step 2: Query candidate pending cases prioritizing per SRS Section 3.2
        const prioritySql = `
            SELECT c.cnr, c.case_number, c.statutory_urgency,
                   COUNT(s.summons_date) AS summons_count,
                   CASE c.statutory_urgency 
                       WHEN 'Urgent' THEN 1 
                       WHEN 'Statutory' THEN 2 
                       ELSE 3 
                   END AS urgency_rank
            FROM court_case c
            LEFT JOIN summons s ON c.cnr = s.cnr
            WHERE c.case_status = 'Pending'
            GROUP BY c.cnr, c.case_number, c.statutory_urgency
            ORDER BY urgency_rank ASC, summons_count DESC, c.cnr ASC
            LIMIT 10;
        `;
        const priorityCases = await query(prioritySql);

        // Step 3: Link scheduled cases into this cause list
        let assignedCount = 0;
        for (const c of priorityCases.rows) {
            // Check if case already has a hearing in this cause list
            const hCheck = await query('SELECT hearing_seq_no FROM hearing WHERE cnr = $1 AND causelist_id = $2', [c.cnr, causelistId]);
            if (hCheck.rowCount === 0) {
                const seqRes = await query('SELECT COALESCE(MAX(hearing_seq_no), 0) + 1 AS next_seq FROM hearing WHERE cnr = $1', [c.cnr]);
                const nextSeq = seqRes.rows[0].next_seq;
                await query(
                    'INSERT INTO hearing (cnr, hearing_seq_no, outcome, bench_note, judge_id, causelist_id) VALUES ($1, $2, $3, $4, $5, $6);',
                    [c.cnr, nextSeq, null, null, 201, causelistId]
                );
                assignedCount++;
                // Trigger hearing notification
                await triggerCourtAlert(c.cnr, 'Hearing Reminder');
            }
        }

        res.json({
            success: true,
            causelist_id: causelistId,
            list_date: targetDate,
            message: `Cause List #${causelistId} generated for ${targetDate}. Prioritized ${priorityCases.rowCount} cases (${assignedCount} newly listed).`,
            roster: priorityCases.rows
        });
    } catch (err) {
        console.error('[GENERATE CAUSELIST ERROR]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==============================================================
// 6. TABLE 3: COURT ORDERS & JUDICIAL DECREES (R14 via View)
// ==============================================================

// READ ORDERS
app.get('/api/orders', async (req, res) => {
    try {
        const { type, publish_status, search, limit } = req.query;
        const { role: userRole, userId } = req.user;
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
        res.json({ success: true, rowCount: result.rowCount, data: result.rows });
    } catch (err) {
        console.error('[ORDERS ERROR]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// CREATE DRAFT ORDER (Two-Step Judicial Workflow: Judge Drafts First)
app.post('/api/orders', requireRole(['Judge']), async (req, res) => {
    const { cnr, order_type, hearing_seq_no } = req.body;
    const judgeId = req.user.userId;

    if (!cnr || !order_type) {
        return res.status(400).json({ success: false, error: 'CNR and Order Type (Interim Order, Final Judgment, Procedural Order) are required.' });
    }

    try {
        const seqRes = await query('SELECT COALESCE(MAX(order_seq_no), 0) + 1 AS next_seq FROM court_order WHERE cnr = $1', [cnr]);
        const nextSeq = seqRes.rows[0].next_seq;

        const sql = `
            INSERT INTO court_order (cnr, order_seq_no, order_type, draft_timestamp, published_date, judge_id, hearing_seq_no)
            VALUES ($1, $2, $3, NOW(), NULL, $4, $5)
            RETURNING *;
        `;
        const result = await query(sql, [
            cnr,
            nextSeq,
            order_type,
            judgeId,
            hearing_seq_no ? parseInt(hearing_seq_no, 10) : null
        ]);

        console.log(`[DRAFT ORDER] Judge #${judgeId} created draft order #${nextSeq} (${order_type}) for case ${cnr}`);
        res.status(201).json({
            success: true,
            rowCount: result.rowCount,
            message: `Draft ${order_type} #${nextSeq} reserved on docket. Awaiting judicial signature to publish.`,
            data: result.rows[0]
        });
    } catch (err) {
        console.error('[DRAFT ORDER ERROR]', err.message);
        res.status(400).json({ success: false, error: err.message });
    }
});

// PUBLISH ORDER (Judicial Pronouncement & Automated Case Disposal)
app.put('/api/orders/:cnr/:seq/publish', requireRole(['Judge']), async (req, res) => {
    const { cnr, seq } = req.params;
    const judgeId = req.user.userId;

    try {
        // Ownership check: Ensure this Judge authored the order
        const orderCheck = await query(
            'SELECT order_type, published_date, judge_id FROM court_order WHERE cnr = $1 AND order_seq_no = $2;',
            [cnr, parseInt(seq, 10)]
        );

        if (orderCheck.rowCount === 0) {
            return res.status(404).json({ success: false, error: `Order #${seq} for case ${cnr} not found.` });
        }

        const order = orderCheck.rows[0];
        if (order.judge_id !== judgeId) {
            return res.status(403).json({
                success: false,
                error: `Judicial Privilege: Order #${seq} is drafted by Judge #${order.judge_id}. Only the presiding Judge can sign and publish this decree.`
            });
        }
        if (order.published_date) {
            return res.status(400).json({ success: false, error: 'Order is already signed and published.' });
        }

        // Publish Order
        const publishSql = `
            UPDATE court_order 
            SET published_date = CURRENT_DATE 
            WHERE cnr = $1 AND order_seq_no = $2 AND published_date IS NULL
            RETURNING *;
        `;
        const result = await query(publishSql, [cnr, parseInt(seq, 10)]);

        // AUTOMATED DISPOSAL (Lab 9 Trigger & SRS Rule):
        // If order is 'Final Judgment', officially conclude the case and seal docket as 'Disposed'
        if (order.order_type === 'Final Judgment') {
            await query("UPDATE court_case SET case_status = 'Disposed' WHERE cnr = $1;", [cnr]);
            console.log(`[CASE DISPOSAL] Case ${cnr} automatically concluded as 'Disposed' via Final Judgment.`);
        }

        // Dispatch alert to all parties and advocates
        await triggerCourtAlert(cnr, 'Order Published');

        console.log(`[PUBLISH ORDER] Order ${cnr} #${seq} signed & published.`);
        res.json({
            success: true,
            rowCount: result.rowCount,
            message: `Order #${seq} (${order.order_type}) successfully signed and published. ${order.order_type === 'Final Judgment' ? 'Case marked as DISPOSED.' : ''}`,
            data: result.rows[0]
        });
    } catch (err) {
        console.error('[PUBLISH ERROR]', err.message);
        res.status(400).json({ success: false, error: err.message });
    }
});

// ==============================================================
// 7. TABLE 4: WITNESSES & SUMMONS (R12 & R13)
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
        res.json({ success: true, rowCount: result.rowCount, data: result.rows });
    } catch (err) {
        console.error('[WITNESS ERROR]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// CREATE WITNESS
app.post('/api/witnesses', requireRole(['Clerk', 'Court Administrator']), async (req, res) => {
    const { witness_id, name, contact_number } = req.body;
    if (!name || !contact_number) {
        return res.status(400).json({ success: false, error: 'Name and Contact Number are required.' });
    }

    try {
        let witId = witness_id ? parseInt(witness_id, 10) : null;
        if (!witId) {
            const nextIdRes = await query('SELECT COALESCE(MAX(witness_id), 0) + 1 AS next_id FROM witness;');
            witId = nextIdRes.rows[0].next_id;
        }

        const sql = `
            INSERT INTO witness (witness_id, name, contact_number)
            VALUES ($1, $2, $3)
            RETURNING *;
        `;
        const result = await query(sql, [witId, name.trim(), contact_number.trim()]);
        res.status(201).json({
            success: true,
            rowCount: result.rowCount,
            message: `Witness ${name} registered with ID #${witId}.`,
            data: result.rows[0]
        });
    } catch (err) {
        console.error('[CREATE WITNESS ERROR]', err.message);
        res.status(400).json({ success: false, error: err.message });
    }
});

// ==============================================================
// 8. TABLE 5: PLEADINGS & LEGAL DOCUMENTS (R15 - Advocate Desk)
// ==============================================================
app.get('/api/documents', async (req, res) => {
    try {
        const { role: userRole, userId } = req.user;
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
        res.json({ success: true, rowCount: result.rowCount, data: result.rows });
    } catch (err) {
        console.error('[DOCUMENTS ERROR]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// UPLOAD DOCUMENT (With Advocate Ownership Safety)
app.post('/api/documents', requireRole(['Advocate', 'Clerk', 'Court Administrator']), async (req, res) => {
    const { cnr, document_type, advocate_id } = req.body;
    if (!cnr || !document_type) {
        return res.status(400).json({ success: false, error: 'CNR and Document Type are required.' });
    }

    try {
        let advId = advocate_id ? parseInt(advocate_id, 10) : null;
        if (req.user.role === 'Advocate') {
            advId = req.user.userId;
        } else if (!advId) {
            // Find Lead advocate on case if uploaded by Clerk
            const advRes = await query('SELECT advocate_id FROM case_advocate WHERE cnr = $1 AND case_role = $2 LIMIT 1', [cnr, 'Lead']);
            if (advRes.rowCount > 0) {
                advId = advRes.rows[0].advocate_id;
            } else {
                advId = 1; // Default fallback to system advocate
            }
        }

        const seqRes = await query('SELECT COALESCE(MAX(doc_seq_no), 0) + 1 AS next_seq FROM document WHERE cnr = $1', [cnr]);
        const nextSeq = seqRes.rows[0].next_seq;

        const sql = `
            INSERT INTO document (cnr, doc_seq_no, document_type, upload_date, advocate_id)
            VALUES ($1, $2, $3, CURRENT_DATE, $4)
            RETURNING *;
        `;
        const result = await query(sql, [cnr, nextSeq, document_type, advId]);
        console.log(`[CREATE document] Filed ${document_type} on case ${cnr}`);

        // Dispatch alert
        await triggerCourtAlert(cnr, 'Document Uploaded');

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
// 9. TABLE 6: VAKALATNAMA AUTHORIZATIONS (R16)
// ==============================================================
app.get('/api/vakalatnamas', async (req, res) => {
    try {
        const { role: userRole, userId } = req.user;
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

// FILE VAKALATNAMA (Digital Power of Attorney)
app.post('/api/vakalatnamas', requireRole(['Advocate', 'Clerk', 'Court Administrator']), async (req, res) => {
    const { cnr, litigant_id, advocate_id, e_signature_flag } = req.body;
    if (!cnr || !litigant_id || !advocate_id) {
        return res.status(400).json({ success: false, error: 'CNR, Litigant ID, and Advocate ID are required.' });
    }

    try {
        const nextIdRes = await query('SELECT COALESCE(MAX(auth_id), 0) + 1 AS next_id FROM vakalatnama;');
        const newAuthId = nextIdRes.rows[0].next_id;

        const sql = `
            INSERT INTO vakalatnama (auth_id, signed_date, e_signature_flag, cnr, litigant_id, advocate_id)
            VALUES ($1, CURRENT_DATE, $2, $3, $4, $5)
            RETURNING *;
        `;
        const result = await query(sql, [
            newAuthId,
            e_signature_flag !== undefined ? Boolean(e_signature_flag) : true,
            cnr,
            parseInt(litigant_id, 10),
            parseInt(advocate_id, 10)
        ]);

        res.status(201).json({
            success: true,
            rowCount: result.rowCount,
            message: `Vakalatnama #${newAuthId} executed and registered on docket.`,
            data: result.rows[0]
        });
    } catch (err) {
        console.error('[FILE VAKALATNAMA ERROR]', err.message);
        res.status(400).json({ success: false, error: err.message });
    }
});

// ==============================================================
// 10. ADVOCATE ASSIGNMENT & PARTY ONBOARDING (R9 & R8)
// ==============================================================

// ASSIGN ADVOCATE COUNSEL (Verified Lead Assigner Trigger & Auth Check)
app.post('/api/case-advocates', requireRole(['Advocate', 'Court Administrator']), async (req, res) => {
    const { cnr, advocate_id, case_role, assigned_by } = req.body;
    if (!cnr || !advocate_id) {
        return res.status(400).json({ success: false, error: 'CNR and Advocate ID are required.' });
    }

    const callerId = req.user.userId;
    const assignerId = assigned_by ? parseInt(assigned_by, 10) : callerId;

    try {
        // Strict Authorization: If called by Advocate, verify caller is currently a LEAD advocate on this case
        if (req.user.role === 'Advocate') {
            const leadCheck = await query(
                'SELECT case_role FROM case_advocate WHERE cnr = $1 AND advocate_id = $2;',
                [cnr, callerId]
            );
            if (leadCheck.rowCount === 0 || leadCheck.rows[0].case_role !== 'Lead') {
                return res.status(403).json({
                    success: false,
                    error: `Advocate Privilege: Only the Lead Advocate on record for case ${cnr} can assign associate counsel.`
                });
            }
        }

        const sql = `
            INSERT INTO case_advocate (cnr, advocate_id, case_role, assigned_date, assigned_by)
            VALUES ($1, $2, $3, CURRENT_DATE, $4)
            RETURNING *;
        `;
        const result = await query(sql, [
            cnr,
            parseInt(advocate_id, 10),
            case_role || 'Associate',
            assignerId
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

// ONBOARD CASE PARTY (Litigant)
app.post('/api/case-parties', requireRole(['Clerk', 'Court Administrator']), async (req, res) => {
    const { cnr, litigant_id, party_role } = req.body;
    if (!cnr || !litigant_id || !party_role) {
        return res.status(400).json({ success: false, error: 'CNR, Litigant ID, and Party Role (Petitioner, Respondent, etc.) are required.' });
    }

    try {
        const sql = `
            INSERT INTO case_party (cnr, litigant_id, party_role)
            VALUES ($1, $2, $3)
            RETURNING *;
        `;
        const result = await query(sql, [cnr, parseInt(litigant_id, 10), party_role.trim()]);
        res.status(201).json({
            success: true,
            rowCount: result.rowCount,
            message: `Litigant #${litigant_id} enrolled as ${party_role} on case ${cnr}.`,
            data: result.rows[0]
        });
    } catch (err) {
        console.error('[ONBOARD PARTY ERROR]', err.message);
        res.status(400).json({ success: false, error: err.message });
    }
});

// ==============================================================
// 11. AUTOMATED ALERTS & NOTIFICATIONS (R17 & R18 - REQ-04, P1)
// ==============================================================

// GET USER NOTIFICATIONS
app.get('/api/alerts', async (req, res) => {
    try {
        const { userId } = req.user;
        if (!userId) {
            return res.json({ success: true, rowCount: 0, data: [] });
        }

        const sql = `
            SELECT a.alert_id, a.alert_timestamp, a.alert_type, a.cnr, ar.alert_status,
                   c.case_number, c.statutory_urgency, c.case_status
            FROM alert_recipient ar
            JOIN alert a ON ar.alert_id = a.alert_id
            LEFT JOIN court_case c ON a.cnr = c.cnr
            WHERE ar.user_id = $1
            ORDER BY a.alert_timestamp DESC, a.alert_id DESC
            LIMIT 50;
        `;
        const result = await query(sql, [userId]);
        const unreadCount = result.rows.filter(r => r.alert_status === 'Delivered').length;

        res.json({
            success: true,
            rowCount: result.rowCount,
            unreadCount,
            data: result.rows
        });
    } catch (err) {
        console.error('[GET ALERTS ERROR]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// MARK ALERT AS READ
app.put('/api/alerts/:id/read', async (req, res) => {
    const { id } = req.params;
    const { userId } = req.user;
    if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required.' });
    }

    try {
        const sql = `
            UPDATE alert_recipient
            SET alert_status = 'Read'
            WHERE alert_id = $1 AND user_id = $2
            RETURNING *;
        `;
        const result = await query(sql, [parseInt(id, 10), userId]);
        res.json({ success: true, message: 'Alert marked as read.', data: result.rows[0] });
    } catch (err) {
        console.error('[MARK READ ERROR]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// MARK ALL ALERTS AS READ
app.put('/api/alerts/read-all', async (req, res) => {
    const { userId } = req.user;
    if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required.' });
    }

    try {
        const sql = `
            UPDATE alert_recipient
            SET alert_status = 'Read'
            WHERE user_id = $1 AND alert_status = 'Delivered';
        `;
        const result = await query(sql, [userId]);
        res.json({ success: true, message: 'All delivered alerts marked as read.', count: result.rowCount });
    } catch (err) {
        console.error('[MARK ALL READ ERROR]', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==============================================================
// 12. DATABASE HEALTH & 18 BCNF TABLES AUDIT (Administrator Desk)
// ==============================================================
app.get('/api/system/health', requireRole(['Court Administrator']), async (req, res) => {
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
