# 🏛️ District Court Case Management System (Sessions Division)
### MC212 Database Management Systems — Lab 11: Database Connectivity Project
**Team Number:** Team 7  
**Team Members:**  
* **Patel Sneh Champakkumar** (`202503007`)  
* **Trivedi Havish Ashishkumar** (`202503013`)  
**Course Instructor:** Prof. Minal Bhise (`minal_bhise@dau.ac.in`)  
**Teaching Assistants:** `202303010@dau.ac.in`, `202303016@dau.ac.in`  

---

## 🌐 Live Production Deployment & Links

| Resource | Direct URL Link | Status |
| :--- | :--- | :--- |
| **🚀 Live Working Application** | **[https://dbms-snehpatel05s-projects.vercel.app](https://dbms-snehpatel05s-projects.vercel.app)** | ![Production Active](https://img.shields.io/badge/Vercel-Live%20Deployment-10B981?style=flat&logo=vercel) |
| **📦 GitHub Source Repository** | **[https://github.com/snehpatel05/DBMS](https://github.com/snehpatel05/DBMS)** | ![GitHub Repo](https://img.shields.io/badge/GitHub-snehpatel05%2FDBMS-181717?style=flat&logo=github) |
| **🗄️ PostgreSQL Cloud Instance** | `aws-0-ap-northeast-1.pooler.supabase.com:6543` | ![PostgreSQL 17](https://img.shields.io/badge/PostgreSQL-17.11%20(Supabase)-4169E1?style=flat&logo=postgresql) |

> **Default Opening State:** When opening the live URL, the system automatically lands on **Clerk Vivaan Dave (ID: 301)** on the primary **Cases Registry** ledger with full plaint intake permissions. Role-switching to Judge, Advocate, Litigant, or Court Administrator can be performed anytime via the top-right profile badge.

---

## 📋 Technology Stack (Option B: JavaScript / Node.js)

* **Database Engine:** PostgreSQL 17.11 (Relational cloud database hosted on Supabase Tokyo `ap-northeast-1`).
* **Database Driver:** `pg` (`node-postgres` v8.11+) connection pool with SSL TLS termination.
* **Backend Framework:** Node.js with Express.js REST API layer (`server.js`).
* **Frontend Architecture:** Professional Government Docket UI (`HTML5`, `CSS3`, vanilla `JavaScript` with `fetch` API, Source Sans 3 typography, monospace CNRs, and responsive modal/drawer dialogs).
* **Security & SQL Safety:** 100% Parameterized queries (`$1, $2, ...` with value arrays) to prevent SQL Injection; environment credentials isolated via `dotenv`.

---

# (A) Database Connectivity Code

### 1. Connection Pool Initialization (`server.js`)
The database connection pool is created using the official `pg` (`node-postgres`) driver. It utilizes a pooled client architecture with SSL configuration for secure communication with Supabase:

```javascript
// server.js - PostgreSQL Connection Pool Setup
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Required for Supabase IPv4 transaction pooler over TLS
    },
    max: 20,                       // Maintain up to 20 concurrent connections in pool
    idleTimeoutMillis: 30000,      // Close idle clients after 30 seconds
    connectionTimeoutMillis: 10000 // Timeout acquisition after 10 seconds
});

// Pool lifecycle logging
pool.on('connect', () => {
    // Client checked out from pool
});

pool.on('error', (err) => {
    console.error('[DATABASE POOL ERROR] Unexpected client error:', err.message);
});
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
DATABASE_URL=postgresql://postgres.xxx:[PASSWORD-MASKED]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres
NODE_ENV=production
```

### 4. Database Connection Verification Test (`SELECT version()`)
The following script executes `SELECT version();` against the Supabase database to verify live connectivity:

```javascript
// scripts/run_crud_verification.js (Extract)
const verRes = await pool.query("SELECT version();");
console.log("[CONNECTIVITY SUCCESS] Connected to PostgreSQL on Supabase Cloud!");
console.log("PostgreSQL Version Output: " + verRes.rows[0].version);
console.log("Connection Host: aws-0-ap-northeast-1.pooler.supabase.com:6543");
```

**Terminal Verification Output:**
```text
================================================================================
 MC212 DBMS LAB 11 - DATABASE CONNECTIVITY & CRUD VERIFICATION TEST
 Team 7: Trivedi Havish (202503013) & Patel Sneh (202503007)
================================================================================

--- (A) SECTION A: DATABASE CONNECTIVITY TEST ---
[CONNECTIVITY SUCCESS] Connected to PostgreSQL on Supabase Cloud!
PostgreSQL Version Output:
  PostgreSQL 17.11 on x86_64-pc-linux-gnu, compiled by gcc (GCC) 15.2.0, 64-bit
  Connection Host: aws-0-ap-northeast-1.pooler.supabase.com:6543
--------------------------------------------------------------------------------
```

![Terminal Verification Evidence](docs/screenshots/11_terminal_db_verification.png)

---

# (B) CRUD Operation Code (`court_case` Table)

Each subsection below presents the exact SQL query with placeholders, the Express route handler, and the output verification showing `result.rowCount = 1`.

---

### 1. CREATE (INSERT)

| Item | What to include |
| :--- | :--- |
| **SQL** | Exact parameterized `INSERT` statement with `$1..$7` placeholders:<br>```sql<br>INSERT INTO court_case (<br>    cnr, standardized_filing_number, case_number,<br>    fir_number, statutory_urgency, case_status, registered_by_clerk_id<br>)<br>VALUES ($1, $2, $3, $4, $5, $6, $7)<br>RETURNING cnr, case_number, statutory_urgency, case_status;<br>``` |
| **Function** | **Node.js Express Route Handler (`server.js`):**<br>```javascript<br>app.post('/api/cases', async (req, res) => {<br>    const userRole = req.headers['x-user-role'];<br>    if (userRole && !['Clerk', 'Court Administrator'].includes(userRole)) {<br>        return res.status(403).json({ success: false, error: 'Access denied: Only Clerks may file plaints.' });<br>    }<br>    const { cnr, standardized_filing_number, case_number, fir_number, statutory_urgency, case_status, registered_by_clerk_id } = req.body;<br>    const sql = `<br>        INSERT INTO court_case (<br>            cnr, standardized_filing_number, case_number,<br>            fir_number, statutory_urgency, case_status, registered_by_clerk_id<br>        )<br>        VALUES ($1, $2, $3, $4, $5, $6, $7)<br>        RETURNING *;<br>    `;<br>    const params = [cnr, standardized_filing_number, case_number, fir_number, statutory_urgency, case_status, registered_by_clerk_id];<br>    const result = await query(sql, params);<br>    res.status(201).json({ success: true, rowCount: result.rowCount, data: result.rows[0] });<br>});<br>``` |
| **Output** | **Terminal Execution Log (`result.rowCount = 1`):**<br>```text<br>[INSERT RESULT] Rows affected (result.rowCount) = 1<br>Inserted Record: {<br>  cnr: 'GJAH018888882026',<br>  case_number: 'CC/888/2026',<br>  statutory_urgency: 'Normal',<br>  case_status: 'Filed'<br>}<br>``` |

---

### 2. READ (SELECT)

| Item | What to include |
| :--- | :--- |
| **SQL** | Exact parameterized `SELECT` statement with search, filter, and pagination placeholders:<br>```sql<br>SELECT cnr, standardized_filing_number, case_number, fir_number,<br>       statutory_urgency, case_status, registered_by_clerk_id<br>FROM court_case<br>WHERE ($1::text IS NULL OR statutory_urgency = $1)<br>  AND ($2::text IS NULL OR case_status = $2)<br>  AND ($3::text IS NULL OR cnr ILIKE $3 OR case_number ILIKE $3)<br>ORDER BY cnr ASC<br>LIMIT $4;<br>``` |
| **Function** | **Node.js Express Route Handler (`server.js`):**<br>```javascript<br>app.get('/api/cases', async (req, res) => {<br>    const { urgency, status, search, limit } = req.query;<br>    let conditions = [];<br>    let params = [];<br>    if (urgency && urgency !== 'ALL') {<br>        params.push(urgency);<br>        conditions.push(`statutory_urgency = $${params.length}`);<br>    }<br>    if (status && status !== 'ALL') {<br>        params.push(status);<br>        conditions.push(`case_status = $${params.length}`);<br>    }<br>    if (search) {<br>        params.push(`%${search.trim()}%`);<br>        conditions.push(`(cnr ILIKE $${params.length} OR case_number ILIKE $${params.length})`);<br>    }<br>    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';<br>    params.push(parseInt(limit || '100', 10));<br>    const sql = `SELECT * FROM court_case ${whereClause} ORDER BY cnr ASC LIMIT $${params.length};`;<br>    const result = await query(sql, params);<br>    res.json({ success: true, rowCount: result.rowCount, data: result.rows });<br>});<br>``` |
| **Output** | **Terminal Execution Log (`result.rowCount = 1`):**<br>```text<br>[SELECT RESULT] Rows fetched (result.rowCount) = 1<br>Retrieved Row: {<br>  cnr: 'GJAH018888882026',<br>  standardized_filing_number: 'SFN-2026-008888',<br>  case_number: 'CC/888/2026',<br>  fir_number: 'FIR/0088/2026',<br>  statutory_urgency: 'Normal',<br>  case_status: 'Filed',<br>  registered_by_clerk_id: 301<br>}<br>``` |

---

### 3. UPDATE

| Item | What to include |
| :--- | :--- |
| **SQL** | Exact parameterized `UPDATE` statement with mandatory `WHERE` clause:<br>```sql<br>UPDATE court_case<br>SET statutory_urgency = COALESCE($1, statutory_urgency),<br>    case_status = COALESCE($2, case_status),<br>    fir_number = COALESCE($3, fir_number)<br>WHERE cnr = $4<br>RETURNING cnr, case_number, statutory_urgency, case_status, fir_number;<br>``` |
| **Function** | **Node.js Express Route Handler (`server.js`):**<br>```javascript<br>app.put('/api/cases/:cnr', async (req, res) => {<br>    const userRole = req.headers['x-user-role'];<br>    if (userRole && !['Clerk', 'Court Administrator'].includes(userRole)) {<br>        return res.status(403).json({ success: false, error: 'Access denied: Metadata modification restricted to Registry Staff.' });<br>    }<br>    const { cnr } = req.params;<br>    const { urgency, status, fir_no } = req.body;<br>    const sql = `<br>        UPDATE court_case<br>        SET statutory_urgency = COALESCE($1, statutory_urgency),<br>            case_status = COALESCE($2, case_status),<br>            fir_number = COALESCE($3, fir_number)<br>        WHERE cnr = $4<br>        RETURNING *;<br>    `;<br>    const result = await query(sql, [urgency || null, status || null, fir_no || null, cnr]);<br>    if (result.rowCount === 0) return res.status(404).json({ success: false, error: 'Case not found' });<br>    res.json({ success: true, rowCount: result.rowCount, data: result.rows[0] });<br>});<br>``` |
| **Output** | **Terminal Execution Log (`result.rowCount = 1`):**<br>```text<br>[UPDATE RESULT] Rows affected (result.rowCount) = 1<br>Updated Record State: {<br>  cnr: 'GJAH018888882026',<br>  case_number: 'CC/888/2026',<br>  statutory_urgency: 'Urgent',<br>  case_status: 'Pending',<br>  fir_number: 'FIR/0088/2026-REV1'<br>}<br>``` |

---

### 4. DELETE

| Item | What to include |
| :--- | :--- |
| **SQL** | Exact parameterized `DELETE` statement with mandatory `WHERE` clause:<br>```sql<br>DELETE FROM court_case<br>WHERE cnr = $1<br>RETURNING cnr;<br>``` |
| **Function** | **Node.js Express Route Handler (`server.js`):**<br>```javascript<br>app.delete('/api/cases/:cnr', async (req, res) => {<br>    const userRole = req.headers['x-user-role'];<br>    if (userRole && !['Clerk', 'Court Administrator'].includes(userRole)) {<br>        return res.status(403).json({ success: false, error: 'Access denied: Purging cases restricted to Clerks and Administrators.' });<br>    }<br>    const { cnr } = req.params;<br>    try {<br>        const sql = `DELETE FROM court_case WHERE cnr = $1 RETURNING cnr;`;<br>        const result = await query(sql, [cnr]);<br>        if (result.rowCount === 0) return res.status(404).json({ success: false, error: 'Case not found' });<br>        res.json({ success: true, rowCount: result.rowCount, message: `Case ${cnr} purged.` });<br>    } catch (err) {<br>        if (err.code === '23503') {<br>            res.status(409).json({ success: false, error: `Foreign Key RESTRICT: Cannot delete case ${cnr} with active hearings or party records.` });<br>        } else {<br>            res.status(400).json({ success: false, error: err.message });<br>        }<br>    }<br>});<br>``` |
| **Output** | **Terminal Execution Log (`result.rowCount = 1` & Integrity Test):**<br>```text<br>[DELETE RESULT] Rows affected (result.rowCount) = 1<br>Deleted Case Record: GJAH018888882026<br><br>[FK RESTRICT VERIFIED] Error code 23503: Deletion blocked by database engine.<br>Detail: Key (cnr)=(GJAH010000012024) is still referenced from table "case_party".<br>``` |

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

### 7. Judge Judicial Bench Workspace (`Hon'ble Judge Vivaan Modi #201`)
Judge-specific interface displaying presiding trial sessions, draft orders awaiting judicial signature, and bench proceedings:
![Judge Bench View](docs/screenshots/07_judge_bench_view.png)

---

### 8. Confidential Judicial Bench Notes & Outcome Recorder (R11)
Exclusive modal for judges to record private observations, trial directions, and official outcomes (`Arguments Heard`, `Order Reserved`, `Disposed`):
![Judge Bench Modal](docs/screenshots/08_judge_bench_modal.png)

---

### 9. 18 BCNF Relational Tables Live Database Audit (Court Administrator)
Administrator monitor querying all 18 BCNF tables directly on Supabase, verifying live tuple counts and Boyce-Codd Normal Form compliance:
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
*Department of Computer Science & Information Technology, DA-IICT*
