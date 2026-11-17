"""Design system + component HTML cho KIDS PARK Attendance.

Một stylesheet duy nhất giữ cho widget mặc định của Streamlit và các component
HTML tự dựng (KPI, badge, lịch tuần, hồ sơ nhân viên) cùng một ngôn ngữ thị giác.
"""

from __future__ import annotations

import datetime
from html import escape

import streamlit as st

# ---------------------------------------------------------------------------
# Hằng số nghiệp vụ dùng cho hiển thị
# ---------------------------------------------------------------------------
DAY_KEYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]
DAY_LABELS = {
    "T2": "Thứ 2",
    "T3": "Thứ 3",
    "T4": "Thứ 4",
    "T5": "Thứ 5",
    "T6": "Thứ 6",
    "T7": "Thứ 7",
    "CN": "Chủ nhật",
}

SHIFT_INFO = {
    "A": {"label": "Ca sáng", "time": "08:00 – 12:00", "tone": "A", "hours": 4},
    "C": {"label": "Ca chiều", "time": "13:00 – 17:00", "tone": "C", "hours": 4},
    "T": {"label": "Ca tối", "time": "17:30 – 21:30", "tone": "T", "hours": 4},
    "AC": {"label": "Sáng + Chiều", "time": "08:00 – 17:00", "tone": "AC", "hours": 8},
    "AT": {"label": "Sáng + Tối", "time": "08:00 – 12:00 · 17:30 – 21:30", "tone": "AT", "hours": 8},
    "OFF": {"label": "Nghỉ ca", "time": "Không xếp ca", "tone": "OFF", "hours": 0},
}
SHIFT_CODES = ["OFF", "A", "C", "T", "AC", "AT"]

ROLE_LABELS = {"Quan_ly": "Quản lý", "Nhan_vien": "Nhân viên"}
STATUS_LABELS = {"Dung_gio": "Đúng giờ", "Di_tre": "Đi trễ"}

# ---------------------------------------------------------------------------
# Icon (Lucide, stroke 1.8)
# ---------------------------------------------------------------------------
_ICONS = {
    "wheel": '<circle cx="12" cy="12" r="9"/><path d="M12 3v18"/><path d="M3 12h18"/>'
             '<path d="m5.6 5.6 12.8 12.8"/><path d="m18.4 5.6-12.8 12.8"/>',
    "layout": '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/>'
              '<rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
    "user-plus": '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>'
                 '<line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/>',
    "users": '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>'
             '<path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    "user": '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    "user-check": '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>'
                  '<polyline points="16 11 18 13 22 9"/>',
    "calendar": '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/>'
                '<path d="M3 10h18"/>',
    "calendar-check": '<path d="M21 10V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8"/>'
                      '<path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/><path d="m16 19 2 2 4-4"/>',
    "chart": '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
    "trending": '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
    "clipboard": '<rect width="8" height="4" x="8" y="2" rx="1"/>'
                 '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>'
                 '<path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
    "history": '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
    "camera": '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>'
              '<circle cx="12" cy="13" r="3"/>',
    "check": '<polyline points="20 6 9 17 4 12"/>',
    "clock": '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    "alert": '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/>'
             '<path d="M12 9v4"/><path d="M12 17h.01"/>',
    "inbox": '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>'
             '<path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    "search": '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    "save": '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/>'
            '<path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/>',
    "download": '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/>'
                '<line x1="12" x2="12" y1="15" y2="3"/>',
    "logout": '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/>'
              '<line x1="21" x2="9" y1="12" y2="12"/>',
    "login": '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/>'
             '<line x1="15" x2="3" y1="12" y2="12"/>',
    "shield": '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1'
              'c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>'
              '<path d="m9 12 2 2 4-4"/>',
    "arrow-right": '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    "arrow-left": '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
    "chevron-right": '<path d="m9 18 6-6-6-6"/>',
    "chevron-left": '<path d="m15 18-6-6 6-6"/>',
    "sparkles": '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.4 1.3L3 12l5.7 1.9a2 2 0 0 1 1.4 1.3L12 21'
                'l1.9-5.8a2 2 0 0 1 1.4-1.3L21 12l-5.7-1.9a2 2 0 0 1-1.4-1.3z"/>',
    "bell": '<path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/><path d="M4 17h16"/>'
            '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/>',
    "briefcase": '<rect width="20" height="14" x="2" y="7" rx="2"/>'
                 '<path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
    "map-pin": '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    "id-card": '<rect width="20" height="14" x="2" y="5" rx="2"/><circle cx="8" cy="10" r="2"/>'
               '<path d="M14 9h4"/><path d="M14 13h4"/><path d="M4 17c0-2 2-3 4-3s4 1 4 3"/>',
    "wallet": '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2"/>'
              '<path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
    "file-text": '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>'
                 '<path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    "building": '<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M9 22v-4h6v4"/>'
                '<path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/>'
                '<path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/>',
    "filter": '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
    "sliders": '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/>'
               '<line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/>'
               '<line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/>'
               '<line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/>'
               '<line x1="16" x2="16" y1="18" y2="22"/>',
    "phone": '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6'
             ' 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81'
             'a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45'
             'c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
    "mail": '<rect width="20" height="16" x="2" y="4" rx="2"/>'
            '<path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    "cake": '<path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/>'
            '<path d="M2 21h20"/><path d="M7 8v3"/><path d="M12 8v3"/><path d="M17 8v3"/><path d="M7 4h.01"/><path d="M12 4h.01"/><path d="M17 4h.01"/>',
    "x": '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    "plus": '<path d="M5 12h14"/><path d="M12 5v14"/>',
    "refresh": '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>'
               '<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    "database": '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/>'
                '<path d="M3 12A9 3 0 0 0 21 12"/>',
    "lock": '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
}

