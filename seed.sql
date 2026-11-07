-- =====================================================================
-- MC212: Database Management Systems - Lab 9
-- Data Population Script (DML) for Judiciary / Court Case Management System
-- Team 7: Trivedi Havish Ashishkumar (202503013), Patel Sneh Champakkumar (202503007)
-- 
-- Populates all 18 BCNF tables with >= 100 rows each in strict foreign-key
-- dependency order, validating all business rules, triggers, and constraints.
-- =====================================================================

-- Helper function: builds the standardized 16-character CNR for case number n
CREATE OR REPLACE FUNCTION fn_cnr(n INTEGER) RETURNS VARCHAR AS $$
    SELECT 'GJAH01' || lpad(n::text, 6, '0') || (2023 + n % 4)::text;
$$ LANGUAGE sql IMMUTABLE;

-- ---------------------------------------------------------------------
-- 1. R1: SYSTEM_USERS (500 users: 100 per role)
-- ---------------------------------------------------------------------
INSERT INTO system_users (user_id, name, email, password_hash, user_role, created_by_admin_id)
SELECT i,
    (ARRAY['Aarav','Vivaan','Aditya','Rohan','Kabir','Ishaan','Meera','Anaya','Diya',
           'Riya','Kavya','Nisha','Parth','Harsh','Jay','Neel','Krish','Dhruv','Sneha',
           'Pooja'])[1 + i % 20]
    || ' ' ||
    (ARRAY['Patel','Shah','Mehta','Desai','Trivedi','Joshi','Parmar','Thakkar','Vyas',
           'Bhatt','Modi','Rana','Solanki','Chauhan','Pandya','Dave','Raval','Amin',
           'Soni','Gandhi'])[1 + (i / 20) % 20],
    'user' || i || '@courtmail.in',
    md5(i::text) || md5('salt' || i::text),
    CASE (i - 1) / 100
        WHEN 0 THEN 'Advocate'
        WHEN 1 THEN 'Litigant'
        WHEN 2 THEN 'Judge'
        WHEN 3 THEN 'Clerk'
        ELSE 'Court Administrator'
    END,
    NULL
FROM generate_series(1, 500) AS i;

-- ---------------------------------------------------------------------
-- 2. R2: ADVOCATE (100 Bar Council advocates)
-- ---------------------------------------------------------------------
INSERT INTO advocate (user_id, bar_enrollment_no)
SELECT i, 'GJ/' || lpad(i::text, 4, '0') || '/' || (2005 + i % 20)
FROM generate_series(1, 100) AS i;

-- ---------------------------------------------------------------------
-- 3. R3: LITIGANT (100 registered citizens)
-- ---------------------------------------------------------------------
INSERT INTO litigant (user_id)
SELECT i FROM generate_series(101, 200) AS i;

-- ---------------------------------------------------------------------
-- 4. R4: JUDGE (100 judicial bench officers)
-- ---------------------------------------------------------------------
INSERT INTO judge (user_id)
SELECT i FROM generate_series(201, 300) AS i;

-- ---------------------------------------------------------------------
-- 5. R5: CLERK (100 registry clerks)
-- ---------------------------------------------------------------------
INSERT INTO clerk (user_id)
SELECT i FROM generate_series(301, 400) AS i;

-- ---------------------------------------------------------------------
-- 6. R6: COURT_ADMINISTRATOR (100 supervisors with rotating localizations)
-- ---------------------------------------------------------------------
INSERT INTO court_administrator (user_id, localization_setting)
SELECT i, (ARRAY['en-IN', 'hi-IN', 'gu-IN'])[1 + i % 3]
FROM generate_series(401, 500) AS i;

-- Resolve circular reference R1 -> R6
UPDATE system_users 
SET created_by_admin_id = 401 + (user_id % 100)
WHERE user_id BETWEEN 1 AND 400;

UPDATE system_users 
SET created_by_admin_id = 401
WHERE user_id BETWEEN 402 AND 500; -- Admin 401 is root administrator (NULL)

-- ---------------------------------------------------------------------
-- 7. R7: COURT_CASE (100 cases: 65 Pending, 10 Filed, 25 to be Disposed)
-- ---------------------------------------------------------------------
INSERT INTO court_case (cnr, standardized_filing_number, case_number, fir_number,
                        statutory_urgency, case_status, registered_by_clerk_id)
SELECT fn_cnr(n),
    'SFN-' || (2023 + n % 4) || '-' || lpad(n::text, 6, '0'),
    'CC/' || n || '/' || (2023 + n % 4),
    CASE WHEN n % 3 = 0 THEN 'FIR/' || lpad(n::text, 4, '0') || '/' || (2023 + n % 4) END,
    CASE WHEN n % 10 = 0 THEN 'Statutory' WHEN n % 7 = 0 THEN 'Urgent' ELSE 'Normal' END,
    CASE WHEN n % 10 = 1 THEN 'Filed' ELSE 'Pending' END,
    300 + n
