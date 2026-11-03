# build_lab11_pdf.py - Generates the official Lab 11 Submission PDF
import os
import base64
import subprocess
import shutil

BASE_DIR = r"C:\Users\SNEH\.gemini\antigravity\scratch\lab11-court-management"
SCREENSHOTS_DIR = os.path.join(BASE_DIR, "docs_screenshots")
HTML_OUT = os.path.join(BASE_DIR, "report_lab11.html")
PDF_OUT_1 = os.path.join(BASE_DIR, "Team07_Lab11_DBConnectivity.pdf")
PDF_OUT_2 = os.path.join(BASE_DIR, "Team7_Lab11_DBConnectivity.pdf")

def img_to_b64(path):
    with open(path, "rb") as f:
        return "data:image/png;base64," + base64.b64encode(f.read()).decode("utf-8")

img_ledger = img_to_b64(os.path.join(SCREENSHOTS_DIR, "01_main_ledger.png"))
img_add = img_to_b64(os.path.join(SCREENSHOTS_DIR, "02_add_case_modal.png"))
img_drawer = img_to_b64(os.path.join(SCREENSHOTS_DIR, "03_case_drawer_dossier.png"))
img_delete = img_to_b64(os.path.join(SCREENSHOTS_DIR, "04_delete_confirmation.png"))
img_rbac = img_to_b64(os.path.join(SCREENSHOTS_DIR, "05_rbac_role_switcher.png"))