# ---------------------------------------------------------------------------
# Stylesheet
# ---------------------------------------------------------------------------
_CSS = """
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

/* ==========================================================================
   1. DESIGN TOKENS
   ========================================================================== */
:root {
  /* Brand */
  --kp-primary: #4F46E5;
  --kp-primary-hover: #4338CA;
  --kp-primary-50: #EEF2FF;
  --kp-primary-100: #E0E7FF;
  --kp-accent: #0F766E;
  --kp-accent-50: #ECFDF5;

  /* Semantic */
  --kp-success: #047857;
  --kp-success-bg: #ECFDF5;
  --kp-warning: #B45309;
  --kp-warning-bg: #FFFBEB;
  --kp-danger: #B91C1C;
  --kp-danger-bg: #FEF2F2;
  --kp-info: #0369A1;
  --kp-info-bg: #E0F2FE;

  /* Neutral */
  --kp-ink: #1E1B4B;
  --kp-body: #3F3F5C;
  --kp-muted: #6B7280;
  --kp-faint: #8A91A8;
  --kp-page: #F7F7FC;
  --kp-surface: #FFFFFF;
  --kp-subtle: #FBFAFF;
  --kp-border: #E7E6F3;
  --kp-border-strong: #D8D7EA;

  /* Shape & depth */
  --kp-radius-sm: 8px;
  --kp-radius: 12px;
  --kp-radius-md: 16px;
  --kp-radius-lg: 20px;
  --kp-radius-xl: 26px;
  --kp-shadow-sm: 0 1px 2px rgba(30, 27, 75, .05);
  --kp-shadow: 0 1px 2px rgba(30, 27, 75, .05), 0 12px 26px -20px rgba(30, 27, 75, .35);
  --kp-shadow-md: 0 18px 40px -28px rgba(30, 27, 75, .40);
  --kp-shadow-lg: 0 40px 90px -50px rgba(49, 46, 129, .55);

  /* Spacing scale (dùng trực tiếp trong CSS, giữ 1 nguồn) */
  --kp-s1: 4px;  --kp-s2: 8px;  --kp-s3: 12px;
  --kp-s4: 16px; --kp-s5: 24px; --kp-s6: 32px;

  /* Interaction */
  --kp-ring: 0 0 0 3px rgba(99, 102, 241, .28);
  --kp-dur: 180ms;
}

/* ==========================================================================
   2. BASE / SHELL
   ========================================================================== */
.stApp {
  background-color: var(--kp-page);
  background-image:
    radial-gradient(1100px 520px at 100% -12%, #EAE7FF 0%, rgba(234, 231, 255, 0) 62%),
    radial-gradient(900px 460px at -8% 0%, #E6F7F1 0%, rgba(230, 247, 241, 0) 58%);
  background-attachment: fixed;
  color: var(--kp-body);
}
[data-testid="stHeader"] { background: transparent; }
[data-testid="stHeader"] [data-testid="stToolbar"] { right: .8rem; }
[data-testid="stAppDeployButton"], .stDeployButton { display: none !important; }
#MainMenu, footer { visibility: hidden; }

.block-container, [data-testid="stMainBlockContainer"] {
  padding-top: 1.4rem;
  padding-bottom: 3.4rem;
  max-width: 1320px;
}

/* ==========================================================================
   3. TYPOGRAPHY
   ========================================================================== */
.stApp,
.stApp p,
.stApp li,
.stApp label,
.stApp input,
.stApp textarea,
.stApp button,
.stApp h1, .stApp h2, .stApp h3, .stApp h4, .stApp h5, .stApp h6,
.stApp [data-testid="stMarkdownContainer"] {
  font-family: "Plus Jakarta Sans", -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
}
[data-testid="stIconMaterial"],
span[class*="material-symbols"],
.material-symbols-rounded {
  font-family: "Material Symbols Rounded" !important;
}
code, pre, kbd, [data-testid="stCodeBlock"] code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.stApp h1, .stApp h2, .stApp h3, .stApp h4 { color: var(--kp-ink); letter-spacing: -.03em; font-weight: 800; }
.stApp p { color: var(--kp-body); }
[data-testid="stCaptionContainer"] p { color: var(--kp-faint); font-size: 12.5px; }
[data-testid="InputInstructions"] { display: none; }
hr { border-color: #EFEEF8; }

/* Focus ring dùng chung, đủ tương phản WCAG */
a:focus-visible,
button:focus-visible,
input:focus-visible,
[role="button"]:focus-visible {
  outline: none;
  box-shadow: var(--kp-ring) !important;
}

/* ==========================================================================
   4. SIDEBAR
   ========================================================================== */
[data-testid="stSidebar"],
section[data-testid="stSidebar"] {
  background: var(--kp-surface);
  border-right: 1px solid #EFEEF8;
  width: 268px !important;
}

[data-testid="stSidebar"] [data-testid="stSidebarContent"],
section[data-testid="stSidebar"] [data-testid="stSidebarContent"] {
  padding: 0.85rem 0.8rem 0.85rem !important;
  overflow: hidden !important;
  scrollbar-width: none !important;
  -ms-overflow-style: none !important;
}
[data-testid="stSidebar"] [data-testid="stSidebarContent"]::-webkit-scrollbar,
section[data-testid="stSidebar"] [data-testid="stSidebarContent"]::-webkit-scrollbar {
  display: none !important;
  width: 0 !important;
  height: 0 !important;
}

[data-testid="stSidebar"] [data-testid="stVerticalBlock"],
section[data-testid="stSidebar"] [data-testid="stVerticalBlock"] {
  gap: 5px !important;
}

[data-testid="stSidebar"] [data-testid="stVerticalBlockBorderWrapper"],
section[data-testid="stSidebar"] [data-testid="stVerticalBlockBorderWrapper"] {
  padding: 0 !important;
}

[data-testid="stSidebar"] div.stButton,
section[data-testid="stSidebar"] div.stButton {
  margin: 0 !important;
  padding: 0 !important;
}

[data-testid="stSidebar"] hr,
section[data-testid="stSidebar"] hr {
  margin: 8px 0 !important;
  border-color: #EFEEF8 !important;
}

[data-testid="stSidebar"] .stButton > button,
section[data-testid="stSidebar"] .stButton > button {
  justify-content: flex-start;
  width: 100%;
  min-height: 38px !important;
  height: 38px !important;
  background: transparent;
  border: 1px solid transparent;
  box-shadow: none;
  color: #4B5563;
  font-weight: 600;
  font-size: 13.5px !important;
  padding: 0.35rem 0.75rem !important;
  text-align: left;
  border-radius: 9px !important;
  transition: all var(--kp-dur) ease;
}

/* Căn trái icon + nhãn (Streamlit bọc label trong div riêng) */
[data-testid="stSidebar"] .stButton > button > div,
section[data-testid="stSidebar"] .stButton > button > div,
[data-testid="stSidebar"] .stButton > button [data-testid="stMarkdownContainer"],
section[data-testid="stSidebar"] .stButton > button [data-testid="stMarkdownContainer"] {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  text-align: left;
  gap: 8px !important;
}

[data-testid="stSidebar"] .stButton > button p,
section[data-testid="stSidebar"] .stButton > button p {
  text-align: left;
  font-size: 13.5px !important;
  font-weight: 600;
  margin: 0 !important;
  line-height: 1.2 !important;
}

[data-testid="stSidebar"] .stButton > button:hover,
section[data-testid="stSidebar"] .stButton > button:hover {
  background: var(--kp-primary-50);
  color: #3730A3;
  border-color: transparent;
}

[data-testid="stSidebar"] .stButton > button[data-testid^="stBaseButton-primary"],
section[data-testid="stSidebar"] .stButton > button[data-testid^="stBaseButton-primary"] {
  position: relative;
  background: linear-gradient(180deg, #6366F1 0%, #4F46E5 100%) !important;
  color: #FFFFFF !important;
  border-color: #4338CA !important;
  box-shadow: 0 8px 18px -10px rgba(67, 56, 202, .95) !important;
}

[data-testid="stSidebar"] .stButton > button[data-testid^="stBaseButton-primary"] p,
section[data-testid="stSidebar"] .stButton > button[data-testid^="stBaseButton-primary"] p {
  color: #FFFFFF !important;
  font-weight: 700 !important;
}

[data-testid="stSidebar"] .stButton > button[data-testid^="stBaseButton-primary"]:hover,
section[data-testid="stSidebar"] .stButton > button[data-testid^="stBaseButton-primary"]:hover {
  color: #FFFFFF;
  filter: brightness(1.05);
}

[data-testid="stSidebar"] .stButton > button[data-testid^="stBaseButton-primary"]::before,
section[data-testid="stSidebar"] .stButton > button[data-testid^="stBaseButton-primary"]::before {
  content: "";
  position: absolute;
  left: -6px; top: 7px; bottom: 7px;
  width: 3px; border-radius: 0 3px 3px 0;
  background: #A5B4FC;
}

[data-testid="stSidebar"] [data-testid="stIconMaterial"],
section[data-testid="stSidebar"] [data-testid="stIconMaterial"] {
  font-size: 18px !important;
}

/* ==========================================================================
   5. TOP BAR
   ========================================================================== */
.st-key-topbar {
  padding: .15rem .1rem .7rem;
  margin-bottom: .5rem;
  border-bottom: 1px solid #EDECF7;
}
.st-key-topbar [data-testid="stForm"] { border: none; padding: 0; background: transparent; }
.st-key-topbar [data-testid="stTextInput"] input {
  height: 40px;
  font-size: 13px;
  background: var(--kp-surface);
  border-radius: var(--kp-radius);
}
.st-key-topbar [data-testid="stTextInput"] > div > div { background: var(--kp-surface) !important; }
.st-key-top_search .stFormSubmitButton > button {
  width: 40px; height: 40px; padding: 0;
  border-radius: var(--kp-radius);
  border: 1px solid var(--kp-border);
  background: var(--kp-surface);
  color: #4338CA;
  box-shadow: none;
}
.st-key-top_search .stFormSubmitButton > button p { display: none; }
.st-key-top_search .stFormSubmitButton > button:hover { background: var(--kp-primary-50); border-color: #C7D2FE; }

[data-testid="stPopover"] > button {
  border-radius: var(--kp-radius);
  min-height: 40px;
  padding: 0 .75rem;
  gap: .35rem;
  background: var(--kp-surface);
  border: 1px solid var(--kp-border);
  color: #312E81;
  font-weight: 700;
  font-size: 13px;
  box-shadow: var(--kp-shadow-sm);
}
[data-testid="stPopover"] > button:hover {
  border-color: #C7D2FE;
  background: #F8F8FF;
  color: #4338CA;
}
[data-testid="stPopover"] > button p { font-size: 13px; font-weight: 700; }

/* Topbar: co giãn theo bề rộng, icon-only cho thông báo và avatar */
.st-key-topbar [data-testid="stHorizontalBlock"] { flex-wrap: nowrap; gap: 10px !important; }
.st-key-topbar [data-testid="stColumn"] { padding: 0 !important; min-width: 0; }
.st-key-topbar > div > div[data-testid="stHorizontalBlock"] > [data-testid="stColumn"]:nth-last-child(1),
.st-key-topbar > div > div[data-testid="stHorizontalBlock"] > [data-testid="stColumn"]:nth-last-child(2) {
  flex: 0 0 40px !important; width: 40px !important; min-width: 40px !important;
}
.st-key-topbar > div > div[data-testid="stHorizontalBlock"] > [data-testid="stColumn"]:nth-last-child(3) {
  flex: 1 1 0 !important; width: auto !important; min-width: 0 !important;
}
.st-key-topbar > div > div[data-testid="stHorizontalBlock"] > [data-testid="stColumn"]:nth-last-child(4) {
  flex: 0 1 auto !important; width: auto !important; min-width: 0 !important;
}
.st-key-topbar .stButton > button,
.st-key-topbar .stFormSubmitButton > button { min-height: 40px; }
.st-key-topbar [data-testid="stForm"] { margin: 0; }

.st-key-topbar_notify button,
.st-key-topbar_user button {
  width: 40px !important; min-width: 40px !important; height: 40px !important;
  padding: 0 !important; gap: 0 !important;
  border-radius: 12px !important;
  display: flex; align-items: center; justify-content: center;
}
.st-key-topbar_notify button [data-testid="stMarkdownContainer"] {
  position: absolute; width: 1px; height: 1px; margin: -1px;
  padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap;
}
.st-key-topbar_notify button > div > div:last-child,
.st-key-topbar_user button > div > div:last-child { display: none; }
.st-key-topbar_notify button [data-testid="stIconMaterial"] { font-size: 20px; color: #4338CA; }
.st-key-topbar_user button {
  border-radius: 999px !important;
  background: linear-gradient(180deg, #6366F1, #4338CA) !important;
  border-color: #4338CA !important;
  color: #FFFFFF !important;
  box-shadow: 0 10px 18px -12px rgba(67, 56, 202, .9);
}
.st-key-topbar_user button p { color: #FFFFFF !important; font-size: 12px; font-weight: 800; }

[data-testid="stPopoverBody"] {
  border-radius: var(--kp-radius-md);
  border: 1px solid var(--kp-border);
  box-shadow: var(--kp-shadow-md);
  padding: .9rem;
}

/* Breadcrumb */
.kp-crumb { display: flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 600; color: var(--kp-faint); }
.kp-crumb b { color: #312E81; font-weight: 700; }
.kp-crumb svg { color: #C3C7DA; flex: 0 0 auto; }

/* ==========================================================================
   6. BUTTONS & INPUTS
   ========================================================================== */
.stButton > button,
.stFormSubmitButton > button,
.stDownloadButton > button {
  border-radius: var(--kp-radius);
  border: 1px solid var(--kp-border);
  background: var(--kp-surface);
  color: #312E81;
  font-weight: 700;
  font-size: 13.5px;
  min-height: 40px;
  padding: .45rem 1rem;
  box-shadow: var(--kp-shadow-sm);
  transition: background var(--kp-dur) ease, border-color var(--kp-dur) ease,
              box-shadow var(--kp-dur) ease, color var(--kp-dur) ease,
              transform var(--kp-dur) ease, filter var(--kp-dur) ease;
}
.stButton > button:hover,
.stFormSubmitButton > button:hover,
.stDownloadButton > button:hover {
  border-color: #C7D2FE;
  background: #F8F8FF;
  color: var(--kp-primary-hover);
  box-shadow: 0 10px 20px -14px rgba(79, 70, 229, .55);
}
.stButton > button:active,
.stFormSubmitButton > button:active,
.stDownloadButton > button:active { transform: translateY(1px); }
.stButton > button:disabled,
.stFormSubmitButton > button:disabled { opacity: .55; cursor: not-allowed; box-shadow: none; }

.stButton > button[data-testid^="stBaseButton-primary"],
.stFormSubmitButton > button[data-testid^="stBaseButton-primary"],
.stDownloadButton > button[data-testid^="stBaseButton-primary"],
.stButton > button[kind="primary"] {
  background: linear-gradient(180deg, #6366F1 0%, #4F46E5 100%);
  border-color: #4338CA;
  color: #FFFFFF;
  box-shadow: 0 14px 26px -16px rgba(67, 56, 202, .95);
}
.stButton > button[data-testid^="stBaseButton-primary"] p,
.stFormSubmitButton > button[data-testid^="stBaseButton-primary"] p,
.stDownloadButton > button[data-testid^="stBaseButton-primary"] p { color: #FFFFFF; }
.stButton > button[data-testid^="stBaseButton-primary"]:hover,
.stFormSubmitButton > button[data-testid^="stBaseButton-primary"]:hover,
.stDownloadButton > button[data-testid^="stBaseButton-primary"]:hover {
  color: #FFFFFF;
  background: linear-gradient(180deg, #6D70F5 0%, #5148EA 100%);
}
/* Tertiary: dùng cho hành động phụ, không viền */
.stButton > button[data-testid^="stBaseButton-tertiary"] {
  background: transparent;
  border-color: transparent;
  box-shadow: none;
  color: #4B5563;
}
.stButton > button[data-testid^="stBaseButton-tertiary"]:hover {
  background: var(--kp-primary-50);
  border-color: transparent;
  color: var(--kp-primary-hover);
}

/* Inputs */
div[data-baseweb="input"],
div[data-baseweb="base-input"],
div[data-baseweb="select"] > div,
div[data-baseweb="textarea"] {
  border-radius: var(--kp-radius) !important;
  border-color: var(--kp-border) !important;
  background: var(--kp-surface) !important;
  transition: border-color var(--kp-dur) ease, box-shadow var(--kp-dur) ease;
}
div[data-baseweb="input"]:focus-within,
div[data-baseweb="base-input"]:focus-within,
div[data-baseweb="select"] > div:focus-within,
div[data-baseweb="textarea"]:focus-within {
  border-color: #818CF8 !important;
  box-shadow: var(--kp-ring);
}
.stTextInput input, .stNumberInput input, .stDateInput input { color: var(--kp-ink); font-size: 14px; }
.stTextInput label p, .stSelectbox label p, .stDateInput label p, .stCameraInput label p {
  font-size: 12.5px; font-weight: 700; color: #475569;
}
div[data-baseweb="popover"] ul { border-radius: var(--kp-radius); }
div[data-baseweb="calendar"] { border-radius: var(--kp-radius); }

/* ==========================================================================
   7. DATA, TABS, FEEDBACK
   ========================================================================== */
[data-testid="stAlert"] {
  border-radius: var(--kp-radius);
  border: 1px solid var(--kp-border);
  background: var(--kp-surface);
  box-shadow: var(--kp-shadow-sm);
}
[data-testid="stAlert"] p { font-size: 13.5px; color: #312E81; }

[data-testid="stDataFrame"], [data-testid="stDataFrameResizable"] {
  border: 1px solid var(--kp-border);
  border-radius: var(--kp-radius-md);
  overflow: hidden;
  background: var(--kp-surface);
  box-shadow: var(--kp-shadow-sm);
}

/* Tabs: Streamlit 1.6x dùng react-aria ([role=tablist] + [data-testid=stTab]) */
[data-testid="stTabs"] [role="tablist"] {
  gap: 4px;
  background: #F1F0FA;
  padding: 4px;
  border-radius: var(--kp-radius);
  width: fit-content;
  border-bottom: none;
}
[data-testid="stTab"] {
  border-radius: 9px;
  padding: 6px 14px;
  min-height: 34px;
  height: auto;
  background: transparent;
  display: flex;
  align-items: center;
  cursor: pointer;
  transition: background var(--kp-dur) ease, box-shadow var(--kp-dur) ease;
}
[data-testid="stTab"] p { font-size: 13px; font-weight: 700; color: #5B6178; margin: 0; }
[data-testid="stTab"]:hover { background: rgba(255, 255, 255, .65); }
[data-testid="stTab"][aria-selected="true"] {
  background: var(--kp-surface);
  box-shadow: 0 2px 8px rgba(30, 27, 75, .10);
}
[data-testid="stTab"][aria-selected="true"] p { color: #312E81; }
[data-testid="stTabs"] [role="tablist"] > div[aria-hidden="true"],
[data-testid="stTabs"] [role="tablist"]::after { display: none !important; }

/* Tương thích Streamlit cũ dùng baseweb */
[data-baseweb="tab-list"] {
  gap: 4px;
  background: #F1F0FA;
  padding: 4px;
  border-radius: var(--kp-radius);
  width: fit-content;
  border-bottom: none;
}
[data-baseweb="tab"] {
  border-radius: 9px;
  padding: 6px 14px;
  height: auto;
  background: transparent;
}
[data-baseweb="tab"] p { font-size: 13px; font-weight: 700; color: #5B6178; }
[data-baseweb="tab"][aria-selected="true"] {
  background: var(--kp-surface);
  box-shadow: 0 2px 8px rgba(30, 27, 75, .10);
}
[data-baseweb="tab"][aria-selected="true"] p { color: #312E81; }
[data-baseweb="tab-highlight"], [data-baseweb="tab-border"] { display: none; }

[data-testid="stToast"] {
  border-radius: var(--kp-radius-md);
  border: 1px solid var(--kp-border);
  box-shadow: var(--kp-shadow-md);
  background: var(--kp-surface);
}
[data-testid="stToast"] p { font-size: 13px; color: var(--kp-ink); }
[data-testid="stSkeleton"] {
  background: linear-gradient(90deg, #F1F0FA 25%, #E9E7F6 37%, #F1F0FA 63%);
  border-radius: var(--kp-radius);
}

[data-testid="stExpander"] {
  border: 1px solid var(--kp-border);
  border-radius: var(--kp-radius-md);
  background: var(--kp-surface);
  box-shadow: var(--kp-shadow-sm);
}
[data-testid="stCameraInput"] video, [data-testid="stCameraInput"] img { border-radius: var(--kp-radius-md); }
[data-testid="stCameraInput"] button { border-radius: var(--kp-radius); }

/* ==========================================================================
   8. KEYED CARDS
   ========================================================================== */
.st-key-login_card {
  background: var(--kp-surface);
  border: 1px solid #EDEBFA;
  border-radius: var(--kp-radius-xl);
  box-shadow: var(--kp-shadow-lg);
  padding: 1.7rem 1.7rem 1.4rem;
}
.st-key-form_card, .st-key-toolbar_card, .st-key-chart_card, .st-key-cam_card,
.st-key-tasks_card, .st-key-feed_card, .st-key-side_card, .st-key-table_card {
  background: var(--kp-surface);
  border: 1px solid var(--kp-border);
  border-radius: var(--kp-radius-lg);
  box-shadow: var(--kp-shadow);
  padding: 1rem 1.05rem .85rem;
}
.st-key-toolbar_card { padding: .85rem 1rem .5rem; }
.st-key-schedule_editor {
  background: var(--kp-surface);
  border: 1px solid var(--kp-border);
  border-radius: var(--kp-radius-md);
  box-shadow: var(--kp-shadow);
  padding: .9rem .95rem .4rem;
}
.st-key-selection_bar {
  background: linear-gradient(120deg, #F5F3FF, #EEF7F4);
  border: 1px solid #DDD9FB;
  border-radius: var(--kp-radius-md);
  padding: .7rem .9rem;
  margin-top: .6rem;
}
.st-key-logout_box .stButton > button {
  justify-content: center;
  background: var(--kp-subtle);
  border: 1px solid var(--kp-border);
  color: #4338CA;
  font-weight: 700;
}
.st-key-logout_box .stButton > button:hover {
  background: var(--kp-danger-bg);
  border-color: #FECACA;
  color: var(--kp-danger);
}
.st-key-logout_box .stButton > button > div { justify-content: center; }

/* ==========================================================================
   9. COMPONENTS
   ========================================================================== */
/* Brand */
.kp-brand { display: flex; align-items: center; gap: 10px; margin: 0.15rem 0 .75rem; padding: 0 4px; }
.kp-brand__mark {
  width: 34px; height: 34px; border-radius: 10px;
  background: linear-gradient(180deg, #6366F1, #4F46E5);
  display: flex; align-items: center; justify-content: center;
  color: #FFFFFF; box-shadow: 0 8px 16px -8px rgba(79, 70, 229, .8);
  flex: 0 0 34px;
}
.kp-brand__name { font-weight: 800; font-size: 13.5px; letter-spacing: .12em; color: var(--kp-ink); line-height: 1.2; }
.kp-brand__sub { font-size: 11px; color: var(--kp-muted); letter-spacing: .02em; }

/* User card */
.kp-user {
  display: flex; gap: 10px; align-items: center;
  padding: 8px 10px; margin-bottom: .65rem;
  border: 1px solid var(--kp-border); border-radius: 12px;
  background: linear-gradient(180deg, #FCFCFF, #F6F4FF);
}
.kp-avatar {
  width: 32px; height: 32px; border-radius: 50%;
  background: linear-gradient(180deg, #6366F1, #4338CA);
  color: #FFFFFF; display: flex; align-items: center; justify-content: center;
  font-weight: 800; font-size: 12px; letter-spacing: .02em; flex: 0 0 32px;
}
.kp-avatar--sm { width: 26px; height: 26px; flex: 0 0 26px; font-size: 11px; }
.kp-avatar--soft { background: var(--kp-primary-50); color: #4338CA; }
.kp-user__name { font-size: 12.5px; font-weight: 700; color: var(--kp-ink); line-height: 1.25; }
.kp-user__meta { font-size: 11px; color: var(--kp-muted); margin-top: 2px; }
.kp-user__role {
  font-size: 9.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase;
  color: #4338CA; background: var(--kp-primary-50); border-radius: 999px;
  padding: 2px 6px; margin-left: 4px;
}
.kp-nav-label {
  display: block !important;
  font-size: 10.5px !important;
  font-weight: 800 !important;
  letter-spacing: .12em !important;
  text-transform: uppercase !important;
  color: #9AA0B5 !important;
  padding: 12px 6px 6px !important;
  margin: 0 !important;
  line-height: 1.3 !important;
}
/* Streamlit đặt margin-bottom: -16px trên stMarkdownContainer, khiến nhãn nhóm
   tràn xuống và nút active đè lên chữ. Chỉ ghi đè đúng container của nhãn nhóm. */
[data-testid="stSidebar"] [data-testid="stMarkdownContainer"]:has(> .kp-nav-label) {
  margin-bottom: 0 !important;
}
.kp-side-foot {
  margin-top: .75rem; padding-top: .6rem; border-top: 1px solid #F1EFFB;
  font-size: 11px; color: #A5A8BF; text-align: center; letter-spacing: .04em;
}

/* Page header */
.kp-head { margin: 0 0 1.05rem; }
.kp-eyebrow {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 10.5px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase;
  color: #4338CA; background: var(--kp-primary-50);
  padding: 4px 10px; border-radius: 999px;
}
.kp-title {
  font-size: 29px; font-weight: 800; letter-spacing: -.035em; line-height: 1.18;
  color: var(--kp-ink); margin: 10px 0 5px;
}
.kp-sub { font-size: 13.5px; color: var(--kp-muted); margin: 0; max-width: 82ch; line-height: 1.6; }
.kp-section {
  display: flex; align-items: baseline; justify-content: space-between; gap: 10px;
  font-size: 11.5px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase;
  color: #4B5563; margin: 1.35rem 0 .65rem;
}
.kp-section--tight { margin-top: .8rem; margin-bottom: .55rem; }
.kp-section__hint { font-size: 11px; font-weight: 600; letter-spacing: 0; text-transform: none; color: var(--kp-faint); }

/* KPI */
.kp-kpi-grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(196px, 1fr)); }
.kp-kpi-grid--3 { grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); }
.kp-kpi {
  display: flex; gap: 13px; align-items: flex-start;
  background: var(--kp-surface); border: 1px solid var(--kp-border); border-radius: var(--kp-radius-md);
  padding: 14px 16px; box-shadow: var(--kp-shadow); min-height: 96px; height: 100%;
}
.kp-kpi__icon {
  width: 38px; height: 38px; border-radius: 11px; flex: 0 0 38px;
  display: flex; align-items: center; justify-content: center;
  background: var(--kp-primary-50); color: var(--kp-primary);
}
.kp-kpi--accent .kp-kpi__icon { background: var(--kp-accent-50); color: var(--kp-success); }
.kp-kpi--amber .kp-kpi__icon { background: var(--kp-warning-bg); color: var(--kp-warning); }
.kp-kpi--violet .kp-kpi__icon { background: #F5F3FF; color: #6D28D9; }
.kp-kpi--danger .kp-kpi__icon { background: var(--kp-danger-bg); color: var(--kp-danger); }
.kp-kpi--info .kp-kpi__icon { background: var(--kp-info-bg); color: var(--kp-info); }
.kp-kpi__body { min-width: 0; }
.kp-kpi__label {
  font-size: 10px; font-weight: 800; letter-spacing: .09em; text-transform: uppercase;
  color: var(--kp-faint); margin-bottom: 3px;
}
.kp-kpi__value {
  font-size: 25px; font-weight: 800; letter-spacing: -.03em; color: var(--kp-ink);
  line-height: 1.12; font-variant-numeric: tabular-nums;
}
.kp-kpi__value--sm { font-size: 16px; letter-spacing: -.01em; }
.kp-kpi__hint { font-size: 11.3px; color: var(--kp-muted); margin-top: 3px; line-height: 1.45; }

/* Chips & badges */
.kp-chip {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 9px; border-radius: 999px;
  font-size: 11.3px; font-weight: 700; line-height: 1.7; white-space: nowrap;
}
.kp-chip--brand { background: var(--kp-primary-50); color: #4338CA; }
.kp-chip--green { background: var(--kp-success-bg); color: var(--kp-success); }
.kp-chip--amber { background: var(--kp-warning-bg); color: #92400E; }
.kp-chip--red { background: var(--kp-danger-bg); color: var(--kp-danger); }
.kp-chip--slate { background: #F1F5F9; color: #475569; }
.kp-chip--info { background: var(--kp-info-bg); color: var(--kp-info); }
.kp-chip__dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

.kp-shift {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 2px 8px; border-radius: 7px;
  font-size: 11px; font-weight: 800; letter-spacing: .03em;
}
.kp-shift--A { background: #EEF2FF; color: #4338CA; }
.kp-shift--C { background: #E0F2FE; color: #0369A1; }
.kp-shift--T { background: #F3E8FF; color: #6D28D9; }
.kp-shift--AC { background: #CCFBF1; color: #0F766E; }
.kp-shift--AT { background: #FEF3C7; color: #92400E; }
.kp-shift--OFF { background: #F1F5F9; color: #64748B; }

.kp-legend { display: flex; flex-wrap: wrap; gap: 7px; margin: .2rem 0 .1rem; }
.kp-legend__item {
  display: inline-flex; align-items: center; gap: 6px;
  background: var(--kp-surface); border: 1px solid var(--kp-border); border-radius: 999px;
  padding: 3px 10px 3px 5px; font-size: 11.3px; color: #475569; font-weight: 600;
}

/* Panels, notices, empty states */
.kp-panel {
  background: var(--kp-surface); border: 1px solid var(--kp-border); border-radius: var(--kp-radius-lg);
  padding: 16px 17px; box-shadow: var(--kp-shadow); margin-bottom: .8rem;
}
.kp-panel__head { display: flex; gap: 10px; align-items: center; margin-bottom: .8rem; }
.kp-panel__icon {
  width: 34px; height: 34px; border-radius: 10px; flex: 0 0 34px;
  background: var(--kp-primary-50); color: var(--kp-primary);
  display: flex; align-items: center; justify-content: center;
}
.kp-panel__title { font-weight: 800; font-size: 14px; color: var(--kp-ink); }
.kp-panel__list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 11px; }
.kp-panel__item { display: flex; gap: 10px; font-size: 12.8px; color: #475569; line-height: 1.55; }
.kp-panel__item b { color: var(--kp-ink); font-weight: 700; }
.kp-step {
  width: 22px; height: 22px; border-radius: 50%; flex: 0 0 22px;
  background: var(--kp-primary-50); color: #4338CA;
  font-size: 11px; font-weight: 800;
  display: flex; align-items: center; justify-content: center; margin-top: 1px;
}

.kp-notice {
  display: flex; gap: 12px; align-items: flex-start;
  padding: 13px 15px; border-radius: var(--kp-radius); border: 1px solid; margin: .7rem 0;
}
.kp-notice--success { background: #F0FDF4; border-color: #BBF7D0; color: #065F46; }
.kp-notice--error { background: var(--kp-danger-bg); border-color: #FECACA; color: #991B1B; }
.kp-notice--warning { background: var(--kp-warning-bg); border-color: #FDE68A; color: #92400E; }
.kp-notice--info { background: var(--kp-primary-50); border-color: #C7D2FE; color: #3730A3; }
.kp-notice__title { font-weight: 800; font-size: 13.3px; line-height: 1.4; }
.kp-notice__body { font-size: 12.6px; line-height: 1.55; margin-top: 2px; opacity: .94; }

.kp-empty {
  text-align: center; padding: 38px 22px;
  border: 1px dashed var(--kp-border-strong); border-radius: var(--kp-radius-lg); background: var(--kp-subtle);
}
.kp-empty__icon {
  width: 46px; height: 46px; border-radius: 14px; margin: 0 auto 12px;
  background: var(--kp-primary-50); color: #6366F1;
  display: flex; align-items: center; justify-content: center;
}
.kp-empty__title { font-size: 15px; font-weight: 800; color: var(--kp-ink); }
.kp-empty__desc { font-size: 12.8px; color: var(--kp-muted); margin-top: 4px; line-height: 1.55; max-width: 52ch; margin-left: auto; margin-right: auto; }

/* ==========================================================================
   10. DATA COMPONENTS
   ========================================================================== */
/* Task list (việc cần xử lý) */
.kp-tasks { display: flex; flex-direction: column; gap: 8px; }
.kp-task {
  display: grid; grid-template-columns: 34px minmax(0, 1fr) auto;
  gap: 11px; align-items: center;
  padding: 10px 11px; border: 1px solid #EFEEF8; border-radius: 13px; background: var(--kp-subtle);
}
.kp-task > div:nth-child(2) { min-width: 0; }
.kp-task__icon {
  width: 34px; height: 34px; border-radius: 10px; flex: 0 0 34px;
  display: flex; align-items: center; justify-content: center;
  background: var(--kp-primary-50); color: var(--kp-primary);
}
.kp-task--amber .kp-task__icon { background: var(--kp-warning-bg); color: var(--kp-warning); }
.kp-task--danger .kp-task__icon { background: var(--kp-danger-bg); color: var(--kp-danger); }
.kp-task--green .kp-task__icon { background: var(--kp-success-bg); color: var(--kp-success); }
.kp-task__title { font-size: 12.6px; font-weight: 700; color: var(--kp-ink); line-height: 1.35; }
.kp-task__meta { font-size: 11.2px; color: var(--kp-muted); margin-top: 1px; line-height: 1.4; }
.kp-task__count {
  font-size: 17px; font-weight: 800; color: var(--kp-ink);
  font-variant-numeric: tabular-nums; padding-left: 4px;
}

/* Feed (điểm danh hôm nay) */
.kp-feed { display: flex; flex-direction: column; }
.kp-feed__row { display: flex; align-items: center; gap: 10px; padding: 8px 2px; border-bottom: 1px dashed #EFEEF8; }
.kp-feed__row:last-child { border-bottom: none; }
.kp-feed__name { font-size: 12.8px; font-weight: 700; color: var(--kp-ink); line-height: 1.3; }
.kp-feed__meta { font-size: 11.2px; color: var(--kp-muted); margin-top: 1px; }
.kp-feed__right { margin-left: auto; text-align: right; display: flex; align-items: center; gap: 8px; }
.kp-feed__time { font-variant-numeric: tabular-nums; font-size: 12px; font-weight: 700; color: #475569; }
.kp-feed__empty { font-size: 12.5px; color: var(--kp-muted); padding: 8px 2px; }

/* Info grid (hồ sơ) */
.kp-info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 13px 18px; }
.kp-info__label {
  font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase;
  color: var(--kp-faint);
}
.kp-info__value { font-size: 13.3px; font-weight: 700; color: var(--kp-ink); margin-top: 2px; line-height: 1.45; }

/* Profile header */
.kp-profile {
  display: flex; gap: 16px; align-items: center;
  background: linear-gradient(120deg, #FFFFFF 0%, #FAF9FF 55%, #EFF8F4 100%);
  border: 1px solid var(--kp-border); border-radius: var(--kp-radius-lg);
  padding: 17px 19px; box-shadow: var(--kp-shadow); margin-bottom: .9rem;
}
.kp-profile__avatar {
  width: 62px; height: 62px; border-radius: 19px; flex: 0 0 62px;
  background: linear-gradient(180deg, #6366F1, #4338CA); color: #FFFFFF;
  display: flex; align-items: center; justify-content: center;
  font-weight: 800; font-size: 20px; letter-spacing: .01em;
  box-shadow: 0 14px 26px -16px rgba(67, 56, 202, .95);
}
.kp-profile__name { font-size: 20px; font-weight: 800; color: var(--kp-ink); letter-spacing: -.02em; line-height: 1.25; }
.kp-profile__meta { font-size: 12.5px; color: var(--kp-muted); margin-top: 3px; }
.kp-profile__chips { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }

/* Detail list */
.kp-kv { display: flex; flex-direction: column; gap: 0; }
.kp-kv__row { display: flex; gap: 12px; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #EFEEF8; font-size: 12.6px; }
.kp-kv__row:last-child { border-bottom: none; }
.kp-kv__k { color: var(--kp-muted); }
.kp-kv__v { color: var(--kp-ink); font-weight: 700; text-align: right; }

/* Field error (validate inline) */
.kp-field-error {
  display: flex; align-items: center; gap: 5px;
  margin: -4px 0 6px; font-size: 11.5px; font-weight: 600; color: var(--kp-danger);
}
.kp-field-error svg { flex: 0 0 auto; }

/* ==========================================================================
   11. LOGIN
   ========================================================================== */
.kp-hero {
  position: relative; overflow: hidden;
  border-radius: 28px; padding: 36px 34px;
  color: #FFFFFF;
  display: flex; flex-direction: column; justify-content: center;
  background: linear-gradient(140deg, #312E81 0%, #4F46E5 48%, #7C3AED 100%);
  box-shadow: var(--kp-shadow-lg);
}
.kp-hero::before {
  content: ""; position: absolute; width: 360px; height: 360px; border-radius: 50%;
  background: rgba(255, 255, 255, .10); top: -130px; right: -100px;
}
.kp-hero::after {
  content: ""; position: absolute; width: 280px; height: 280px; border-radius: 50%;
  background: rgba(16, 185, 129, .30); bottom: -120px; left: -80px;
}
.kp-hero > * { position: relative; z-index: 1; }
.kp-hero__badge {
  display: inline-flex; align-items: center; gap: 7px; align-self: flex-start;
  background: rgba(255, 255, 255, .14); border: 1px solid rgba(255, 255, 255, .24);
  padding: 5px 12px; border-radius: 999px;
  font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
}
.kp-dot { width: 6px; height: 6px; border-radius: 50%; background: #34D399; box-shadow: 0 0 0 3px rgba(52, 211, 153, .25); }
.kp-hero h1 {
  color: #FFFFFF; font-size: 34px; line-height: 1.16; font-weight: 800;
  letter-spacing: -.035em; margin: 16px 0 11px;
}
.stApp p.kp-hero__lead {
  color: rgba(255, 255, 255, .86); font-size: 14px; line-height: 1.65;
  margin: 0 0 22px; max-width: 46ch;
}
.kp-hero__item { display: flex; gap: 12px; align-items: flex-start; margin-top: 12px; }
.kp-hero__ic {
  width: 34px; height: 34px; border-radius: 10px; flex: 0 0 34px;
  background: rgba(255, 255, 255, .14); border: 1px solid rgba(255, 255, 255, .18);
  display: flex; align-items: center; justify-content: center;
}
.kp-hero__ititle { font-size: 13.5px; font-weight: 700; color: #FFFFFF; }
.kp-hero__idesc { font-size: 12px; color: rgba(255, 255, 255, .72); margin-top: 1px; line-height: 1.5; }
.kp-hero__foot {
  margin-top: 24px; padding-top: 14px; border-top: 1px solid rgba(255, 255, 255, .16);
  font-size: 11.5px; color: rgba(255, 255, 255, .72); display: flex; gap: 8px; align-items: center;
}

.kp-login-head { margin-bottom: 1rem; }
.kp-login-title { font-size: 24px; font-weight: 800; letter-spacing: -.03em; color: var(--kp-ink); }
.kp-login-sub { font-size: 13px; color: var(--kp-muted); margin-top: 3px; line-height: 1.55; }

.kp-hint {
  margin-top: 1rem; padding: 13px 14px;
  border-radius: var(--kp-radius); background: #F8F7FF; border: 1px dashed #DDD6FE;
}
.kp-hint__title {
  font-size: 10.5px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase;
  color: #6D28D9; margin-bottom: 7px;
}
.kp-hint__row { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; font-size: 12.3px; color: #475569; margin-top: 5px; }
.kp-hint code {
  background: var(--kp-surface); border: 1px solid var(--kp-border); border-radius: 6px;
  padding: 1px 6px; font-size: 11.5px; color: #3730A3;
}

/* ==========================================================================
   12. WEEK GRID
   ========================================================================== */
.kp-week { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(148px, 1fr)); }
.kp-day {
  background: var(--kp-surface); border: 1px solid var(--kp-border); border-radius: var(--kp-radius-md);
  padding: 13px 14px; box-shadow: var(--kp-shadow);
  display: flex; flex-direction: column; min-height: 132px;
}
.kp-day__top { display: flex; justify-content: space-between; align-items: baseline; gap: 6px; }
.kp-day__name { font-size: 10.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #64748B; }
.kp-day__date { font-size: 11px; color: var(--kp-faint); font-variant-numeric: tabular-nums; }
.kp-day__shift { font-size: 15px; font-weight: 800; color: var(--kp-ink); margin-top: 9px; letter-spacing: -.01em; }
.kp-day__time { font-size: 11.2px; color: #64748B; line-height: 1.5; margin-top: 2px; }
.kp-day__foot { display: flex; align-items: center; justify-content: space-between; margin-top: auto; padding-top: 10px; }
.kp-day--off { background: #FAFAFE; border-style: dashed; box-shadow: none; }
.kp-day--today { border-color: #A5B4FC; box-shadow: 0 0 0 3px rgba(99, 102, 241, .12); }
.kp-day__today { font-size: 9.5px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--kp-primary); }

/* ==========================================================================
   13. RESPONSIVE & MOTION
   ========================================================================== */
@media (max-width: 1100px) {
  .kp-title { font-size: 25px; }
  .kp-hero { padding: 30px 24px; }
  .kp-hero h1 { font-size: 29px; }
  .kp-kpi__value { font-size: 22px; }
  .kp-crumb { display: none; }
  .st-key-topbar > div > div[data-testid="stHorizontalBlock"] > [data-testid="stColumn"]:first-child { display: none; }
  .st-key-overview_row1 [data-testid="stHorizontalBlock"],
  .st-key-overview_row2 [data-testid="stHorizontalBlock"] { flex-wrap: wrap; }
  .st-key-overview_row1 [data-testid="stHorizontalBlock"] > [data-testid="stColumn"],
  .st-key-overview_row2 [data-testid="stHorizontalBlock"] > [data-testid="stColumn"] {
    flex: 1 1 100% !important;
    width: 100% !important;
    min-width: 0 !important;
  }
  .block-container, [data-testid="stMainBlockContainer"] { padding-left: 1rem; padding-right: 1rem; }
}
@media (max-width: 820px) {
  .kp-week { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .kp-kpi-grid { grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); }
  .kp-profile { flex-direction: column; align-items: flex-start; }
  .kp-profile__avatar { width: 52px; height: 52px; flex-basis: 52px; border-radius: 16px; font-size: 17px; }
}
@media (prefers-reduced-motion: reduce) {
  * { transition-duration: .01ms !important; animation-duration: .01ms !important; }
}

/* Ẩn sidebar ở màn hình đăng nhập */
body:has(.kp-login-marker) section[data-testid="stSidebar"],
body:has(.kp-login-marker) [data-testid="stSidebarCollapsedControl"],
body:has(.kp-login-marker) [data-testid="stExpandSidebarButton"] { display: none; }
"""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _clean(markup: str) -> str:
    """Bỏ xuống dòng/thụt lề để Streamlit không parse HTML thành code block."""
    return "".join(line.strip() for line in markup.strip().splitlines())


