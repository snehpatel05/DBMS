import cv2
import numpy as np

img = cv2.imread(r'C:\Users\SNEH\.gemini\antigravity\brain\2e98fddc-e5c4-4880-b49d-587230d533fb\.user_uploaded\media_1793719483011.png')
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
_, thresh = cv2.threshold(gray, 180, 255, cv2.THRESH_BINARY_INV)
contours, hier = cv2.findContours(thresh, cv2.RETR_TREE, cv2.CHAIN_APPROX_TC89_KCOS)

ox, oy = 95, 55
cw, ch = 825, 585

def contour_to_path(cnt):
    approx = cv2.approxPolyDP(cnt, 0.75, True)
    if len(approx) < 3:
        return ""
    pts = approx.reshape(-1, 2)
    return f"M {pts[0][0]-ox} {pts[0][1]-oy} " + " ".join([f"L {p[0]-ox} {p[1]-oy}" for p in pts[1:]]) + " Z"

# Back folder tab
d_back = contour_to_path(contours[10])

# Front folder pocket
d_front = contour_to_path(contours[0])

# Scales outer contour + inner holes
scale_indices = [1, 2, 3, 4, 5, 6, 7, 8, 9]
d_scales = " ".join([contour_to_path(contours[i]) for i in scale_indices if contour_to_path(contours[i])])

svg_clean = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {cw} {ch}" width="100%" height="100%">
  <defs>
    <!-- Subtle drop shadow for crisp realism on white/light backgrounds -->
    <filter id="folderShadow" x="-5%" y="-5%" width="110%" height="115%" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#0F2821" flood-opacity="0.18" />
    </filter>
  </defs>
  
  <!-- Back Folder Tab -->
  <path d="{d_back}" fill="#14362C" />
  
  <!-- Front Folder Pocket with separation stroke -->
  <path d="{d_front}" fill="#1F4D3F" stroke="#FFFFFF" stroke-width="12" stroke-linejoin="round" />
  
  <!-- Front Folder Pocket Fill (to keep exact fill over stroke) -->
  <path d="{d_front}" fill="#1F4D3F" />
  
  <!-- Scales of Justice (Pure White with EvenOdd Fill) -->
  <path d="{d_scales}" fill="#FFFFFF" fill-rule="evenodd" />
</svg>'''

with open('public/logo.svg', 'w', encoding='utf-8') as f:
    f.write(svg_clean)

# Also create a square icon version for Favicon (512x512 with padding)
# Center the 825x585 folder into a square viewBox
pad_y = (825 - 585) // 2  # ~120
svg_favicon = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="-45 -{pad_y+20} 915 915" width="100%" height="100%">
  <rect x="-45" y="-{pad_y+20}" width="915" height="915" rx="180" fill="#F4F6F5"/>
  <!-- Back Folder Tab -->
  <path d="{d_back}" fill="#14362C" />
  <!-- Front Folder Pocket with stroke -->
  <path d="{d_front}" fill="#1F4D3F" stroke="#FFFFFF" stroke-width="14" stroke-linejoin="round" />
  <path d="{d_front}" fill="#1F4D3F" />
  <!-- Scales of Justice -->
  <path d="{d_scales}" fill="#FFFFFF" fill-rule="evenodd" />
</svg>'''

with open('public/favicon.svg', 'w', encoding='utf-8') as f:
    f.write(svg_favicon)

print("Generated public/logo.svg and public/favicon.svg successfully!")