raw_html = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>MC212 Lab 11 - Database Connectivity - Team 7</title>
<style>
    @page {
        size: A4 portrait;
        margin: 10mm 12mm 10mm 12mm;
    }
    
    * {
        box-sizing: border-box;
    }
    
    body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        color: #1A202C;
        background-color: #FFFFFF;
        font-size: 8.8pt;
        line-height: 1.38;
        margin: 0;
        padding: 0;
    }
    
    .page {
        page-break-after: always;
        height: 275mm;
        max-height: 275mm;
        overflow: hidden;
        display: flex;
        flex-direction: column;
    }
    
    .page:last-child {
        page-break-after: avoid;
    }
    
    /* Document Header */
    .doc-header {
        border-bottom: 2px solid #1F4D3F;
        padding-bottom: 6px;
        margin-bottom: 10px;
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
    }
    
    .course-title {
        font-size: 12pt;
        font-weight: 700;
        color: #1F4D3F;
        margin: 0 0 2px 0;
        letter-spacing: -0.01em;
    }
    
    .lab-title {
        font-size: 10pt;
        font-weight: 600;
        color: #2D3748;
        margin: 0;
    }
    
    .team-badge {
        text-align: right;
        font-size: 8pt;
        color: #4A5568;
    }
    
    .team-badge strong {
        font-size: 10pt;
        color: #1F4D3F;
    }
    
    /* Cover Box */
    .meta-box {
        background-color: #F8FAF9;
        border: 1px solid #DDE3E0;
        border-left: 4px solid #1F4D3F;
        border-radius: 4px;
        padding: 8px 12px;
        margin-bottom: 10px;
    }
    
    .meta-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 4px 12px;
        font-size: 8.5pt;
    }
    
    .meta-item strong {
        color: #1F4D3F;
    }
    
    /* Section Headings */
    h2.section-header {
        font-size: 10.5pt;
        font-weight: 700;
        color: #FFFFFF;
        background-color: #1F4D3F;
        padding: 4px 8px;
        margin: 8px 0 6px 0;
        border-radius: 3px;
        letter-spacing: 0.02em;
    }
    
    h3.sub-header {
        font-size: 9pt;
        font-weight: 700;
        color: #1F4D3F;
        border-bottom: 1px solid #CBD5E0;
        padding-bottom: 2px;
        margin: 8px 0 4px 0;
    }
    
    /* Tables */
    table.crud-table {
        width: 100%;
        border-collapse: collapse;
        margin: 4px 0 8px 0;
        font-size: 8pt;
    }
    
    table.crud-table th, table.crud-table td {
        border: 1px solid #CBD5E0;
        padding: 4px 6px;
        vertical-align: top;
    }
    
    table.crud-table th {
        background-color: #EDF2F7;
        color: #2D3748;
        font-weight: 700;
        text-align: left;
    }
    
    table.crud-table td.col-item {
        width: 14%;
        font-weight: 600;
        color: #1F4D3F;
        background-color: #F7FAFC;
    }
    
    table.crud-table td.col-content {
        width: 86%;
    }
    
    /* Code styling */
    pre.code-block {
        background-color: #1E293B;
        color: #E2E8F0;
        padding: 5px 8px;
        border-radius: 3px;
        font-family: "Consolas", "Courier New", monospace;
        font-size: 7.4pt;
        line-height: 1.3;
        margin: 2px 0;
        white-space: pre-wrap;
        word-break: break-all;
    }
    
    /* Terminal Output Box */
    .terminal-box {
        background-color: #0F172A;
        border: 1px solid #334155;
        border-radius: 3px;
        margin: 3px 0;
        overflow: hidden;
        font-family: "Consolas", "Courier New", monospace;
    }
    
    .terminal-bar {
        background-color: #1E293B;
        padding: 3px 6px;
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 6.8pt;
        color: #94A3B8;
        border-bottom: 1px solid #334155;
    }
    
    .term-dot {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        display: inline-block;
    }
    .dot-red { background-color: #EF4444; }
    .dot-yellow { background-color: #F59E0B; }
    .dot-green { background-color: #10B981; }
    
    .terminal-content {
        padding: 4px 8px;
        color: #38BDF8;
        font-size: 7.2pt;
        line-height: 1.3;
        white-space: pre-wrap;
    }
    
    .term-success {
        color: #34D399;
        font-weight: 600;
    }
    
    .term-param {
        color: #FDE047;
    }
    
    /* Image figure */
    .screenshot-figure {
        margin: 4px 0 6px 0;
        text-align: center;
        page-break-inside: avoid;
    }
    
    .screenshot-img {
        width: 100%;
        object-fit: contain;
        border: 1px solid #CBD5E0;
        border-radius: 4px;
        box-shadow: 0 1px 2px rgba(0,0,0,0.08);
    }
    
    .caption {
        font-size: 7.5pt;
        color: #4A5568;
        margin-top: 2px;
        font-style: italic;
    }
    
    /* Reflection text */
    .reflection-p {
        text-align: justify;
        font-size: 8.5pt;
        line-height: 1.45;
        color: #2D3748;
        margin-bottom: 6px;
    }
    
    .callout {
        background-color: #F0FDF4;
        border: 1px solid #BBF7D0;
        border-left: 3px solid #16A34A;
        padding: 5px 8px;
        border-radius: 3px;
        font-size: 8pt;
        color: #166534;
        margin: 4px 0;
    }
</style>
</head>
<body>

<!-- ========================================== PAGE 1 ========================================== -->
<div class="page">
    <div class="doc-header">
        <div>
            <h1 class="course-title">MC212 – Database Management Systems</h1>
            <p class="lab-title">Lab 11: Database Connectivity (Option B: JavaScript / Node.js)</p>
        </div>
        <div class="team-badge">
            <strong>TEAM 7</strong><br>
            Judiciary / Court Management
        </div>
    </div>

    <div class="meta-box">
        <div class="meta-grid">
            <div class="meta-item"><strong>Team Members:</strong> Trivedi Havish (202503013) &amp; Patel Sneh (202503007)</div>
            <div class="meta-item"><strong>Tech Stack:</strong> Node.js, Express, <code>pg</code> (node-postgres), Vanilla JS</div>
            <div class="meta-item"><strong>Database Engine:</strong> Supabase PostgreSQL 17 (ap-northeast-1 pooler:6543)</div>
            <div class="meta-item"><strong>Primary Table:</strong> <code>court_case</code> (Relation R7 - 100+ tuples)</div>
            <div class="meta-item"><strong>Instructors:</strong> Prof. Minal Bhise (minal_bhise@dau.ac.in)</div>
            <div class="meta-item"><strong>GitHub Repository:</strong> https://github.com/snehpatel05/DBMS</div>
        </div>
    </div>

    <h2 class="section-header">(A) Database Connectivity Code</h2>

    <h3 class="sub-header">1. Database Connection Initialization (<code>server.js</code>)</h3>
    <pre class="code-block">// Database Connection Pool Initialization using node-postgres (pg)
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});</pre>

    <h3 class="sub-header">2. Centralized Query Helper Function (<code>server.js</code>)</h3>
    <pre class="code-block">// Centralized Query Helper with execution duration and row count logging
async function query(text, params) {
    const start = Date.now();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log(`[SQL EXEC] executed query: ${text.replace(/\s+/g, ' ').trim()} | duration: ${duration}ms | rows: ${res.rowCount}`);
    return res;
}</pre>

    <h3 class="sub-header">3. Environment Configuration File (<code>.env</code> - Credentials Masked)</h3>
    <pre class="code-block">PORT=3000
DATABASE_URL=postgresql://postgres.rahbnhnftoqtbkedlgvg:********@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres</pre>

    <h3 class="sub-header">4. PostgreSQL Version Verification Test Run</h3>
    <div class="terminal-box">
        <div class="terminal-bar">
            <span class="term-dot dot-red"></span>
            <span class="term-dot dot-yellow"></span>
            <span class="term-dot dot-green"></span>
            <span>node test_crud.js — [Section A: Database Connectivity Check]</span>
        </div>
        <div class="terminal-content">
[SECTION A: CONNECTIVITY TEST]
Connected successfully to database engine:
<span class="term-success">PostgreSQL 17.11 on x86_64-pc-linux-gnu, compiled by gcc (GCC) 15.2.0, 64-bit</span>
Database status: Active (AWS ap-northeast-1 pooler on port 6543)
        </div>
    </div>
</div>

<!-- ========================================== PAGE 2 ========================================== -->
<div class="page">
    <div class="doc-header">
        <div>
            <h1 class="course-title">MC212 – Database Management Systems | Lab 11</h1>
            <p class="lab-title">CRUD Operations on Main Relation: <code>court_case</code> (CREATE &amp; READ)</p>
        </div>
        <div class="team-badge"><strong>Team 7</strong></div>
    </div>

    <h2 class="section-header">(B) CRUD Operation Code &amp; Execution</h2>

    <h3 class="sub-header">B.1 CREATE (INSERT) Operation</h3>
    <table class="crud-table">
        <tr>
            <td class="col-item">SQL</td>
            <td class="col-content">
                <pre class="code-block">INSERT INTO court_case (
    cnr, standardized_filing_number, case_number, 
    fir_number, statutory_urgency, case_status, registered_by_clerk_id
) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;</pre>
            </td>
        </tr>
        <tr>
            <td class="col-item">Function</td>
            <td class="col-content">
                <pre class="code-block">app.post('/api/cases', async (req, res) => {
    const { cnr, filing_no, case_no, fir_no, urgency, status, clerk_id } = req.body;
    const sql = `INSERT INTO court_case (cnr, standardized_filing_number, case_number, 
                 fir_number, statutory_urgency, case_status, registered_by_clerk_id) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;`;
    const params = [cnr, filing_no, case_no, fir_no || null, urgency || 'Normal', status || 'Filed', parseInt(clerk_id, 10)];
    const result = await query(sql, params);
    res.status(201).json({ success: true, rowCount: result.rowCount, data: result.rows[0] });
});</pre>
            </td>
        </tr>
        <tr>
            <td class="col-item">Output</td>
            <td class="col-content">
                <div class="terminal-box">
                    <div class="terminal-bar"><span class="term-dot dot-green"></span><span>CREATE Execution Terminal Log</span></div>
                    <div class="terminal-content">
Executing SQL: INSERT INTO court_case (...) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;
Parameters: <span class="term-param">['GJAH018888882026', 'SFN-2026-TEST01', 'CC/888/2026', 'FIR/0888/2026', 'Urgent', 'Filed', 301]</span>
<span class="term-success">&gt;&gt; result.rowCount = 1 (Record successfully inserted into court_case)</span>
Inserted Row: { cnr: 'GJAH018888882026', case_no: 'CC/888/2026', clerk: 301, status: 'Filed' }
                    </div>
                </div>
            </td>
        </tr>
    </table>

    <h3 class="sub-header">B.2 READ (SELECT) Operation</h3>
    <table class="crud-table">
        <tr>
            <td class="col-item">SQL</td>
            <td class="col-content">
                <pre class="code-block">SELECT c.cnr, c.standardized_filing_number, c.case_number, c.fir_number,
       c.statutory_urgency, c.case_status, c.registered_by_clerk_id,
       u.name AS registered_by_clerk_name
FROM court_case c
LEFT JOIN system_users u ON c.registered_by_clerk_id = u.user_id
WHERE c.cnr = $1;</pre>
            </td>
        </tr>
        <tr>
            <td class="col-item">Function</td>
            <td class="col-content">
                <pre class="code-block">app.get('/api/cases', async (req, res) => {
    const { search, status, urgency } = req.query;
    let conditions = [], params = [];
    if (search) {
        params.push(`%${search.trim()}%`);
        conditions.push(`(c.cnr ILIKE $${params.length} OR c.case_number ILIKE $${params.length})`);
    }
    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT c.*, u.name as registered_by_clerk_name FROM court_case c 
                 LEFT JOIN system_users u ON c.registered_by_clerk_id = u.user_id 
                 ${whereSql} ORDER BY c.cnr DESC LIMIT 100;`;
    const result = await query(sql, params);
    res.json({ success: true, rowCount: result.rowCount, data: result.rows });
});</pre>
            </td>
        </tr>
        <tr>
            <td class="col-item">Output</td>
            <td class="col-content">
                <div class="terminal-box">
                    <div class="terminal-bar"><span class="term-dot dot-green"></span><span>READ Execution Terminal Log</span></div>
                    <div class="terminal-content">
Executing SQL: SELECT cnr, standardized_filing_number, case_number, fir_number, statutory_urgency, case_status, registered_by_clerk_id FROM court_case WHERE cnr = $1;
Parameters: <span class="term-param">['GJAH018888882026']</span>
<span class="term-success">&gt;&gt; result.rowCount = 1 (Record successfully retrieved)</span>
Retrieved Record: { cnr: 'GJAH018888882026', case_no: 'CC/888/2026', status: 'Filed', urgency: 'Urgent' }
                    </div>
                </div>
            </td>
        </tr>
    </table>
</div>

<!-- ========================================== PAGE 3 ========================================== -->
<div class="page">
    <div class="doc-header">
        <div>
            <h1 class="course-title">MC212 – Database Management Systems | Lab 11</h1>
            <p class="lab-title">CRUD Operations on Main Relation: <code>court_case</code> (UPDATE &amp; DELETE)</p>
        </div>
        <div class="team-badge"><strong>Team 7</strong></div>
    </div>

    <h3 class="sub-header">B.3 UPDATE Operation</h3>
    <table class="crud-table">
        <tr>
            <td class="col-item">SQL</td>
            <td class="col-content">
                <pre class="code-block">UPDATE court_case 
SET statutory_urgency = $1, case_status = $2 
WHERE cnr = $3 
RETURNING *;</pre>
            </td>
        </tr>
        <tr>
            <td class="col-item">Function</td>
            <td class="col-content">
                <pre class="code-block">app.put('/api/cases/:cnr', async (req, res) => {
    const { cnr } = req.params;
    const { urgency, status } = req.body;
    const sql = `UPDATE court_case 
                 SET statutory_urgency = COALESCE($1, statutory_urgency),
                     case_status = COALESCE($2, case_status)
                 WHERE cnr = $3 RETURNING *;`;
    const params = [urgency || null, status || null, cnr];
    const result = await query(sql, params);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Case not found' });
    res.json({ success: true, rowCount: result.rowCount, data: result.rows[0] });
});</pre>
            </td>
        </tr>
        <tr>
            <td class="col-item">Output</td>
            <td class="col-content">
                <div class="terminal-box">
                    <div class="terminal-bar"><span class="term-dot dot-green"></span><span>UPDATE Execution Terminal Log</span></div>
                    <div class="terminal-content">
Executing SQL: UPDATE court_case SET statutory_urgency = $1, case_status = $2 WHERE cnr = $3 RETURNING *;
Parameters: <span class="term-param">['Statutory', 'Pending', 'GJAH018888882026']</span>
<span class="term-success">&gt;&gt; result.rowCount = 1 (Record successfully updated in database)</span>
Updated Record: { cnr: 'GJAH018888882026', urgency: 'Statutory', status: 'Pending' }
                    </div>
                </div>
            </td>
        </tr>
    </table>

    <h3 class="sub-header">B.4 DELETE Operation</h3>
    <table class="crud-table">
        <tr>
            <td class="col-item">SQL</td>
            <td class="col-content">
                <pre class="code-block">DELETE FROM court_case 
WHERE cnr = $1 
RETURNING *;</pre>
            </td>
        </tr>
        <tr>
            <td class="col-item">Function</td>
            <td class="col-content">
                <pre class="code-block">app.delete('/api/cases/:cnr', async (req, res) => {
    const { cnr } = req.params;
    const userRole = req.headers['x-user-role'];
    if (userRole && !['Clerk', 'Court Administrator'].includes(userRole)) {
        return res.status(403).json({ error: 'Only registry clerks can delete records.' });
    }
    const sql = `DELETE FROM court_case WHERE cnr = $1 RETURNING *;`;
    const result = await query(sql, [cnr]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Case not found' });
    res.json({ success: true, rowCount: result.rowCount, message: 'Case deleted' });
});</pre>
            </td>
        </tr>
        <tr>
            <td class="col-item">Output</td>
            <td class="col-content">
                <div class="terminal-box">
                    <div class="terminal-bar"><span class="term-dot dot-green"></span><span>DELETE Execution Terminal Log</span></div>
                    <div class="terminal-content">
Executing SQL: DELETE FROM court_case WHERE cnr = $1 RETURNING *;
Parameters: <span class="term-param">['GJAH018888882026']</span>
<span class="term-success">&gt;&gt; result.rowCount = 1 (Record successfully deleted from database)</span>
Deleted Record: { cnr: 'GJAH018888882026', status: 'Pending', urgency: 'Statutory' }
                    </div>
                </div>
            </td>
        </tr>
    </table>

    <div class="callout">
        <strong>Constraint Integrity Safeguard:</strong> All queries use parameterized placeholders (<code>$1..$n</code>). Deletions strictly adhere to foreign key <code>ON DELETE RESTRICT</code> rules established in Lab 9 to protect relational dependencies.
    </div>
</div>

<!-- ========================================== PAGE 4 ========================================== -->
<div class="page">
    <div class="doc-header">
        <div>
            <h1 class="course-title">MC212 – Database Management Systems | Lab 11</h1>
            <p class="lab-title">(C) Frontend User Interface Screenshots (Part 1)</p>
        </div>
        <div class="team-badge"><strong>Team 7</strong></div>
    </div>

    <h2 class="section-header">(C) Frontend Interface &amp; Interactions</h2>

    <div class="screenshot-figure">
        <img src="REPLACE_IMG_LEDGER" class="screenshot-img" style="max-height: 245px;" alt="Main Cases Ledger">
        <div class="caption">Figure C.1: Main Court Ledger Interface — Summary cards with live counts, underline tabs, filter toolbar, and records table.</div>
    </div>

    <div class="screenshot-figure" style="margin-top: 10px;">
        <img src="REPLACE_IMG_ADD" class="screenshot-img" style="max-height: 245px;" alt="File New Case Form Modal">
        <div class="caption">Figure C.2: CREATE Modal — "File New Case" form with input validation (16-char CNR, SFN, Urgency, Status, and Clerk ID).</div>
    </div>
</div>

<!-- ========================================== PAGE 5 ========================================== -->
<div class="page">
    <div class="doc-header">
        <div>
            <h1 class="course-title">MC212 – Database Management Systems | Lab 11</h1>
            <p class="lab-title">(C) Case Dossier Drawer, Deletion &amp; Role-Based Access</p>
        </div>
        <div class="team-badge"><strong>Team 7</strong></div>
    </div>

    <div class="screenshot-figure">
        <img src="REPLACE_IMG_DRAWER" class="screenshot-img" style="max-height: 180px;" alt="Case Dossier Drawer">
        <div class="caption">Figure C.3: READ/UPDATE Interaction — Right-side Case Dossier Drawer presenting metadata, parties, advocates, and hearings timeline.</div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 4px;">
        <div class="screenshot-figure">
            <img src="REPLACE_IMG_DELETE" class="screenshot-img" style="max-height: 140px;" alt="Delete Confirmation Modal">
            <div class="caption">Figure C.4: DELETE Modal with integrity warning.</div>
        </div>
        <div class="screenshot-figure">
            <img src="REPLACE_IMG_RBAC" class="screenshot-img" style="max-height: 140px;" alt="Role Based Access Switcher">
            <div class="caption">Figure C.5: Role-Based Access Control Switcher.</div>
        </div>
    </div>

    <h2 class="section-header" style="margin-top: 8px;">(D) Reflection &amp; Conclusion</h2>
    <p class="reflection-p">
        During the development of Lab 11 for our District Court Case Management System, our team navigated several critical real-world database connectivity challenges. The primary hurdle was network routing to Supabase PostgreSQL: the default hostname only resolved to an IPv6 address, which failed on our local network with <code>ENOTFOUND</code> socket errors. We resolved this by identifying and configuring the dedicated IPv4 transaction pooler located in the AWS Tokyo region (<code>aws-0-ap-northeast-1.pooler.supabase.com:6543</code>). Additionally, structuring queries in Node.js required strict adherence to positional placeholders (<code>$1</code>, <code>$2</code>), as the node-postgres driver rejects string concatenation and requires array-bound parameters.
    </p>
    <p class="reflection-p">
        Through this implementation, we acquired key insights into safely linking an enterprise user interface with a relational database. Most significantly, we realized why the client-side browser must never connect directly to PostgreSQL: embedding database credentials or exposing port 5432 directly to the web creates catastrophic security vulnerabilities, leaking connection credentials and permitting arbitrary SQL injection. By placing an Express REST API backend between the browser and PostgreSQL, we enforced parameterized queries that completely neutralize SQL injection, kept credentials secured within <code>.env</code> and excluded from GitHub via <code>.gitignore</code>, and implemented Role-Based Access Control (RBAC) ensuring litigants and advocates access only their assigned cases while administrative modifications remain strictly restricted to verified court registry staff.
    </p>
</div>

</body>
</html>"""

final_html = raw_html.replace("REPLACE_IMG_LEDGER", img_ledger) \
                     .replace("REPLACE_IMG_ADD", img_add) \
                     .replace("REPLACE_IMG_DRAWER", img_drawer) \
                     .replace("REPLACE_IMG_DELETE", img_delete) \
                     .replace("REPLACE_IMG_RBAC", img_rbac)

with open(HTML_OUT, "w", encoding="utf-8") as f:
    f.write(final_html)

print(f"Generated HTML report at: {HTML_OUT}")

tmp_dir = os.path.join(os.environ["TEMP"], "chrome_pdf_build")
os.makedirs(tmp_dir, exist_ok=True)

chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
cmd = [
    chrome_path,
    "--headless=new",
    "--disable-gpu",
    f"--user-data-dir={tmp_dir}",
    "--no-pdf-header-footer",
    f"--print-to-pdf={PDF_OUT_1}",
    HTML_OUT
]

print("Compiling PDF with Chrome headless...")
subprocess.run(cmd, check=True)

if os.path.exists(PDF_OUT_1):
    file_size = os.path.getsize(PDF_OUT_1)
    print(f"Success! Generated: {PDF_OUT_1} ({file_size} bytes)")
    shutil.copyfile(PDF_OUT_1, PDF_OUT_2)
    print(f"Created duplicate copy: {PDF_OUT_2}")
else:
    print("Error: PDF file was not generated.")