def icon(name: str, size: int = 18, stroke: float = 1.8) -> str:
    path = _ICONS.get(name, _ICONS["sparkles"])
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" '
        f'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="{stroke}" '
        f'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{path}</svg>'
    )


def initials(name: str) -> str:
    parts = [part for part in str(name or "").split() if part]
    if not parts:
        return "KP"
    return "".join(part[0] for part in parts[:2]).upper()


def inject_theme() -> None:
    st.html(f"<style>{_CSS}</style>")


# ---------------------------------------------------------------------------
# Components
# ---------------------------------------------------------------------------
def brand_block() -> str:
    return _clean(
        f"""
        <div class="kp-brand">
          <div class="kp-brand__mark">{icon("wheel", 16, 2.0)}</div>
          <div>
            <div class="kp-brand__name">KIDS PARK</div>
            <div class="kp-brand__sub">Attendance Suite</div>
          </div>
        </div>
        """
    )


def user_card(user: dict) -> str:
    name = str(user.get("ho_ten") or "Người dùng")
    is_manager = user.get("vai_tro") == "Quan_ly"
    role = "Quản lý" if is_manager else "Nhân viên"
    return _clean(
        f"""
        <div class="kp-user">
          <div class="kp-avatar">{escape(initials(name))}</div>
          <div>
            <div class="kp-user__name">{escape(name)}<span class="kp-user__role">{role}</span></div>
            <div class="kp-user__meta">{escape(str(user.get("ma_nv") or "—"))} · {escape(str(user.get("chuc_vu") or "—"))}</div>
          </div>
        </div>
        """
    )


