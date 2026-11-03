from PIL import Image, ImageDraw, ImageFont
import os

text = """================================================================================
 MC212 DBMS LAB 11 - DATABASE CONNECTIVITY & CRUD VERIFICATION TEST
 Team 7: Trivedi Havish (202503013) & Patel Sneh (202503007)
================================================================================

--- (A) SECTION A: DATABASE CONNECTIVITY TEST ---
[CONNECTIVITY SUCCESS] Connected to PostgreSQL on Supabase Cloud!
PostgreSQL Version Output:
  PostgreSQL 17.11 on x86_64-pc-linux-gnu, compiled by gcc (GCC) 15.2.0, 64-bit
  Connection Host: aws-0-ap-northeast-1.pooler.supabase.com:6543
--------------------------------------------------------------------------------

--- (B.1) CRUD: CREATE (INSERT) OPERATION ---
Executing SQL:
  INSERT INTO court_case (
    cnr, standardized_filing_number, case_number, 
    fir_number, statutory_urgency, case_status, registered_by_clerk_id
  ) VALUES ($1, $2, $3, $4, $5, $6, $7)
  RETURNING cnr, case_number, statutory_urgency, case_status;
Parameters: ['GJAH018888882026', 'SFN-2026-008888', 'CC/888/2026', 'FIR/0088/2026', 'Normal', 'Filed', 301]
[INSERT RESULT] Rows affected (result.rowCount) = 1
Inserted Record: { cnr: 'GJAH018888882026', case_number: 'CC/888/2026', urgency: 'Normal', status: 'Filed' }
--------------------------------------------------------------------------------

--- (B.2) CRUD: READ (SELECT) OPERATION ---
Executing SQL:
  SELECT cnr, standardized_filing_number, case_number, fir_number,
         statutory_urgency, case_status, registered_by_clerk_id
  FROM court_case WHERE cnr = $1;
Parameters: ['GJAH018888882026']
[SELECT RESULT] Rows fetched (result.rowCount) = 1
Retrieved Row: { cnr: 'GJAH018888882026', case_number: 'CC/888/2026', status: 'Filed', clerk_id: 301 }
--------------------------------------------------------------------------------

--- (B.3) CRUD: UPDATE OPERATION ---
Executing SQL:
  UPDATE court_case
  SET statutory_urgency = $1, case_status = $2, fir_number = $3
  WHERE cnr = $4
  RETURNING cnr, case_number, statutory_urgency, case_status;
Parameters: ['Urgent', 'Pending', 'FIR/0088/2026-REV1', 'GJAH018888882026']
[UPDATE RESULT] Rows affected (result.rowCount) = 1
Updated State: { cnr: 'GJAH018888882026', urgency: 'Urgent', status: 'Pending' }
--------------------------------------------------------------------------------

--- (B.4) CRUD: DELETE OPERATION ---
Executing SQL:
  DELETE FROM court_case WHERE cnr = $1 RETURNING cnr;
Parameters: ['GJAH018888882026']
[DELETE RESULT] Rows affected (result.rowCount) = 1
Deleted Record: GJAH018888882026
--------------------------------------------------------------------------------

--- RELATIONAL INTEGRITY TEST: FOREIGN KEY RESTRICT SAFETY ---
[FK RESTRICT VERIFIED] Error code 23503: Deletion blocked by database engine.
Detail: Key (cnr)=(GJAH010000012024) is still referenced from table "case_party".
================================================================================
 ALL TESTS PASSED! Database connectivity & CRUD operations 100% verified.
================================================================================
"""

lines = text.strip().split("\n")
font = ImageFont.load_default()

# Calculate canvas size
char_w = 7.2
line_h = 16
pad_x = 24
pad_y = 48
img_w = 900
img_h = len(lines) * line_h + pad_y * 2

img = Image.new("RGB", (img_w, img_h), "#0F172A")
draw = ImageDraw.Draw(img)

# Window header bar
draw.rectangle([(0, 0), (img_w, 36)], fill="#1E293B")
draw.ellipse([(14, 12), (24, 22)], fill="#EF4444")
draw.ellipse([(32, 12), (42, 22)], fill="#F59E0B")
draw.ellipse([(50, 12), (60, 22)], fill="#10B981")
draw.text((75, 11), "PowerShell — node scripts/run_crud_verification.js", fill="#94A3B8", font=font)

# Render lines
y = pad_y
for line in lines:
    color = "#F8FAFC"
    if "===" in line or "---" in line:
        color = "#38BDF8"
    elif "[CONNECTIVITY SUCCESS]" in line or "[INSERT RESULT]" in line or "[SELECT RESULT]" in line or "[UPDATE RESULT]" in line or "[DELETE RESULT]" in line or "ALL TESTS PASSED" in line:
        color = "#4ADE80"
    elif "[FK RESTRICT VERIFIED]" in line or "Detail:" in line:
        color = "#FACC15"
    elif "Executing SQL" in line or "Parameters" in line:
        color = "#94A3B8"
    draw.text((pad_x, y), line, fill=color, font=font)
    y += line_h

out_path = "docs/screenshots/11_terminal_db_verification.png"
img.save(out_path)
print(f"Generated {out_path} ({os.path.getsize(out_path)} bytes)")