FROM generate_series(1, 100) AS n;

-- ---------------------------------------------------------------------
-- 8. R8: CASE_PARTY (200 litigant party links: 2 parties per case)
-- ---------------------------------------------------------------------
-- Party 1: Petitioner or Complainant
INSERT INTO case_party (cnr, litigant_id, party_role)
SELECT fn_cnr(n), 100 + n, CASE WHEN n % 2 = 0 THEN 'Petitioner' ELSE 'Complainant' END
FROM generate_series(1, 100) AS n;

-- Party 2: Respondent or Accused
INSERT INTO case_party (cnr, litigant_id, party_role)
SELECT fn_cnr(n), 100 + (n % 100) + 1, CASE WHEN n % 2 = 0 THEN 'Respondent' ELSE 'Accused' END
FROM generate_series(1, 100) AS n;

-- ---------------------------------------------------------------------
-- 9. R9: CASE_ADVOCATE (200 retained advocates: 1 Lead & 1 Associate per case)
-- ---------------------------------------------------------------------
-- Lead Counsel (assigned_by is NULL)
INSERT INTO case_advocate (cnr, advocate_id, case_role, assigned_date, assigned_by)
SELECT fn_cnr(n), n, 'Lead', DATE '2025-06-01' + n, NULL
FROM generate_series(1, 100) AS n;

-- Associate Counsel (assigned by the Lead advocate of the same case)
INSERT INTO case_advocate (cnr, advocate_id, case_role, assigned_date, assigned_by)
SELECT fn_cnr(n), (n % 100) + 1, 'Associate', DATE '2025-06-04' + n, n
FROM generate_series(1, 100) AS n;

-- ---------------------------------------------------------------------
-- 10. R10: CAUSE_LIST (100 daily rosters: 2026-06-01 to 2026-09-08)
-- ---------------------------------------------------------------------
INSERT INTO cause_list (causelist_id, list_date, generated_by_clerk_id)
SELECT i, DATE '2026-06-01' + (i - 1), 300 + i
FROM generate_series(1, 100) AS i;

-- ---------------------------------------------------------------------
-- 11. R11: HEARING (200 hearings: 140 listed, 60 pending listing)
-- ---------------------------------------------------------------------
-- Hearing 1: Listed on cause list n for all 100 cases
INSERT INTO hearing (cnr, hearing_seq_no, outcome, bench_note, judge_id, causelist_id)
SELECT fn_cnr(n), 1,
    (ARRAY['Adjourned', 'Arguments Heard', 'Evidence Recorded', 'Order Reserved', 'Disposed'])[1 + n % 5],
    'Bench note for first hearing of case ' || n,
    200 + n, n
FROM generate_series(1, 100) AS n;

-- Hearing 2: Cases 1..80 odd are listed 20 days later; remainder are unlisted (NULLs)
INSERT INTO hearing (cnr, hearing_seq_no, outcome, bench_note, judge_id, causelist_id)
SELECT fn_cnr(n), 2,
    CASE WHEN n % 2 = 1 AND n <= 80 
        THEN (ARRAY['Adjourned', 'Arguments Heard', 'Evidence Recorded', 'Order Reserved'])[1 + n % 4] END,
    CASE WHEN n % 2 = 1 AND n <= 80 THEN 'Bench note for second hearing of case ' || n END,
    CASE WHEN n % 2 = 1 AND n <= 80 THEN 200 + ((n + 49) % 100) + 1 END,
    CASE WHEN n % 2 = 1 AND n <= 80 THEN n + 20 END
FROM generate_series(1, 100) AS n;

-- ---------------------------------------------------------------------
-- 12. R12: WITNESS (100 summoned individuals)
-- ---------------------------------------------------------------------
INSERT INTO witness (witness_id, name, contact_number)
SELECT i,
    (ARRAY['Manish','Suresh','Ramesh','Dinesh','Hitesh','Mukesh','Jignesh','Kalpesh',
           'Bhavesh','Chirag','Nilesh','Paresh','Rajesh','Satish','Tejas','Urvi','Hetal',
           'Komal','Falguni','Darshana'])[1 + i % 20]
    || ' ' ||
    (ARRAY['Panchal','Prajapati','Rathod','Vaghela','Barot','Chaudhari','Dabhi','Gohil',
           'Jadeja','Kothari','Lad','Nayak','Oza','Purohit','Sheth','Tank','Upadhyay',
           'Vora','Zala','Dholakia'])[1 + (i / 5) % 20],
    '9' || lpad(((i::bigint * 7654321) % 1000000000)::text, 9, '0')
FROM generate_series(1, 100) AS i;

-- ---------------------------------------------------------------------
-- 13. R13: SUMMONS (200 witness summons)
-- ---------------------------------------------------------------------
-- Every witness summoned for hearing 1 of two different cases
INSERT INTO summons (witness_id, cnr, hearing_seq_no, summons_date)
SELECT w, fn_cnr(w), 1, DATE '2026-06-01' + (w - 1) - 7
FROM generate_series(1, 100) AS w;