def breadcrumb(section: str, page: str) -> str:
    return _clean(
        f"""
        <nav class="kp-crumb" aria-label="Breadcrumb">
          <span>KIDS PARK</span>{icon("chevron-right", 12)}
          <span>{escape(section)}</span>{icon("chevron-right", 12)}
          <b>{escape(page)}</b>
        </nav>
        """
    )


def page_header(title: str, subtitle: str = "", eyebrow: str = "") -> None:
    eyebrow_html = f'<div class="kp-eyebrow">{escape(eyebrow)}</div>' if eyebrow else ""
    sub_html = f'<p class="kp-sub">{escape(subtitle)}</p>' if subtitle else ""
    st.markdown(
        _clean(
            f"""
            <div class="kp-head">
              {eyebrow_html}
              <div class="kp-title">{escape(title)}</div>
              {sub_html}
            </div>
            """
        ),
        unsafe_allow_html=True,
    )


def section_label(text: str, hint: str = "", tight: bool = False) -> None:
    cls = "kp-section kp-section--tight" if tight else "kp-section"
    hint_html = f'<span class="kp-section__hint">{escape(hint)}</span>' if hint else ""
    st.markdown(f'<div class="{cls}"><span>{escape(text)}</span>{hint_html}</div>', unsafe_allow_html=True)


