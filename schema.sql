-- =====================================================================
-- MC212: Database Management Systems - Lab 9
-- Schema Definition (DDL) for Judiciary / Court Case Management System
-- Team 7: Trivedi Havish Ashishkumar (202503013), Patel Sneh Champakkumar (202503007)
-- 
-- Formal BCNF Schema (18 Relations, 29 Foreign Keys, 6 Candidate Keys, 
-- 21 CHECK Domain Constraints, 7 Business-Rule Triggers, and 2 Relational Views)
-- =====================================================================

-- Clean slate initialization (Re-runnable)
DROP VIEW IF EXISTS v_order_with_status CASCADE;
DROP VIEW IF EXISTS v_hearing_with_date CASCADE;

DROP TABLE IF EXISTS alert_recipient CASCADE;
DROP TABLE IF EXISTS alert CASCADE;
DROP TABLE IF EXISTS vakalatnama CASCADE;
DROP TABLE IF EXISTS document CASCADE;
DROP TABLE IF EXISTS court_order CASCADE;
DROP TABLE IF EXISTS summons CASCADE;
DROP TABLE IF EXISTS witness CASCADE;
DROP TABLE IF EXISTS hearing CASCADE;
DROP TABLE IF EXISTS cause_list CASCADE;
DROP TABLE IF EXISTS case_advocate CASCADE;
DROP TABLE IF EXISTS case_party CASCADE;
DROP TABLE IF EXISTS court_case CASCADE;
DROP TABLE IF EXISTS court_administrator CASCADE;
DROP TABLE IF EXISTS clerk CASCADE;
DROP TABLE IF EXISTS judge CASCADE;
DROP TABLE IF EXISTS litigant CASCADE;
DROP TABLE IF EXISTS advocate CASCADE;
DROP TABLE IF EXISTS system_users CASCADE;

-- =====================================================================
-- R1: SYSTEM_USERS (Supertype entity for all court actors)
-- =====================================================================
CREATE TABLE system_users (
    user_id INTEGER PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(64) NOT NULL,
    user_role VARCHAR(20) NOT NULL,
    created_by_admin_id INTEGER,
    CONSTRAINT ck_user_role CHECK (user_role IN ('Advocate', 'Litigant', 'Judge', 'Clerk', 'Court Administrator')),
    CONSTRAINT ck_user_email CHECK (email ~ '^[^@ ]+@[^@ ]+\.[^@ ]+$'),
    CONSTRAINT ck_user_hash CHECK (length(password_hash) >= 32)
);