INSERT INTO summons (witness_id, cnr, hearing_seq_no, summons_date)
SELECT w, fn_cnr(((w + 49) % 100) + 1), 1, DATE '2026-06-01' + (((w + 49) % 100) + 1 - 1) - 7
FROM generate_series(1, 100) AS w;

-- ---------------------------------------------------------------------
-- 14. R14: COURT_ORDER (150 decrees: 100 interim/procedural, 50 final)
-- ---------------------------------------------------------------------
-- Order 1: Interim / Procedural Order for every case (published unless multiple of 5)
INSERT INTO court_order (cnr, order_seq_no, order_type, draft_timestamp, published_date, judge_id, hearing_seq_no)
SELECT fn_cnr(n), 1,
    CASE WHEN n % 2 = 1 THEN 'Interim Order' ELSE 'Procedural Order' END,
    (DATE '2026-06-01' + (n - 1))::timestamp + INTERVAL '16 hours',
    CASE WHEN n % 5 <> 0 THEN DATE '2026-06-01' + (n - 1) + 1 END,
    200 + n, 1
FROM generate_series(1, 100) AS n;

-- Order 2: Final Judgment for 50 even-numbered cases (published if multiple of 4)
INSERT INTO court_order (cnr, order_seq_no, order_type, draft_timestamp, published_date, judge_id, hearing_seq_no)
SELECT fn_cnr(n), 2, 'Final Judgment',
    TIMESTAMP '2026-08-01 11:00' + (n / 2) * INTERVAL '1 day',
    CASE WHEN n % 4 = 0 THEN (DATE '2026-08-01' + (n / 2) + 2) END,
    200 + ((n + 49) % 100) + 1, 2
FROM generate_series(2, 100, 2) AS n;

-- Enforce the Disposal Rule: 25 cases with published Final Judgments become Disposed
UPDATE court_case SET case_status = 'Disposed'
WHERE cnr IN (
    SELECT cnr FROM court_order
    WHERE order_type = 'Final Judgment' AND published_date IS NOT NULL
);

-- ---------------------------------------------------------------------
-- 15. R15: DOCUMENT (200 pleadings & exhibits: 2 per case)
-- ---------------------------------------------------------------------
INSERT INTO document (cnr, doc_seq_no, document_type, upload_date, advocate_id)
SELECT fn_cnr(n), 1, (ARRAY['Petition','Affidavit','Application'])[1 + n % 3],
    DATE '2026-05-15' + n, n
FROM generate_series(1, 100) AS n;

INSERT INTO document (cnr, doc_seq_no, document_type, upload_date, advocate_id)
SELECT fn_cnr(n), 2, (ARRAY['Written Statement','Evidence','Affidavit'])[1 + n % 3],
    DATE '2026-05-25' + n, (n % 100) + 1
FROM generate_series(1, 100) AS n;

-- ---------------------------------------------------------------------
-- 16. R16: VAKALATNAMA (200 powers of attorney: 2 per case)
-- ---------------------------------------------------------------------
INSERT INTO vakalatnama (auth_id, signed_date, e_signature_flag, litigant_id, advocate_id, cnr)
SELECT n, DATE '2025-12-01' + n, (n % 4 <> 0), 100 + n, n, fn_cnr(n)
FROM generate_series(1, 100) AS n;

INSERT INTO vakalatnama (auth_id, signed_date, e_signature_flag, litigant_id, advocate_id, cnr)
SELECT 100 + n, DATE '2025-12-05' + n, (n % 3 <> 0), 100 + (n % 100) + 1, (n % 100) + 1, fn_cnr(n)
FROM generate_series(1, 100) AS n;

-- ---------------------------------------------------------------------
-- 17. R17: ALERT (100 master alerts: 1 per case)
-- ---------------------------------------------------------------------
INSERT INTO alert (alert_id, alert_timestamp, alert_type, cnr)
SELECT i, TIMESTAMP '2026-06-01 09:00' + i * INTERVAL '1 day',
    (ARRAY['Hearing Reminder', 'Order Published', 'Case Status Change', 'Document Uploaded'])[1 + i % 4],
    fn_cnr(i)
FROM generate_series(1, 100) AS i;

-- ---------------------------------------------------------------------
-- 18. R18: ALERT_RECIPIENT (200 deliveries: 2 per alert)
-- ---------------------------------------------------------------------
INSERT INTO alert_recipient (alert_id, user_id, alert_status)
SELECT i, 100 + i, CASE WHEN i % 2 = 0 THEN 'Read' ELSE 'Delivered' END
FROM generate_series(1, 100) AS i;

INSERT INTO alert_recipient (alert_id, user_id, alert_status)
SELECT i, i, CASE WHEN i % 3 = 0 THEN 'Read' ELSE 'Delivered' END
FROM generate_series(1, 100) AS i;

-- Clean up helper function
DROP FUNCTION fn_cnr(INTEGER);