def kpi(label: str, value, hint: str = "", tone: str = "brand", icon_name: str = "sparkles") -> str:
    value_text = str(value)
    size_cls = " kp-kpi__value--sm" if len(value_text) > 12 else ""
    hint_html = f'<div class="kp-kpi__hint">{escape(hint)}</div>' if hint else ""
    return _clean(
        f"""
        <div class="kp-kpi kp-kpi--{tone}">
          <div class="kp-kpi__icon">{icon(icon_name, 19)}</div>
          <div class="kp-kpi__body">
            <div class="kp-kpi__label">{escape(label)}</div>
            <div class="kp-kpi__value{size_cls}">{escape(value_text)}</div>
            {hint_html}
          </div>
        </div>
        """
    )


def kpi_row(items: list[dict]) -> None:
    if not items:
        return
    cards = "".join(
        kpi(
            item["label"],
            item["value"],
            item.get("hint", ""),
            item.get("tone", "brand"),
            item.get("icon", "sparkles"),
        )
        for item in items
    )
    st.markdown(f'<div class="kp-kpi-grid">{cards}</div>', unsafe_allow_html=True)


def empty_state(title: str, desc: str = "", icon_name: str = "inbox") -> None:
    desc_html = f'<div class="kp-empty__desc">{escape(desc)}</div>' if desc else ""
    st.markdown(
        _clean(
            f"""
            <div class="kp-empty">
              <div class="kp-empty__icon">{icon(icon_name, 22)}</div>
              <div class="kp-empty__title">{escape(title)}</div>
              {desc_html}
            </div>
            """
        ),
        unsafe_allow_html=True,
    )