-- =====================================================================
-- R2 - R6: ISA Subtype Relations (Disjoint, Total)
-- =====================================================================
CREATE TABLE advocate (
    user_id INTEGER PRIMARY KEY,
    bar_enrollment_no VARCHAR(20) NOT NULL UNIQUE,
    CONSTRAINT fk_advocate_user FOREIGN KEY (user_id) 
        REFERENCES system_users(user_id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE litigant (
    user_id INTEGER PRIMARY KEY,
    CONSTRAINT fk_litigant_user FOREIGN KEY (user_id) 
        REFERENCES system_users(user_id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE judge (
    user_id INTEGER PRIMARY KEY,
    CONSTRAINT fk_judge_user FOREIGN KEY (user_id) 
        REFERENCES system_users(user_id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE clerk (
    user_id INTEGER PRIMARY KEY,
    CONSTRAINT fk_clerk_user FOREIGN KEY (user_id) 
        REFERENCES system_users(user_id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE court_administrator (
    user_id INTEGER PRIMARY KEY,
    localization_setting VARCHAR(10) NOT NULL DEFAULT 'en-IN',
    CONSTRAINT fk_admin_user FOREIGN KEY (user_id) 
        REFERENCES system_users(user_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT ck_admin_locale CHECK (localization_setting IN ('en-IN', 'hi-IN', 'gu-IN'))
);

-- Add circular foreign key: system_users(created_by_admin_id) -> court_administrator(user_id)
ALTER TABLE system_users 
    ADD CONSTRAINT fk_user_created_by_admin FOREIGN KEY (created_by_admin_id) 
    REFERENCES court_administrator(user_id) ON DELETE RESTRICT ON UPDATE CASCADE;

-- =====================================================================
-- R7: COURT_CASE (Central Case Ledger)
-- =====================================================================
CREATE TABLE court_case (
    cnr VARCHAR(16) PRIMARY KEY,
    standardized_filing_number VARCHAR(20) NOT NULL UNIQUE,
    case_number VARCHAR(20) NOT NULL UNIQUE,
    fir_number VARCHAR(20),
    statutory_urgency VARCHAR(10) NOT NULL DEFAULT 'Normal',
    case_status VARCHAR(10) NOT NULL DEFAULT 'Filed',
    registered_by_clerk_id INTEGER NOT NULL,
    CONSTRAINT fk_case_clerk FOREIGN KEY (registered_by_clerk_id) 
        REFERENCES clerk(user_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT ck_case_cnr CHECK (cnr ~ '^[A-Z]{4}[0-9]{12}$'),
    CONSTRAINT ck_case_urgency CHECK (statutory_urgency IN ('Normal', 'Urgent', 'Statutory')),
    CONSTRAINT ck_case_status CHECK (case_status IN ('Filed', 'Pending', 'Disposed'))
);

-- =====================================================================
-- R8: CASE_PARTY (Litigants participating in a case)
-- =====================================================================
CREATE TABLE case_party (
    cnr VARCHAR(16) NOT NULL,
    litigant_id INTEGER NOT NULL,
    party_role VARCHAR(15) NOT NULL,
    PRIMARY KEY (cnr, litigant_id),
    CONSTRAINT fk_party_case FOREIGN KEY (cnr) 
        REFERENCES court_case(cnr) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_party_litigant FOREIGN KEY (litigant_id) 
        REFERENCES litigant(user_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT ck_party_role CHECK (party_role IN ('Petitioner', 'Respondent', 'Complainant', 'Accused'))
);

-- =====================================================================
-- R9: CASE_ADVOCATE (Advocates retained on a case)
-- =====================================================================
CREATE TABLE case_advocate (
    cnr VARCHAR(16) NOT NULL,
    advocate_id INTEGER NOT NULL,
    case_role VARCHAR(10) NOT NULL,
    assigned_date DATE NOT NULL,
    assigned_by INTEGER,
    PRIMARY KEY (cnr, advocate_id),
    CONSTRAINT fk_ca_case FOREIGN KEY (cnr) 
        REFERENCES court_case(cnr) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_ca_advocate FOREIGN KEY (advocate_id) 
        REFERENCES advocate(user_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_ca_assigner FOREIGN KEY (cnr, assigned_by) 
        REFERENCES case_advocate(cnr, advocate_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT ck_ca_role CHECK (case_role IN ('Lead', 'Associate')),
    CONSTRAINT ck_ca_self CHECK (assigned_by IS NULL OR assigned_by <> advocate_id),
    CONSTRAINT ck_ca_lead_has_no_assigner CHECK (case_role = 'Associate' OR assigned_by IS NULL)
);

-- =====================================================================
-- R10: CAUSE_LIST (Daily court hearing roster)
-- =====================================================================
CREATE TABLE cause_list (
    causelist_id INTEGER PRIMARY KEY,
    list_date DATE NOT NULL UNIQUE,
    generated_by_clerk_id INTEGER NOT NULL,
    CONSTRAINT fk_cl_clerk FOREIGN KEY (generated_by_clerk_id) 
        REFERENCES clerk(user_id) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- =====================================================================
-- R11: HEARING (Weak entity identified through CNR)
-- (Hearing_Date removed in 3NF; read via cause_list.list_date)
-- =====================================================================
CREATE TABLE hearing (
    cnr VARCHAR(16) NOT NULL,
    hearing_seq_no INTEGER NOT NULL,
    outcome VARCHAR(20),
    bench_note TEXT,
    judge_id INTEGER,
    causelist_id INTEGER,
    PRIMARY KEY (cnr, hearing_seq_no),
    CONSTRAINT fk_hearing_case FOREIGN KEY (cnr) 
        REFERENCES court_case(cnr) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_hearing_judge FOREIGN KEY (judge_id) 
        REFERENCES judge(user_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_hearing_cl FOREIGN KEY (causelist_id) 
        REFERENCES cause_list(causelist_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT ck_hearing_seq CHECK (hearing_seq_no > 0),
    CONSTRAINT ck_hearing_outcome CHECK (outcome IS NULL OR outcome IN (
        'Adjourned', 'Arguments Heard', 'Evidence Recorded', 'Order Reserved', 'Disposed'
    ))
);

-- =====================================================================
-- R12: WITNESS (Summoned individuals roster)
-- =====================================================================
CREATE TABLE witness (
    witness_id INTEGER PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    contact_number VARCHAR(10) NOT NULL,
    CONSTRAINT ck_witness_phone CHECK (contact_number ~ '^[6-9][0-9]{9}$')
);

-- =====================================================================
-- R13: SUMMONS (Summons dispatched to witnesses for a hearing)
-- =====================================================================
CREATE TABLE summons (
    witness_id INTEGER NOT NULL,
    cnr VARCHAR(16) NOT NULL,
    hearing_seq_no INTEGER NOT NULL,
    summons_date DATE NOT NULL,
    PRIMARY KEY (witness_id, cnr, hearing_seq_no),
    CONSTRAINT fk_summons_witness FOREIGN KEY (witness_id) 
        REFERENCES witness(witness_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_summons_hearing FOREIGN KEY (cnr, hearing_seq_no) 
        REFERENCES hearing(cnr, hearing_seq_no) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- =====================================================================
-- R14: COURT_ORDER (Decrees & Orders issued by Judges)
-- (Publish_Status removed in 3NF; derived from published_date IS NOT NULL)
-- =====================================================================
CREATE TABLE court_order (
    cnr VARCHAR(16) NOT NULL,
    order_seq_no INTEGER NOT NULL,
    order_type VARCHAR(20) NOT NULL,
    draft_timestamp TIMESTAMP NOT NULL,
    published_date DATE,
    judge_id INTEGER NOT NULL,
    hearing_seq_no INTEGER,
    PRIMARY KEY (cnr, order_seq_no),
    CONSTRAINT fk_order_case FOREIGN KEY (cnr) 
        REFERENCES court_case(cnr) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_order_judge FOREIGN KEY (judge_id) 
        REFERENCES judge(user_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_order_hearing FOREIGN KEY (cnr, hearing_seq_no) 
        REFERENCES hearing(cnr, hearing_seq_no) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT ck_order_seq CHECK (order_seq_no > 0),
    CONSTRAINT ck_order_type CHECK (order_type IN ('Interim Order', 'Procedural Order', 'Final Judgment')),
    CONSTRAINT ck_order_pub CHECK (published_date IS NULL OR published_date >= draft_timestamp::date)
);

-- =====================================================================
-- R15: DOCUMENT (Pleadings, Affidavits & Evidence Exhibits)
-- =====================================================================
CREATE TABLE document (
    cnr VARCHAR(16) NOT NULL,
    doc_seq_no INTEGER NOT NULL,
    document_type VARCHAR(20) NOT NULL,
    upload_date DATE NOT NULL,
    advocate_id INTEGER NOT NULL,
    PRIMARY KEY (cnr, doc_seq_no),
    CONSTRAINT fk_doc_case FOREIGN KEY (cnr) 
        REFERENCES court_case(cnr) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_doc_advocate FOREIGN KEY (advocate_id) 
        REFERENCES advocate(user_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT ck_doc_seq CHECK (doc_seq_no > 0),
    CONSTRAINT ck_doc_type CHECK (document_type IN (
        'Petition', 'Affidavit', 'Evidence', 'Written Statement', 'Application'
    ))
);

-- =====================================================================
-- R16: VAKALATNAMA (Digital Power of Attorney Authorizations)
-- =====================================================================
CREATE TABLE vakalatnama (
    auth_id INTEGER PRIMARY KEY,
    signed_date DATE NOT NULL,
    e_signature_flag BOOLEAN NOT NULL DEFAULT TRUE,
    litigant_id INTEGER NOT NULL,
    advocate_id INTEGER NOT NULL,
    cnr VARCHAR(16) NOT NULL,
    CONSTRAINT uq_vakalatnama UNIQUE (litigant_id, advocate_id, cnr),
    CONSTRAINT fk_vak_litigant FOREIGN KEY (litigant_id) 
        REFERENCES litigant(user_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_vak_advocate FOREIGN KEY (advocate_id) 
        REFERENCES advocate(user_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_vak_case FOREIGN KEY (cnr) 
        REFERENCES court_case(cnr) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- =====================================================================
-- R17: ALERT (Master System Notifications)
-- =====================================================================
CREATE TABLE alert (
    alert_id INTEGER PRIMARY KEY,
    alert_timestamp TIMESTAMP NOT NULL,
    alert_type VARCHAR(25) NOT NULL,
    cnr VARCHAR(16) NOT NULL,
    CONSTRAINT fk_alert_case FOREIGN KEY (cnr) 
        REFERENCES court_case(cnr) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT ck_alert_type CHECK (alert_type IN (
        'Hearing Reminder', 'Order Published', 'Case Status Change', 'Document Uploaded'
    ))
);

-- =====================================================================
-- R18: ALERT_RECIPIENT (Notification Deliveries)
-- =====================================================================
CREATE TABLE alert_recipient (
    alert_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    alert_status VARCHAR(10) NOT NULL DEFAULT 'Delivered',
    PRIMARY KEY (alert_id, user_id),
    CONSTRAINT fk_ar_alert FOREIGN KEY (alert_id) 
        REFERENCES alert(alert_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_ar_user FOREIGN KEY (user_id) 
        REFERENCES system_users(user_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT ck_ar_status CHECK (alert_status IN ('Delivered', 'Read'))
);

-- =====================================================================
-- BUSINESS-RULE TRIGGERS
-- =====================================================================

-- (a) ISA Constraint Trigger: validates subtype row matches user_role
CREATE OR REPLACE FUNCTION fn_check_user_role() RETURNS trigger AS $$
BEGIN
    IF (SELECT user_role FROM system_users WHERE user_id = NEW.user_id) <> TG_ARGV[0] THEN
        RAISE EXCEPTION 'User % is not registered as role %', NEW.user_id, TG_ARGV[0];
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_advocate_role BEFORE INSERT OR UPDATE ON advocate
    FOR EACH ROW EXECUTE FUNCTION fn_check_user_role('Advocate');

CREATE TRIGGER trg_litigant_role BEFORE INSERT OR UPDATE ON litigant
    FOR EACH ROW EXECUTE FUNCTION fn_check_user_role('Litigant');

CREATE TRIGGER trg_judge_role BEFORE INSERT OR UPDATE ON judge
    FOR EACH ROW EXECUTE FUNCTION fn_check_user_role('Judge');

CREATE TRIGGER trg_clerk_role BEFORE INSERT OR UPDATE ON clerk
    FOR EACH ROW EXECUTE FUNCTION fn_check_user_role('Clerk');

CREATE TRIGGER trg_admin_role BEFORE INSERT OR UPDATE ON court_administrator
    FOR EACH ROW EXECUTE FUNCTION fn_check_user_role('Court Administrator');

-- (b) Lead Assigner Trigger: assigner must be an active Lead advocate on the same case
CREATE OR REPLACE FUNCTION fn_check_assigner_is_lead() RETURNS trigger AS $$
BEGIN
    IF NEW.assigned_by IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM case_advocate
        WHERE cnr = NEW.cnr AND advocate_id = NEW.assigned_by AND case_role = 'Lead'
    ) THEN
        RAISE EXCEPTION 'Assigner % is not a Lead advocate on case %', NEW.assigned_by, NEW.cnr;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_assigner_is_lead BEFORE INSERT OR UPDATE ON case_advocate
    FOR EACH ROW EXECUTE FUNCTION fn_check_assigner_is_lead();

-- (c) Disposal Rule Trigger: case can become Disposed ONLY IF a published Final Judgment exists
CREATE OR REPLACE FUNCTION fn_check_disposal() RETURNS trigger AS $$
BEGIN
    IF NEW.case_status = 'Disposed' AND NOT EXISTS (
        SELECT 1 FROM court_order
        WHERE cnr = NEW.cnr AND order_type = 'Final Judgment' AND published_date IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'Case % cannot be Disposed: no published Final Judgment', NEW.cnr;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_case_disposal BEFORE INSERT OR UPDATE OF case_status ON court_case
    FOR EACH ROW EXECUTE FUNCTION fn_check_disposal();

-- =====================================================================
-- RELATIONAL VIEWS (Recovering 3NF-decomposed attributes)
-- =====================================================================

-- Recovers hearing_date via cause_list.list_date
CREATE OR REPLACE VIEW v_hearing_with_date AS
SELECT h.cnr, h.hearing_seq_no, cl.list_date AS hearing_date,
       h.outcome, h.bench_note, h.judge_id, h.causelist_id
FROM hearing h
LEFT JOIN cause_list cl ON cl.causelist_id = h.causelist_id;

-- Recovers publish_status via published_date IS NOT NULL
CREATE OR REPLACE VIEW v_order_with_status AS
SELECT o.cnr, o.order_seq_no, o.order_type, o.draft_timestamp, o.published_date,
       CASE WHEN o.published_date IS NOT NULL THEN 'Published' ELSE 'Draft' END AS publish_status,
       o.judge_id, o.hearing_seq_no
FROM court_order o;
