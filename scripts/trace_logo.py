import cv2
import numpy as np

img = cv2.imread(r'C:\Users\SNEH\.gemini\antigravity\brain\2e98fddc-e5c4-4880-b49d-587230d533fb\.user_uploaded\media_1793719483011.png')
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
_, thresh = cv2.threshold(gray, 180, 255, cv2.THRESH_BINARY_INV)

# Find contours with tree hierarchy
contours, hier = cv2.findContours(thresh, cv2.RETR_TREE, cv2.CHAIN_APPROX_TC89_KCOS)

ox, oy = 95, 55
cw, ch = 825, 585

path_d_list = []
for cnt in contours:
    approx = cv2.approxPolyDP(cnt, 0.8, True)
    if len(approx) < 3:
        continue
    pts = approx.reshape(-1, 2)
    p_str = f"M {pts[0][0]-ox} {pts[0][1]-oy} " + " ".join([f"L {p[0]-ox} {p[1]-oy}" for p in pts[1:]]) + " Z"
    path_d_list.append(p_str)

full_d = " ".join(path_d_list)

svg_brand = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {cw} {ch}" width="100%" height="100%">
  <path d="{full_d}" fill="#1F4D3F" fill-rule="evenodd"/>
</svg>'''

with open('public/court-emblem.svg', 'w') as f:
    f.write(svg_brand)

print(f"Generated public/court-emblem.svg successfully, size: {len(svg_brand)} bytes")