def notice(tone: str, title: str, body: str = "") -> None:
    """tone: success | error | warning | info"""
    icon_name = {"success": "check", "error": "alert", "warning": "alert", "info": "sparkles"}.get(tone, "sparkles")
    body_html = f'<div class="kp-notice__body">{escape(body)}</div>' if body else ""
    st.markdown(
        _clean(
            f"""
            <div class="kp-notice kp-notice--{tone}" role="status">
              <div>{icon(icon_name, 18, 2.1)}</div>
              <div>
                <div class="kp-notice__title">{escape(title)}</div>
                {body_html}
              </div>
            </div>
            """
        ),
        unsafe_allow_html=True,
    )


def field_error(message: str) -> None:
    st.markdown(
        f'<div class="kp-field-error">{icon("alert", 12, 2.2)}<span>{escape(message)}</span></div>',
        unsafe_allow_html=True,
    )


def panel(title: str, items: list[tuple[str, str]], icon_name: str = "sparkles", numbered: bool = True) -> str:
    rows = []
    for index, (item_title, item_desc) in enumerate(items, start=1):
        marker = (
            f'<span class="kp-step">{index}</span>'
            if numbered
            else f'<span class="kp-panel__icon" style="width:22px;height:22px;flex:0 0 22px">{icon(icon_name, 13)}</span>'
        )
        rows.append(
            f'<li class="kp-panel__item">{marker}'
            f"<div><b>{escape(item_title)}</b><br/>{escape(item_desc)}</div></li>"
        )
    return _clean(
        f"""
        <div class="kp-panel">
          <div class="kp-panel__head">
            <div class="kp-panel__icon">{icon(icon_name, 17)}</div>
            <div class="kp-panel__title">{escape(title)}</div>
          </div>
          <ul class="kp-panel__list">{"".join(rows)}</ul>
        </div>
        """
    )


