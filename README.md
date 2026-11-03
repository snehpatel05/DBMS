# MC212 DBMS Lab 11: Database Connectivity & Multi-Table Registry
**Team Number:** 7  
**Team Members:** Trivedi Havish Ashishkumar (202503013) & Patel Sneh Champakkumar (202503007)  
**System:** District Judiciary Enterprise Information System (PostgreSQL 17 on Supabase)

---

## 🚀 Quick Launch

In PowerShell:
```powershell
cd "C:\Users\SNEH\.gemini\antigravity\scratch\lab11-court-management"
npm start
```
Open **`http://localhost:3000`** in your browser.

---

## 🏛️ System Features

### 1. Master Case Registry (`court_case` - R7)
- **Full CRUD:**
  - **Create:** File new case with validation against `ck_case_cnr`, `ck_case_urgency`, `ck_case_status`, and clerk FK.
  - **Read:** Search and filter by CNR, Case Number, SFN, Statutory Urgency, and Case Status.
  - **Update:** Edit case urgency and status with a strict `WHERE` clause.
  - **Delete:** Safely purge cases (guarded by `ON DELETE RESTRICT`).
- **Relational Case Dossier:**
  - Click **"Dossier"** on any row to open a multi-table aggregate modal combining:
    - Master case attributes (`court_case`)
    - Assigned parties in dispute (`case_party` + `system_users`)
    - Legal counsel (`case_advocate` + `advocate` + `system_users`)
    - Hearing history (`v_hearing_with_date` joined with `cause_list`)
    - Published orders & judgments (`v_order_with_status`)

### 2. Hearing Schedule (`v_hearing_with_date` - R11 & R10)
- Demonstrates BCNF normalization: hearing dates are projected dynamically from daily cause lists via view.
- Filter by outcome (Arguments Heard, Evidence Recorded, Order Reserved, Adjourned, Disposed).

### 3. Orders & Judgments (`v_order_with_status` - R14)
- Shows 2-step publication workflow: status is dynamically derived from `published_date IS NOT NULL`.
- Filter by order type (Final Judgment, Interim Order, Procedural Order) and publication status.

### 4. Witness Directory & Summons (`witness` & `summons` - R12 & R13)
- Witness directory with phone format check (`ck_witness_phone`).
- Tracks summons counts served per witness.
- Ability to register new witnesses.

---

## 📸 Lab 11 Submission Screenshots Guide

### (A) Database Connectivity Code
- [ ] Screenshot of `new Pool()` setup in `db.js`.
- [ ] Screenshot of `.env.example` (with password masked `DB_PASS=********`).
- [ ] Screenshot of `node test-conn.js` terminal output showing `SELECT version()`.

### (B) CRUD Operation Code (court_case)
- [ ] **CREATE (INSERT):** Function in `server.js` (`POST /api/cases`) and terminal log showing `result.rowCount = 1`.
- [ ] **READ (SELECT):** Function in `server.js` (`GET /api/cases`) and terminal log showing rows fetched.
- [ ] **UPDATE:** Function in `server.js` (`PUT /api/cases/:cnr`) and terminal log showing `result.rowCount = 1`.
- [ ] **DELETE:** Function in `server.js` (`DELETE /api/cases/:cnr`) and terminal log showing `result.rowCount = 1`.

### (C) Frontend Screenshots
- [ ] Screenshot of the **Case Registry** table showing case records and the KPI metric strip.
- [ ] Screenshot of the **New Case Filing** modal (`court_case` INSERT).
- [ ] Screenshot of the **Relational Case Dossier** modal (showing multi-table joins for parties, counsel, hearings, and orders).
- [ ] Screenshot of the **Hearing Schedule** or **Orders** tab showing normalized views.
- [ ] Screenshot of the **Edit** or **Delete** toast notification.

---

## 📝 (D) Reflection / Conclusion (195 words)

> Implementing the database connectivity layer for our Judiciary Management System using Node.js, Express, and the `pg` (node-postgres) driver provided vital insights into multi-tier software architecture and relational data integrity. An early deployment hurdle was establishing secure SSL communication with our Supabase PostgreSQL instance in region `ap-northeast-1` over an IPv4 connection pooler, which was resolved by configuring `{ rejectUnauthorized: false }` and utilizing transaction pooler endpoints on port 6543.
>
> A fundamental architectural principle mastered in this lab is **why client-side web browsers must never connect directly to PostgreSQL**. Direct database access from client browsers would expose database credentials, leave schema definitions vulnerable to arbitrary manipulation, bypass business-rule triggers (such as disposal and ISA constraints), and rapidly exhaust database connection limits due to the lack of connection pooling. Placing an Express REST API intermediate layer guarantees that sensitive database credentials remain isolated on the server within `.env`. Furthermore, by strictly employing `$1, $2, ...` parameterized arrays rather than template literal string interpolation, our application eliminates SQL injection vulnerabilities while reliably honoring foreign key (`ON DELETE RESTRICT`) and domain check constraints.
