import os
import subprocess
import time

chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
if not os.path.exists(chrome_path):
    chrome_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

out_dir = os.path.abspath("docs/screenshots")
os.makedirs(out_dir, exist_ok=True)

targets = [
    ("01_cases_ledger.png", "http://localhost:3000", 3500),
    ("02_create_case_modal.png", "http://localhost:3000/?view=newCase", 3500),
    ("03_case_dossier_drawer.png", "http://localhost:3000/?view=drawer", 4500),
    ("04_edit_case_modal.png", "http://localhost:3000/?view=edit", 3500),
    ("05_delete_case_modal.png", "http://localhost:3000/?view=delete", 3500),
    ("06_rbac_switcher.png", "http://localhost:3000/?view=rbac", 3500),
    ("07_judge_bench_view.png", "http://localhost:3000/?view=judge", 4000),
    ("08_judge_bench_modal.png", "http://localhost:3000/?view=bench", 4500),
    ("09_advocate_documents.png", "http://localhost:3000/?view=advocate", 4000),
    ("10_admin_18_bcnf_audit.png", "http://localhost:3000/?view=audit", 4500),
]

for filename, url, budget in targets:
    out_file = os.path.join(out_dir, filename)
    cmd = [
        chrome_path,
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        f"--screenshot={out_file}",
        "--window-size=1280,820",
        f"--virtual-time-budget={budget}",
        url
    ]
    print(f"Capturing {filename} from {url}...")
    res = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if os.path.exists(out_file) and os.path.getsize(out_file) > 1000:
        print(f"  [OK] {filename} ({os.path.getsize(out_file)} bytes)")
    else:
        print(f"  [FAILED] {filename}: returncode {res.returncode}")

print("\nScreenshot capture process finished!")