def chip(text: str, tone: str = "brand", dot: bool = False) -> str:
    dot_html = '<span class="kp-chip__dot"></span>' if dot else ""
    return f'<span class="kp-chip kp-chip--{tone}">{dot_html}{escape(text)}</span>'


def status_chip(status: str) -> str:
    raw = str(status)
    label = STATUS_LABELS.get(raw, raw)
    tone = "green" if raw == "Dung_gio" or label == "Đúng giờ" else "red"
    return chip(label, tone, dot=True)


def shift_badge(code: str) -> str:
    info = SHIFT_INFO.get(code, SHIFT_INFO["OFF"])
    return f'<span class="kp-shift kp-shift--{info["tone"]}">{escape(code)}</span>'


def shift_legend() -> None:
    items = []
    for code in SHIFT_CODES:
        info = SHIFT_INFO[code]
        items.append(
            f'<span class="kp-legend__item">{shift_badge(code)}'
            f"<span>{escape(info['label'])} · {escape(info['time'])}</span></span>"
        )
    st.markdown(f'<div class="kp-legend">{"".join(items)}</div>', unsafe_allow_html=True)


def shift_hours(code: str) -> int:
    return int(SHIFT_INFO.get(code, SHIFT_INFO["OFF"])["hours"])


def week_grid(row: dict | None, start_date: datetime.date) -> str:
    today = datetime.date.today()
    cards = []
    for index, key in enumerate(DAY_KEYS):
        day = start_date + datetime.timedelta(days=index)
        code = (row or {}).get(key) or "OFF"
        info = SHIFT_INFO.get(code, SHIFT_INFO["OFF"])
        classes = "kp-day kp-day--off" if code == "OFF" else "kp-day"
        if day == today:
            classes += " kp-day--today"
        flag = '<span class="kp-day__today">Hôm nay</span>' if day == today else ""
        cards.append(
            _clean(
                f"""
                <div class="{classes}">
                  <div class="kp-day__top">
                    <span class="kp-day__name">{DAY_LABELS[key]}</span>
                    <span class="kp-day__date">{day.strftime('%d/%m')}</span>
                  </div>
                  <div class="kp-day__shift">{escape(info['label'])}</div>
                  <div class="kp-day__time">{escape(info['time'])}</div>
                  <div class="kp-day__foot">{shift_badge(code)}{flag}</div>
                </div>
                """
            )
        )
    return f'<div class="kp-week">{"".join(cards)}</div>'


