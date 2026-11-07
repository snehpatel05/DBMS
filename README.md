# 🏛️ District Court Case Management System
### MC212 Database Management Systems — Lab 11: Database Connectivity Project
**Team Number:** Team 7  
**Team Members:**  
* **Patel Sneh Champakkumar** (`202503007`)  
* **Trivedi Havish Ashishkumar** (`202503013`)  

---

## 🌐 Live Production Deployment & Links

| Resource | Direct URL Link | Status |
| :--- | :--- | :--- |
| **🚀 Live Working Application** | **[https://dbms-iota-three.vercel.app/](https://dbms-iota-three.vercel.app/)** | ![Production Active](https://img.shields.io/badge/Vercel-Live%20Deployment-10B981?style=flat&logo=vercel) |
| **📦 GitHub Source Repositories** | **[havishtrivedi07/DBMS](https://github.com/havishtrivedi07/DBMS)** (Active Primary) • **[snehpatel05/DBMS](https://github.com/snehpatel05/DBMS)** (Fork Upstream) | ![GitHub Repo](https://img.shields.io/badge/GitHub-havishtrivedi07%2FDBMS-181717?style=flat&logo=github) |
| **🗄️ PostgreSQL Cloud Instance** | `aws-0-ap-northeast-1.pooler.supabase.com:6543` | ![PostgreSQL 17](https://img.shields.io/badge/PostgreSQL-17.11%20(Supabase)-4169E1?style=flat&logo=postgresql) |

> **Default Opening State:** When opening the live URL, the system automatically lands on **Clerk Rajesh Sharma (ID: 301)** on the primary **Cases Registry** ledger with full plaint intake permissions. Role-switching to Judge (Hon'ble Justice R. K. Iyer), Advocate (Sr. Adv. Ananya Desai / Adv. Aditya Patel), Litigant (Citizen Aarav Joshi), or Court Administrator (Administrator Vikram Malhotra) can be performed anytime via the top-right profile badge.

---

## 📋 Technology Stack (Option B: JavaScript / Node.js)

* **Database Engine:** PostgreSQL 17.11 (Relational cloud database hosted on Supabase Tokyo `ap-northeast-1`).
* **Database Driver:** `pg` (`node-postgres` v8.11+) connection pool with SSL TLS termination.
* **Backend Framework:** Node.js with Express.js REST API layer (`server.js`).
* **Frontend Architecture:** Professional Government Docket UI (`HTML5`, `CSS3`, vanilla `JavaScript` with `fetch` API, Source Sans 3 typography, monospace CNRs, and responsive modal/drawer dialogs).
* **Security & SQL Safety:** 100% Parameterized queries (`$1, $2, ...` with value arrays across all endpoints) to completely eliminate SQL Injection; cryptographic HMAC-SHA256 session token authentication (`authenticateUser`); environment credentials isolated via `dotenv`.
* **Enterprise Hardening:** Strict multi-role middleware (`authenticateUser`, `requireRole`), Bench Note Privacy (`CASE` projection masking for non-judges), Two-Step Judicial Order workflow, and Statutory Cause List Prioritization.

---

## 🛡️ Enterprise Hardening & SRS Compliance (Real-World District Judiciary Rules)

| Security / Business Control | Implementation Details & Real-World Justification |
| :--- | :--- |
| **🔒 Judicial Bench Note Privacy (SRS 4.1)** | Private judicial minutes and observations (`bench_note` in R11) are projected as `NULL` for Advocates, Litigants, Clerks, and even other Judges. Only the authoring Presiding Judge on that assigned hearing receives notes. |
| **⚡ Statutory Cause List Generation (REQ-05, P1)** | Priority sorting engine (`/api/causelists/generate`) ordering daily court rosters by: **1)** Statutory Urgency (`Urgent` > `Statutory` > `Normal`), **2)** Active Witness Presence (`summons` count), and **3)** Longest Pending Filing Age tiebreaker. |
| **🔔 Automated Court Notifications (REQ-04, P1)** | Dual-table notification architecture (`alert` R17 + `alert_recipient` R18) automatically dispatching unread alerts to parties and counsel when trial dates are scheduled, decrees published, or pleadings uploaded. |
| **⚖️ Two-Step Order Pronouncement** | Judges draft and reserve judicial orders (`published_date = NULL`). Decrees only take legal force when deliberately signed and published in open court. |
| **🛑 Irreversible Case Disposal Guard** | Clerks cannot manually alter case status to `Disposed`. Case disposal is an exclusive judicial act triggered automatically upon the Judge publishing a `Final Judgment`. Once disposed, case records are permanently sealed. |
| **🔍 Multi-Parameter Subquery Search (REQ-02)** | Search bar matches across Case No, CNR, Filing No, FIR Number, Litigant Party Name (`case_party` + `system_users`), and Retained Advocate Name (`case_advocate` + `system_users`). |
| **📜 Lead Advocate Retainer Check (R9 Trigger)** | Verifies caller is actively enrolled as `Lead` Counsel on record before allowing assignment of associate advocates (`fn_check_assigner_is_lead`). |

---

# (A) Database Connectivity Code

### 1. Connection Pool Initialization (`db.js`)
The database connection pool is created in `db.js` using the official `pg` (`node-postgres`) driver. It utilizes a pooled client architecture with SSL TLS configuration for secure communication with Supabase:

```javascript
// db.js - PostgreSQL Connection Pool Setup
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Required for Supabase IPv4 transaction pooler over TLS
    },
    max: 20,                      // Maintain up to 20 concurrent connections in pool
    idleTimeoutMillis: 30000,     // Close idle clients after 30 seconds
    connectionTimeoutMillis: 2000 // Timeout acquisition after 2 seconds
});

// Pool lifecycle logging
pool.on('connect', () => {
    // Client checked out from pool
});

pool.on('error', (err) => {
    console.error('[DATABASE POOL ERROR] Unexpected client error:', err.message);
});

module.exports = { pool };
```

### 2. Centralized Query Helper Function
All database interactions flow through a centralized, parameterized execution helper that guarantees safe query dispatch and consistent logging:

```javascript
// Centralized Query Helper with Parameterization
async function query(text, params) {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        console.log(`[SQL EXEC] ${text.trim().substring(0, 50)}... | Duration: ${duration}ms | Rows: ${res.rowCount}`);
        return res;
    } catch (err) {
        console.error('[SQL ERROR]', err.message);
        throw err;
    }
}
```

### 3. Connection Settings File (`.env` — Password Masked)
Per security requirements, raw passwords are never hardcoded or pushed to version control. The `.env` file is git-ignored:

```ini
# .env Configuration (Sensitive Credentials Isolated)
PORT=3000
DATABASE_URL=postgresql://postgres.snehpatel:[PASSWORD-MASKED]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres
NODE_ENV=production
```

### 4. Database Connection Verification Test (`SELECT version()`)
The verification script (`test-conn.js`) executes `SELECT version();` over the connection pool to verify live connectivity with Supabase:

```javascript
// test-conn.js - Connection verification and PostgreSQL version check
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
    } catch (err) {
        console.error("Connection failed:", err.message);
    }
}

verifyDatabaseConnection();
```

**Live Windows PowerShell Verification Screenshot (User Environment):**
![Windows PowerShell Database Connection Test](docs/screenshots/00_powershell_test_conn.png)

*The terminal execution proves that our Node.js client successfully negotiates TLS with PostgreSQL 17.11 on Supabase in region `ap-northeast-1` with roundtrip latency under 1200ms and returns `result.rowCount = 1`.*

---

# (B) CRUD Operation Code (`court_case` Table)

Each subsection below presents the exact SQL query with placeholders, the Express route handler, and the output verification showing `result.rowCount = 1`.

---

### 1. CREATE (INSERT)

| Item | What to include |
| :--- | :--- |
| **SQL** | Exact parameterized `INSERT` statement with `$1..$7` placeholders:<br>```sql<br>INSERT INTO court_case (<br>    cnr, standardized_filing_number, case_number,<br>    fir_number, statutory_urgency, case_status, registered_by_clerk_id<br>)<br>VALUES ($1, $2, $3, $4, $5, $6, $7)<br>RETURNING cnr, case_number, statutory_urgency, case_status;<br>``` |
| **Function** | **Node.js Express Route Handler (`server.js`):**<br>```javascript<br>app.post('/api/cases', authenticateUser, requireRole(['Clerk']), async (req, res) => {<br>    const { cnr, standardized_filing_number, case_number, fir_number, statutory_urgency, case_status } = req.body;<br>    const clerkId = req.userId || 301;<br>    const sql = `<br>        INSERT INTO court_case (<br>            cnr, standardized_filing_number, case_number,<br>            fir_number, statutory_urgency, case_status, registered_by_clerk_id<br>        )<br>        VALUES ($1, $2, $3, $4, $5, $6, $7)<br>        RETURNING *;<br>    `;<br>    const params = [cnr, standardized_filing_number, case_number, fir_number || null, statutory_urgency, case_status || 'Filed', clerkId];<br>    const result = await pool.query(sql, params);<br>    res.status(201).json({ success: true, rowCount: result.rowCount, data: result.rows[0] });<br>});<br>``` |
| **Output** | **Terminal Execution Log (`result.rowCount = 1`):**<br>```text<br>[INSERT RESULT] Rows affected (result.rowCount) = 1<br>Inserted Record: {<br>  cnr: 'GJAH018888882026',<br>  case_number: 'CC/888/2026',<br>  statutory_urgency: 'Normal',<br>  case_status: 'Filed'<br>}<br>``` |

---

### 2. READ (SELECT)

| Item | What to include |
| :--- | :--- |
| **SQL** | Exact parameterized `SELECT` statement with search, filter, and pagination placeholders:<br>```sql<br>SELECT cnr, standardized_filing_number, case_number, fir_number,<br>       statutory_urgency, case_status, registered_by_clerk_id<br>FROM court_case<br>WHERE ($1::text IS NULL OR statutory_urgency = $1)<br>  AND ($2::text IS NULL OR case_status = $2)<br>  AND ($3::text IS NULL OR cnr ILIKE $3 OR case_number ILIKE $3)<br>ORDER BY cnr ASC<br>LIMIT $4;<br>``` |
| **Function** | **Node.js Express Route Handler (`server.js`):**<br>```javascript<br>app.get('/api/cases', authenticateUser, async (req, res) => {<br>    const { urgency, status, search, limit, offset } = req.query;<br>    let conditions = [];<br>    let params = [];<br>    if (urgency && urgency !== 'ALL') {<br>        params.push(urgency);<br>        conditions.push(`c.statutory_urgency = $${params.length}`);<br>    }<br>    if (status && status !== 'ALL') {<br>        params.push(status);<br>        conditions.push(`c.case_status = $${params.length}`);<br>    }<br>    if (search) {<br>        params.push(`%${search.trim()}%`);<br>        const idx = params.length;<br>        conditions.push(`(<br>            c.cnr ILIKE $${idx} OR c.case_number ILIKE $${idx} OR c.standardized_filing_number ILIKE $${idx}<br>            OR (c.fir_number IS NOT NULL AND c.fir_number ILIKE $${idx})<br>            OR EXISTS (SELECT 1 FROM case_party cp JOIN system_users su ON cp.litigant_id = su.user_id WHERE cp.cnr = c.cnr AND su.name ILIKE $${idx})<br>            OR EXISTS (SELECT 1 FROM case_advocate ca JOIN system_users su ON ca.advocate_id = su.user_id WHERE ca.cnr = c.cnr AND su.name ILIKE $${idx})<br>        )`);<br>    }<br>    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';<br>    params.push(parseInt(limit || '25', 10));<br>    const limitIdx = params.length;<br>    params.push(parseInt(offset || '0', 10));<br>    const offsetIdx = params.length;<br>    const sql = `SELECT c.* FROM court_case c ${whereClause} ORDER BY c.cnr ASC LIMIT $${limitIdx} OFFSET $${offsetIdx};`;<br>    const result = await pool.query(sql, params);<br>    res.json({ success: true, rowCount: result.rowCount, data: result.rows });<br>});<br>``` |
| **Output** | **Terminal Execution Log (`result.rowCount = 1`):**<br>```text<br>[SELECT RESULT] Rows fetched (result.rowCount) = 1<br>Retrieved Row: {<br>  cnr: 'GJAH018888882026',<br>  standardized_filing_number: 'SFN-2026-008888',<br>  case_number: 'CC/888/2026',<br>  fir_number: 'FIR/0088/2026',<br>  statutory_urgency: 'Normal',<br>  case_status: 'Filed',<br>  registered_by_clerk_id: 301<br>}<br>``` |

---

### 3. UPDATE

| Item | What to include |
| :--- | :--- |
| **SQL** | Exact parameterized `UPDATE` statement with mandatory `WHERE` clause:<br>```sql<br>UPDATE court_case<br>SET statutory_urgency = COALESCE($1, statutory_urgency),<br>    case_status = COALESCE($2, case_status),<br>    fir_number = COALESCE($3, fir_number)<br>WHERE cnr = $4<br>RETURNING cnr, case_number, statutory_urgency, case_status, fir_number;<br>``` |
| **Function** | **Node.js Express Route Handler (`server.js`):**<br>```javascript<br>app.put('/api/cases/:cnr', authenticateUser, requireRole(['Clerk']), async (req, res) => {<br>    const { cnr } = req.params;<br>    const { urgency, status, fir_no } = req.body;<br>    const currentCase = await pool.query('SELECT case_status FROM court_case WHERE cnr = $1', [cnr]);<br>    if (currentCase.rowCount === 0) return res.status(404).json({ success: false, error: 'Case not found' });<br>    if (currentCase.rows[0].case_status === 'Disposed') {<br>        return res.status(400).json({ success: false, error: 'Cannot modify a Disposed case.' });<br>    }<br>    if (status === 'Disposed') {<br>        return res.status(400).json({ success: false, error: 'Case disposal is exclusive to Final Judgment publication.' });<br>    }<br>    if (currentCase.rows[0].case_status === 'Pending' && status === 'Filed') {<br>        return res.status(400).json({ success: false, error: 'Cannot revert a Pending case back to Filed.' });<br>    }<br>    const sql = `<br>        UPDATE court_case<br>        SET statutory_urgency = COALESCE($1, statutory_urgency),<br>            case_status = COALESCE($2, case_status),<br>            fir_number = COALESCE($3, fir_number)<br>        WHERE cnr = $4<br>        RETURNING *;<br>    `;<br>    const result = await pool.query(sql, [urgency || null, status || null, fir_no || null, cnr]);<br>    res.json({ success: true, rowCount: result.rowCount, data: result.rows[0] });<br>});<br>``` |
| **Output** | **Terminal Execution Log (`result.rowCount = 1`):**<br>```text<br>[UPDATE RESULT] Rows affected (result.rowCount) = 1<br>Updated Record State: {<br>  cnr: 'GJAH018888882026',<br>  case_number: 'CC/888/2026',<br>  statutory_urgency: 'Urgent',<br>  case_status: 'Pending',<br>  fir_number: 'FIR/0088/2026-REV1'<br>}<br>``` |

---

### 4. DELETE

| Item | What to include |
| :--- | :--- |
| **SQL** | Exact parameterized `DELETE` statement with mandatory `WHERE` clause:<br>```sql<br>DELETE FROM court_case<br>WHERE cnr = $1<br>RETURNING cnr;<br>``` |
| **Function** | **Node.js Express Route Handler (`server.js`):**<br>```javascript<br>app.delete('/api/cases/:cnr', authenticateUser, requireRole(['Clerk']), async (req, res) => {<br>    const { cnr } = req.params;<br>    const caseRow = await pool.query('SELECT case_status FROM court_case WHERE cnr = $1', [cnr]);<br>    if (caseRow.rowCount === 0) return res.status(404).json({ success: false, error: 'Case not found' });<br>    if (caseRow.rows[0].case_status !== 'Filed') {<br>        return res.status(400).json({ success: false, error: 'Only cases in Filed status may be deleted.' });<br>    }<br>    const result = await pool.query('DELETE FROM court_case WHERE cnr = $1 RETURNING cnr;', [cnr]);<br>    res.json({ success: true, rowCount: result.rowCount, message: `Case ${cnr} purged successfully.` });<br>});<br>``` |
| **Output** | **Terminal Execution Log (`result.rowCount = 1` & Integrity Test):**<br>```text<br>[DELETE RESULT] Rows affected (result.rowCount) = 1<br>Deleted Case Record: GJAH018888882026<br><br>[FK RESTRICT VERIFIED] Error code 23503: Deletion blocked by database engine.<br>Detail: Key (cnr)=(GJAH010000012024) is still referenced from table "case_party".<br>``` |

---

### 5. Automated CRUD Suite Verification Evidence
The complete CRUD lifecycle verification test was executed against our live Supabase PostgreSQL database, verifying sequential CREATE, READ, UPDATE, DELETE, and foreign-key integrity rejection:

![Automated CRUD Suite Evidence](docs/screenshots/11_terminal_db_verification.png)

---

# (C) Frontend Screenshots

Below are the live captures of the production frontend demonstrating real database interactivity, multi-table joins, and role-based permissions:

### 1. Main Cases Ledger (`READ`) & Dynamic Summary Cards
The primary docket display showing 101 live cases from Supabase, dynamic KPI metric cards, filters by statutory urgency/status, and pagination:
![Main Cases Ledger](docs/screenshots/01_cases_ledger.png)

---

### 2. "Add New Record" Form (`CREATE` — Plaint Intake Modal)
The new plaint registration modal enforcing the 16-character alphanumeric CNR format (`GJAH...`), SFN validation, and registering clerk foreign key constraint:
![Add New Record Modal](docs/screenshots/02_create_case_modal.png)

---

### 3. Multi-Table Relational Case Dossier (`READ` via Joins)
Clicking **View** on any case opens a comprehensive slide-over drawer joining `court_case` (R7) with `case_party` + `system_users` (R8/R1), `case_advocate` (R9), `hearing` + `cause_list` (R11/R10), and `court_order` (R14):
![Relational Case Dossier](docs/screenshots/03_case_dossier_drawer.png)

---

### 4. Update Record Modal (`UPDATE` — Metadata Modification)
Interactive dialog allowing authorized court staff to modify statutory urgency (`Normal`, `Urgent`, `Statutory`), case status (`Pending`, `Filed`), and FIR reference:
![Edit Case Modal](docs/screenshots/04_edit_case_modal.png)

---

### 5. Delete Confirmation & Foreign Key Protection (`DELETE`)
Confirmation dialog warning the user before deletion, protected by `ON DELETE RESTRICT` constraints to prevent accidental removal of active cases:
![Delete Confirmation Modal](docs/screenshots/05_delete_case_modal.png)

---

### 6. Role-Based Access Control Switcher (Dual-Sided Simulation)
Allows the grader to switch between **Administration Roles** (Clerk, Judge, Court Administrator) and **User Roles** (Advocate, Litigant) to inspect customized permissions:
![Role Switcher Modal](docs/screenshots/06_rbac_switcher.png)

---

### 7. Judge Judicial Bench Workspace (`Hon'ble Justice R. K. Iyer #201`)
Judge-specific interface displaying presiding trial sessions, draft orders awaiting judicial signature, and bench proceedings:
![Judge Bench View](docs/screenshots/07_judge_bench_view.png)

---

### 8. Confidential Judicial Bench Notes & Outcome Recorder (R11)
Exclusive modal for judges to record private observations, trial directions, and official outcomes (`Arguments Heard`, `Order Reserved`, `Disposed`):
![Judge Bench Modal](docs/screenshots/08_judge_bench_modal.png)

---

### 9. Database & Relational Schema Live Audit (Court Administrator)
Administrator monitor querying all 18 BCNF relational entities directly on Supabase, verifying live tuple counts, foreign key integrity, and Boyce-Codd Normal Form compliance:
![18 BCNF Tables Audit](docs/screenshots/10_admin_18_bcnf_audit.png)

---

# (D) Reflection / Conclusion

> Implementing the database connectivity layer for our District Judiciary Case Management System using Node.js, Express, and the `pg` (`node-postgres`) driver provided invaluable insights into multi-tier software architecture and enterprise relational integrity. A primary technical hurdle encountered during deployment was configuring encrypted SSL communication with our Supabase PostgreSQL 17 cluster in region `ap-northeast-1`. Because modern cloud database providers operate through IPv4 transaction poolers over TLS, establishing stable connections required passing `{ rejectUnauthorized: false }` within the connection pool options and binding pool listeners to handle intermittent connection timeouts gracefully.
>
> A fundamental architectural principle mastered during this lab is **why client-side web browsers must never connect directly to a relational database**. Direct database access from client browsers would expose database credentials in plain text through developer inspection tools, bypass essential server-side authorization controls, fail to sanitize inputs, and quickly saturate connection limits due to the lack of client-side connection pooling. Placing an Express REST API intermediate layer guarantees that sensitive database credentials remain isolated on the server inside `.env`. Furthermore, by strictly employing `$1, $2, ...` parameterized placeholders rather than JavaScript template literal string concatenation, our API completely eliminates SQL injection vulnerabilities while reliably honoring foreign key (`ON DELETE RESTRICT`), unique key, and domain check constraints across all relational tables.
>
> *(Word count: 218 words)*

---

## 🛠️ (E) Local Setup & Quick Launch Guide

To run this application locally on your machine:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/snehpatel05/DBMS.git
   cd DBMS
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the root directory:
   ```ini
   PORT=3000
   DATABASE_URL=postgresql://postgres.snehpatel:[YOUR_PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres
   ```

4. **Run the Database Verification Test:**
   ```bash
   node scripts/run_crud_verification.js
   ```

5. **Start the Web Application:**
   ```bash
   npm start
   ```
   Open **`http://localhost:3000`** in any modern web browser.

---

**MC212 Database Management Systems — Team 7**  
*Trivedi Havish Ashishkumar (202503013) & Patel Sneh Champakkumar (202503007)*  