def tasks_block(items: list[dict]) -> str:
    """items: [{title, meta, count, tone, icon}]"""
    rows = []
    for item in items:
        rows.append(
            _clean(
                f"""
                <div class="kp-task kp-task--{item.get('tone', 'brand')}">
                  <div class="kp-task__icon">{icon(item.get('icon', 'sparkles'), 17)}</div>
                  <div>
                    <div class="kp-task__title">{escape(item['title'])}</div>
                    <div class="kp-task__meta">{escape(item.get('meta', ''))}</div>
                  </div>
                  <div class="kp-task__count">{escape(str(item.get('count', '')))}</div>
                </div>
                """
            )
        )
    return f'<div class="kp-tasks">{"".join(rows)}</div>'


def feed_block(items: list[dict]) -> str:
    """items: [{name, meta, time, status_html}]"""
    if not items:
        return '<div class="kp-feed__empty">Chưa có lượt điểm danh nào hôm nay.</div>'
    rows = []
    for item in items:
        rows.append(
            _clean(
                f"""
                <div class="kp-feed__row">
                  <div class="kp-avatar kp-avatar--sm kp-avatar--soft">{escape(initials(item['name']))}</div>
                  <div>
                    <div class="kp-feed__name">{escape(item['name'])}</div>
                    <div class="kp-feed__meta">{escape(item.get('meta', ''))}</div>
                  </div>
                  <div class="kp-feed__right">
                    <span class="kp-feed__time">{escape(item.get('time', ''))}</span>
                    {item.get('status_html', '')}
                  </div>
                </div>
                """
            )
        )
    return f'<div class="kp-feed">{"".join(rows)}</div>'


def info_grid(items: list[tuple[str, str]]) -> str:
    cells = "".join(
        f'<div><div class="kp-info__label">{escape(label)}</div>'
        f'<div class="kp-info__value">{escape(str(value))}</div></div>'
        for label, value in items
    )
    return f'<div class="kp-info-grid">{cells}</div>'


def profile_header(employee: dict, extra_chips: list[str] | None = None) -> str:
    name = str(employee.get("Họ và Tên") or employee.get("ho_ten") or "Nhân viên")
    ma_nv = employee.get("Mã NV") or employee.get("ma_nv") or "—"
    chuc_vu = employee.get("Chức vụ") or employee.get("chuc_vu") or "—"
    khu_vuc = employee.get("Khu vực") or employee.get("khu_vuc") or "—"
    vai_tro = ROLE_LABELS.get(employee.get("Vai trò") or employee.get("vai_tro") or "", "Nhân viên")
    chips = [chip(vai_tro, "brand")]
    if extra_chips:
        chips.extend(extra_chips)
    return _clean(
        f"""
        <div class="kp-profile">
          <div class="kp-profile__avatar">{escape(initials(name))}</div>
          <div>
            <div class="kp-profile__name">{escape(name)}</div>
            <div class="kp-profile__meta">{escape(str(ma_nv))} · {escape(str(chuc_vu))} · {escape(str(khu_vuc))}</div>
            <div class="kp-profile__chips">{"".join(chips)}</div>
          </div>
        </div>
        """
    )


def login_hero() -> str:
    features = [
        ("camera", "Điểm danh bằng khuôn mặt", "Chụp ảnh trực tiếp từ webcam, ghi nhận tức thì."),
        ("calendar", "Phân ca theo tuần", "Xếp ca sáng, chiều, tối cho toàn bộ nhân sự."),
        ("chart", "Bảng công tháng", "Tổng hợp số liệu và xuất file Excel chỉ với một cú nhấp."),
    ]
    items = "".join(
        _clean(
            f"""
            <div class="kp-hero__item">
              <div class="kp-hero__ic">{icon(icon_name, 17)}</div>
              <div>
                <div class="kp-hero__ititle">{escape(title)}</div>
                <div class="kp-hero__idesc">{escape(desc)}</div>
              </div>
            </div>
            """
        )
        for icon_name, title, desc in features
    )
    return _clean(
        f"""
        <div class="kp-hero">
          <div class="kp-hero__badge"><span class="kp-dot"></span>Hệ thống nội bộ · KIDS PARK</div>
          <h1>Điểm danh nhân sự<br/>gọn và chính xác</h1>
          <p class="kp-hero__lead">Chấm công bằng khuôn mặt, phân ca theo tuần và báo cáo bảng công — tất cả trong một không gian làm việc.</p>
          {items}
          <div class="kp-hero__foot">{icon("shield", 15)}Dữ liệu lưu nội bộ trên MySQL của công viên.</div>
        </div>
        """
    )


def login_head() -> str:
    return _clean(
        """
        <div class="kp-login-head">
          <div class="kp-login-title">Đăng nhập</div>
          <div class="kp-login-sub">Dùng mã nhân viên do quản lý cấp để vào hệ thống.</div>
        </div>
        """
    )


def login_hint() -> str:
    return _clean(
        """
        <div class="kp-hint">
          <div class="kp-hint__title">Tài khoản thử nghiệm</div>
          <div class="kp-hint__row"><span>Quản lý</span><code>QL01</code><span>/</span><code>123456</code></div>
          <div class="kp-hint__row"><span>Nhân viên</span><span>mật khẩu mặc định</span><code>123456</code></div>
        </div>
        """
    )


def login_marker() -> None:
    st.markdown('<div class="kp-login-marker"></div>', unsafe_allow_html=True)
