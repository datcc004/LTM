"""KIDS PARK Attendance — ứng dụng điểm danh nhân sự bằng khuôn mặt.

Khởi chạy:
    streamlit run app_streamlit.py
"""
from __future__ import annotations

import datetime
import hashlib
import importlib
import io
import os
import urllib.request

import cv2
import numpy as np
import pandas as pd
import streamlit as st

import database
import ui_theme as ui

# Reload để CSS/logic luôn cập nhật khi hot-reload
importlib.reload(database)
importlib.reload(ui)

from database import (
    add_employee,
    check_login,
    check_shift_attendance,
    delete_employee,
    get_all_faces,
    get_attendance_history,
    get_current_shift,
    get_employee_attendance,
    get_employee_face_status,
    get_employees,
    get_monthly_attendance_report,
    get_weekly_schedule_matrix,
    record_attendance,
    save_weekly_schedule_matrix,
    update_employee_face,
)

# =============================================================
# CẤU HÌNH TRANG
# =============================================================
st.set_page_config(
    page_title="KIDS PARK · Điểm danh nhân sự",
    page_icon="🎡",
    layout="wide",
    initial_sidebar_state="expanded",
)
ui.inject_theme()

# =============================================================
# CASCADE / FACE DETECTION
# =============================================================
CASCADE_URL = (
    "https://raw.githubusercontent.com/opencv/opencv/master/"
    "data/haarcascades/haarcascade_frontalface_default.xml"
)
CASCADE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models", "haarcascade_frontalface_default.xml")


@st.cache_resource(show_spinner=False)
def _load_face_cascade(path: str):
    return cv2.CascadeClassifier(path)


def _ensure_cascade():
    """Tải + nạp Haar cascade. Trả về (cascade, lỗi)."""
    if not os.path.exists(CASCADE_FILE):
        try:
            os.makedirs(os.path.dirname(CASCADE_FILE), exist_ok=True)
            with st.spinner("Đang tải mô hình nhận diện khuôn mặt..."):
                urllib.request.urlretrieve(CASCADE_URL, CASCADE_FILE)
        except Exception as exc:  # noqa: BLE001
            return None, f"Không tải được mô hình nhận diện: {exc}"
    cascade = _load_face_cascade(CASCADE_FILE)
    if cascade.empty():
        return None, "Tệp mô hình nhận diện không hợp lệ. Hãy xóa tệp XML và tải lại."
    return cascade, None


# =============================================================
# ĐIỀU HƯỚNG
# =============================================================
NAV_MANAGER = [
    ("Tổng quan", [("overview", "Tổng quan", ":material/space_dashboard:")]),
    ("Nhân sự", [
        ("people",    "Danh sách nhân sự", ":material/people:"),
        ("add_staff", "Thêm nhân viên",    ":material/person_add:"),
    ]),
    ("Vận hành", [
        ("schedule",  "Phân ca tuần",        ":material/calendar_month:"),
        ("monthly",   "Bảng công tháng",     ":material/table_chart:"),
        ("history",   "Lịch sử chấm công",  ":material/history:"),
    ]),
]

NAV_STAFF = [
    ("Cá nhân", [
        ("attendance", "Điểm danh",       ":material/photo_camera:"),
        ("my_schedule","Lịch của tôi",    ":material/event:"),
        ("my_history", "Lịch sử của tôi", ":material/history:"),
    ]),
]


def _nav_button(page_id: str, label: str, icon_str: str) -> bool:
    """Render một nút nav sidebar; trả True nếu đang active."""
    active = st.session_state.get("page") == page_id
    clicked = st.button(
        f"{icon_str}  {label}",
        key=f"nav_{page_id}",
        use_container_width=True,
        type="primary" if active else "secondary",
    )
    if clicked:
        st.session_state["page"] = page_id
        st.rerun()
    return active


def _render_sidebar(user: dict) -> None:
    with st.sidebar:
        # Brand + user card gộp vào 1 markdown
        st.markdown(
            ui.brand_block() + ui.user_card(user),
            unsafe_allow_html=True,
        )
        st.divider()

        nav = NAV_MANAGER if user["vai_tro"] == "Quan_ly" else NAV_STAFF
        for group_label, items in nav:
            st.markdown(
                f'<span class="kp-nav-label">{group_label}</span>',
                unsafe_allow_html=True,
            )
            for page_id, label, icon_str in items:
                _nav_button(page_id, label, icon_str)

        st.divider()
        with st.container(key="logout_box"):
            if st.button(":material/logout:  Đăng xuất", use_container_width=True):
                for key in list(st.session_state.keys()):
                    del st.session_state[key]
                st.rerun()

        st.markdown(
            '<div class="kp-side-foot">KIDS PARK · v2.1</div>',
            unsafe_allow_html=True,
        )


# =============================================================
# TOP BAR (breadcrumb + tìm kiếm + notify + avatar)
# =============================================================
def _render_topbar(user: dict, section: str, page_title: str) -> str | None:
    """Render thanh trên cùng. Trả về search query nếu có."""
    search_q = None
    with st.container(key="topbar"):
        c_crumb, c_search, c_notify, c_user = st.columns([3, 5, 1, 1])
        with c_crumb:
            st.markdown(ui.breadcrumb(section, page_title), unsafe_allow_html=True)
        with c_search:
            with st.form(key="top_search", border=False):
                sc1, sc2 = st.columns([6, 1])
                with sc1:
                    q = st.text_input(
                        "search", label_visibility="collapsed",
                        placeholder="Tìm nhân viên theo tên hoặc mã...",
                    )
                with sc2:
                    submitted = st.form_submit_button(":material/search:  Tìm")
                if submitted and q:
                    search_q = q
        with c_notify:
            with st.container(key="topbar_notify"):
                st.button(":material/notifications:", key="notify_btn")
        with c_user:
            with st.container(key="topbar_user"):
                initials_str = ui.initials(user.get("ho_ten", "KP"))
                st.button(initials_str, key="user_btn")
    return search_q


# =============================================================
# TRANG: TỔNG QUAN (Dashboard)
# =============================================================
def page_overview(user: dict) -> None:
    _render_topbar(user, "Tổng quan", "Tổng quan vận hành")
    ui.page_header(
        "Tổng quan vận hành",
        "Nhịp điểm danh, tình trạng nhân sự và những việc cần xử lý trong ngày.",
        eyebrow="Bảng điều khiển",
    )

    today = datetime.date.today()
    today_str = today.strftime("%d/%m/%Y")

    # --- KPI row ---
    all_emp = get_employees()
    total_nv = sum(1 for e in all_emp if e.get("Vai trò") == "Nhan_vien")
    total_all = len(all_emp)

    history_today_raw = get_attendance_history()
    checked_today = {
        r["Mã NV"]
        for r in history_today_raw
        if hasattr(r.get("Thời gian Check-in"), "date")
        and r["Thời gian Check-in"].date() == today
    }
    present_count = len(checked_today)

    # Đi trễ 7 ngày
    seven_ago = today - datetime.timedelta(days=7)
    late_count = sum(
        1 for r in history_today_raw
        if r.get("Trạng thái") == "Di_tre"
        and hasattr(r.get("Thời gian Check-in"), "date")
        and r["Thời gian Check-in"].date() >= seven_ago
    )

    no_face_count = sum(
        1 for e in all_emp
        if not e.get("Khuôn mặt") and e.get("Vai trò") == "Nhan_vien"
    )

    ui.kpi_row([
        {"label": "Nhân sự", "value": total_nv, "hint": f"{total_all - total_nv} tài khoản quản lý", "icon": "users", "tone": "brand"},
        {"label": "Có mặt hôm nay", "value": present_count, "hint": today_str, "icon": "user-check", "tone": "accent"},
        {"label": "Đi trễ · 7 ngày", "value": late_count, "hint": "Cần theo dõi", "icon": "clock", "tone": "amber"},
        {"label": "Chưa có khuôn mặt", "value": no_face_count, "hint": "Đăng ký ở lần điểm danh đầu", "icon": "camera", "tone": "violet"},
    ])

    st.divider()

    # --- 2 cột chính ---
    col_left, col_right = st.columns([3, 2], gap="large")

    with col_left:
        # Biểu đồ 14 ngày
        import altair as alt

        ui.section_label("Nhịp điểm danh 14 ngày", hint="1 ngày có dữ liệu")
        cutoff = today - datetime.timedelta(days=13)
        daily: dict[datetime.date, int] = {}
        for r in history_today_raw:
            d = r.get("Thời gian Check-in")
            if hasattr(d, "date"):
                dd = d.date()
                if dd >= cutoff:
                    daily[dd] = daily.get(dd, 0) + 1
        chart_data = pd.DataFrame(
            [{"Ngày": str(d), "Số lượng": c} for d, c in sorted(daily.items())]
        )
        if not chart_data.empty:
            with st.container(key="chart_card"):
                st.altair_chart(
                    alt.Chart(chart_data)
                    .mark_area(
                        line={"color": "#4F46E5", "strokeWidth": 2},
                        color=alt.Gradient(
                            gradient="linear",
                            stops=[
                                alt.GradientStop(color="#EEF2FF", offset=0),
                                alt.GradientStop(color="#818CF8", offset=1),
                            ],
                            x1=1, x2=1, y1=1, y2=0,
                        ),
                        point=alt.OverlayMarkDef(color="#4F46E5", size=50),
                        interpolate="monotone",
                    )
                    .encode(
                        x=alt.X("Ngày:O", axis=alt.Axis(labelAngle=-30, labelFontSize=10)),
                        y=alt.Y("Số lượng:Q", axis=alt.Axis(tickMinStep=1)),
                        tooltip=[alt.Tooltip("Ngày:O"), alt.Tooltip("Số lượng:Q", title="Nhân sự")],
                    )
                    .properties(height=190)
                    .configure_view(stroke=None),
                    use_container_width=True,
                )
        else:
            ui.empty_state("Chưa có dữ liệu", "Dữ liệu điểm danh sẽ hiển thị ở đây.", "trending")

        # Feed hôm nay
        st.markdown("")
        ui.section_label("Điểm danh hôm nay", hint=today_str)
        feed_items = []
        for r in history_today_raw:
            d = r.get("Thời gian Check-in")
            if hasattr(d, "date") and d.date() == today:
                feed_items.append({
                    "name": r.get("Họ và Tên", ""),
                    "meta": f"{r.get('Mã NV', '')} · {r.get('Chức vụ', '')}",
                    "time": d.strftime("%H:%M"),
                    "status_html": ui.status_chip(r.get("Trạng thái", "Dung_gio")),
                })
        with st.container(key="feed_card"):
            st.markdown(ui.feed_block(feed_items[:10]), unsafe_allow_html=True)

    with col_right:
        # Phân bổ theo khu vực
        ui.section_label("Phân bổ theo khu vực")
        area_data: dict[str, int] = {}
        for e in all_emp:
            if e.get("Vai trò") == "Nhan_vien":
                area = e.get("Khu vực") or "—"
                area_data[area] = area_data.get(area, 0) + 1
        if area_data:
            df_area = pd.DataFrame(
                [{"Khu vực": k, "Nhân sự": v} for k, v in area_data.items()]
            )
            with st.container(key="side_card"):
                st.dataframe(df_area, use_container_width=True, hide_index=True)

        # Việc cần xử lý
        st.markdown("")
        task_count = (1 if no_face_count > 0 else 0) + (1 if (total_nv - present_count) > 0 else 0)
        ui.section_label("Việc cần xử lý", hint=f"{task_count} mục")
        tasks = []
        if no_face_count > 0:
            tasks.append({
                "title": "Chưa đăng ký khuôn mặt",
                "meta": "Cần chụp ảnh ở lần điểm danh đầu tiên",
                "count": no_face_count,
                "tone": "violet",
                "icon": "camera",
            })
        absent = total_nv - present_count
        if absent > 0:
            tasks.append({
                "title": "Chưa điểm danh hôm nay",
                "meta": f"{today_str} · chưa có lượt check-in",
                "count": absent,
                "tone": "amber",
                "icon": "clock",
            })
        with st.container(key="tasks_card"):
            if tasks:
                st.markdown(ui.tasks_block(tasks), unsafe_allow_html=True)
                st.markdown("")
                if st.button(":material/people:  Mở danh sách nhân sự", use_container_width=True):
                    st.session_state["page"] = "people"
                    st.rerun()
                if st.button(":material/history:  Xem lịch sử chấm công", use_container_width=True):
                    st.session_state["page"] = "history"
                    st.rerun()
            else:
                ui.notice("success", "Tất cả nhân viên đã điểm danh!", "Không có việc cần xử lý hôm nay.")


# =============================================================
# TRANG: DANH SÁCH NHÂN SỰ (Bảng gọn)
# =============================================================
def page_people(user: dict) -> None:
    search_q = _render_topbar(user, "Nhân sự", "Danh sách nhân sự")
    ui.page_header("Danh sách nhân sự", eyebrow="Nhân sự")

    all_emp = get_employees()

    # Filter theo search
    if search_q:
        q_lower = search_q.lower()
        all_emp = [
            e for e in all_emp
            if q_lower in str(e.get("Họ và Tên", "")).lower()
            or q_lower in str(e.get("Mã NV", "")).lower()
        ]

    if not all_emp:
        ui.empty_state("Chưa có nhân viên", "Thêm nhân viên mới bằng mục 'Thêm nhân viên'.", "users")
        return

    # Toolbar lọc
    with st.container(key="toolbar_card"):
        tc1, tc2, tc3 = st.columns([3, 3, 2])
        with tc1:
            role_filter = st.selectbox(
                "Vai trò", ["Tất cả", "Nhân viên", "Quản lý"], label_visibility="collapsed"
            )
        with tc2:
            dept_opts = ["Tất cả"] + sorted({e.get("Chức vụ", "") for e in all_emp if e.get("Chức vụ")})
            dept_filter = st.selectbox("Chức vụ", dept_opts, label_visibility="collapsed")
        with tc3:
            st.markdown(f"**{len(all_emp)}** nhân sự")

    if role_filter == "Nhân viên":
        all_emp = [e for e in all_emp if e.get("Vai trò") == "Nhan_vien"]
    elif role_filter == "Quản lý":
        all_emp = [e for e in all_emp if e.get("Vai trò") == "Quan_ly"]
    if dept_filter != "Tất cả":
        all_emp = [e for e in all_emp if e.get("Chức vụ") == dept_filter]

    # ── Bảng danh sách compact ──
    df_display = pd.DataFrame([
        {
            "Mã NV": e.get("Mã NV", ""),
            "Họ và Tên": e.get("Họ và Tên", ""),
            "Chức vụ": e.get("Chức vụ", ""),
            "Khu vực": e.get("Khu vực", ""),
            "Vai trò": "Quản lý" if e.get("Vai trò") == "Quan_ly" else "Nhân viên",
            "Khuôn mặt": "✅ Có" if e.get("Khuôn mặt") else "⬜ Chưa",
            "Ngày tạo": str(e.get("Ngày tạo", ""))[:10],
        }
        for e in all_emp
    ])

    with st.container(key="table_card"):
        st.dataframe(df_display, use_container_width=True, hide_index=True)

    # ── Thao tác xóa nhân viên ──
    nv_list = [e for e in all_emp if e.get("Vai trò") == "Nhan_vien"]
    if not nv_list:
        return

    st.markdown("")
    ui.section_label("Thao tác nhân viên")
    with st.container(key="form_card"):
        col_sel, col_action = st.columns([3, 2])
        with col_sel:
            sel_opts = {f"{e['Mã NV']} – {e['Họ và Tên']}": e for e in nv_list}
            sel_label = st.selectbox(
                "Chọn nhân viên cần xóa",
                list(sel_opts.keys()),
            )
        sel_emp = sel_opts[sel_label]
        confirm_key = f"confirm_del_{sel_emp['id']}"

        with col_action:
            st.markdown("<div style='height: 28px'></div>", unsafe_allow_html=True)
            if not st.session_state.get(confirm_key):
                if st.button(
                    f":material/delete:  Xóa nhân viên {sel_emp['Mã NV']}",
                    key=f"del_btn_{sel_emp['id']}",
                    use_container_width=True,
                ):
                    st.session_state[confirm_key] = True
                    st.rerun()

        if st.session_state.get(confirm_key):
            ui.notice(
                "error",
                f"Xác nhận xóa {sel_emp['Họ và Tên']} ({sel_emp['Mã NV']})?",
                "Hành động này sẽ xóa toàn bộ lịch phân ca và lịch sử điểm danh của nhân viên này.",
            )
            col_yes, col_no = st.columns(2)
            with col_yes:
                if st.button("🗑️ Xác nhận xóa vĩnh viễn", key=f"del_yes_{sel_emp['id']}", type="primary", use_container_width=True):
                    ok, msg = delete_employee(sel_emp["id"])
                    st.session_state[confirm_key] = False
                    if ok:
                        st.success(f"✅ {msg}")
                    else:
                        st.error(f"❌ {msg}")
                    st.rerun()
            with col_no:
                if st.button("Hủy bỏ", key=f"del_no_{sel_emp['id']}", use_container_width=True):
                    st.session_state[confirm_key] = False
                    st.rerun()


# =============================================================
# TRANG: THÊM NHÂN VIÊN
# =============================================================
def page_add_staff(user: dict) -> None:
    _render_topbar(user, "Nhân sự", "Thêm nhân viên")
    ui.page_header("Thêm nhân viên mới", eyebrow="Nhân sự")

    ui.notice(
        "info",
        "Lưu ý quy trình",
        "Quản lý chỉ cần nhập thông tin. Nhân viên sẽ tự chụp ảnh khuôn mặt khi đăng nhập và điểm danh lần đầu.",
    )

    with st.container(key="form_card"):
        with st.form("form_add_staff", border=False):
            col1, col2 = st.columns(2)
            with col1:
                ma_nv = st.text_input("Mã Nhân Viên *", placeholder="VD: NV16")
                ho_ten = st.text_input("Họ và Tên *", placeholder="Nguyễn Văn A")
                mat_khau = st.text_input("Mật khẩu tài khoản", value="123456")
            with col2:
                chuc_vu = st.selectbox(
                    "Chức vụ *",
                    ["Soát vé", "Giám sát trò chơi", "Thu ngân", "Kỹ thuật", "Vệ sinh"],
                )
                khu_vuc = st.text_input("Khu vực phụ trách", "Khu nhà bạt")
                vai_tro = st.selectbox("Vai trò hệ thống", ["Nhan_vien", "Quan_ly"])

            submitted = st.form_submit_button(
                ":material/save:  Lưu thông tin nhân viên",
                use_container_width=True,
                type="primary",
            )
            if submitted:
                if not ma_nv or not ho_ten:
                    ui.field_error("Vui lòng nhập đầy đủ Mã NV và Họ tên.")
                else:
                    try:
                        add_employee(ma_nv, ho_ten, chuc_vu, khu_vuc, face_encoding=None, mat_khau=mat_khau, vai_tro=vai_tro)
                        ui.notice("success", f"Đã tạo tài khoản: {ho_ten} ({ma_nv})", "Nhân viên có thể đăng nhập ngay với mật khẩu đã thiết lập.")
                        st.balloons()
                    except Exception as exc:
                        ui.notice("error", "Không thể tạo tài khoản", str(exc))


# =============================================================
# TRANG: PHÂN CA TUẦN
# =============================================================
def page_schedule(user: dict) -> None:
    _render_topbar(user, "Vận hành", "Phân ca tuần")
    ui.page_header("Phân ca tuần", "Xếp ca làm việc cho toàn bộ nhân sự theo từng tuần.", eyebrow="Vận hành")

    today = datetime.date.today()
    start_of_week = today - datetime.timedelta(days=today.weekday())

    with st.container(key="selection_bar"):
        col_d, col_info = st.columns([2, 3])
        with col_d:
            selected_start = st.date_input(
                "Chọn ngày Thứ 2 đầu tuần",
                start_of_week,
                key="ql_week_picker",
            )
        with col_info:
            ui.shift_legend()

    matrix_data = get_weekly_schedule_matrix(selected_start)
    if not matrix_data:
        ui.empty_state("Chưa có nhân viên", "Thêm nhân viên trước rồi quay lại đây.", "users")
        return

    with st.container(key="schedule_editor"):
        ui.section_label("Điều chỉnh phân ca", hint="Click ô để thay đổi ca")
        df = pd.DataFrame(matrix_data)
        shift_codes = ui.SHIFT_CODES
        column_config = {
            "id": None,
            "Mã NV": st.column_config.TextColumn("Mã NV", disabled=True),
            "Họ và Tên": st.column_config.TextColumn("Họ và Tên", disabled=True),
            **{
                day: st.column_config.SelectboxColumn(label, options=shift_codes, required=True)
                for day, label in ui.DAY_LABELS.items()
            },
        }
        edited_df = st.data_editor(
            df,
            column_config=column_config,
            hide_index=True,
            use_container_width=True,
            key="schedule_editor_grid",
        )
        if st.button(":material/save:  Lưu bảng phân ca tuần", use_container_width=True, type="primary"):
            save_weekly_schedule_matrix(edited_df.to_dict("records"), selected_start)
            ui.notice("success", "Đã lưu bảng phân ca!", "Lịch phân ca tuần đã được cập nhật vào cơ sở dữ liệu.")
            st.rerun()


# =============================================================
# TRANG: BẢNG CÔNG THÁNG
# =============================================================
def page_monthly(user: dict) -> None:
    _render_topbar(user, "Vận hành", "Bảng công tháng")
    ui.page_header("Bảng công tháng", "Tổng hợp số ngày công và tình trạng chấm công.", eyebrow="Vận hành")

    now = datetime.datetime.now()
    with st.container(key="toolbar_card"):
        col_m, col_y, _ = st.columns([2, 2, 4])
        with col_m:
            selected_month = st.selectbox("Tháng", list(range(1, 13)), index=now.month - 1)
        with col_y:
            selected_year = st.selectbox("Năm", list(range(2024, 2031)), index=now.year - 2024)

    report = get_monthly_attendance_report(selected_month, selected_year)
    if not report:
        ui.empty_state(
            "Chưa có dữ liệu",
            f"Không có bản ghi chấm công nào trong tháng {selected_month}/{selected_year}.",
            "clipboard",
        )
        return

    df_report = pd.DataFrame(report)
    with st.container(key="table_card"):
        st.dataframe(df_report, use_container_width=True, hide_index=True)

    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        df_report.to_excel(writer, index=False, sheet_name=f"BangCong_T{selected_month}")
    buffer.seek(0)
    st.download_button(
        label=f":material/download:  Tải file Excel — Tháng {selected_month}/{selected_year}",
        data=buffer,
        file_name=f"BangCong_KidsPark_T{selected_month}_{selected_year}.xlsx",
        mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        use_container_width=True,
        type="primary",
    )


# =============================================================
# TRANG: LỊCH SỬ CHẤM CÔNG (Quản lý)
# =============================================================
def page_history(user: dict) -> None:
    _render_topbar(user, "Vận hành", "Lịch sử chấm công")
    ui.page_header("Lịch sử chấm công", eyebrow="Vận hành")

    history = get_attendance_history()
    if not history:
        ui.empty_state("Chưa có dữ liệu", "Chưa có lượt điểm danh nào được ghi nhận.", "history")
        return

    df = pd.DataFrame(history)
    ui.kpi_row([
        {"label": "Tổng lượt check-in", "value": len(df), "icon": "check", "tone": "brand"},
        {"label": "Nhân viên đã check-in", "value": df["Mã NV"].nunique() if "Mã NV" in df.columns else 0, "icon": "users", "tone": "accent"},
        {"label": "Lần mới nhất", "value": str(df["Thời gian Check-in"].iloc[0])[:16] if not df.empty and "Thời gian Check-in" in df.columns else "—", "icon": "clock", "tone": "amber"},
    ])
    st.markdown("")
    with st.container(key="table_card"):
        st.dataframe(df, use_container_width=True, hide_index=True)


# =============================================================
# TRANG: ĐIỂM DANH (Nhân viên)
# =============================================================
def _handle_capture(user: dict, cascade, img_bytes: bytes) -> None:
    """Xử lý ảnh chụp từ camera."""
    img_hash = hashlib.md5(img_bytes).hexdigest()
    if st.session_state.get("last_capture_hash") == img_hash:
        return  # Ảnh giống lần trước, bỏ qua
    st.session_state["last_capture_hash"] = img_hash

    # Kiểm tra ca hiện tại & điểm danh trùng
    shift = get_current_shift(user["id"])
    if shift:
        already = check_shift_attendance(user["id"], shift["id"])
        if already:
            t_str = already["thoi_gian_checkin"].strftime("%H:%M:%S")
            ca_name = already.get("ten_ca", "ca làm")
            ui.notice(
                "warning",
                "Đã điểm danh ca này rồi!",
                f"Bạn đã check-in {ca_name} hôm nay lúc {t_str}. Mỗi ca chỉ cho phép điểm danh 1 lần.",
            )
            return

    # Nhận diện khuôn mặt
    cv2_img = cv2.imdecode(np.frombuffer(img_bytes, np.uint8), cv2.IMREAD_COLOR)
    gray = cv2.cvtColor(cv2_img, cv2.COLOR_BGR2GRAY)
    faces = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))

    if len(faces) == 0:
        ui.notice("error", "Không tìm thấy khuôn mặt", "Hãy nhìn thẳng vào camera và đảm bảo đủ ánh sáng.")
        return

    (x, y, w, h) = faces[0]
    face_crop = cv2.resize(gray[y : y + h, x : x + w], (100, 100)).flatten()

    has_face = get_employee_face_status(user["id"])
    if not has_face:
        # Lần đầu: đăng ký khuôn mặt + điểm danh
        update_employee_face(user["id"], face_crop)
        ok, msg = record_attendance(user["id"], trang_thai="Dung_gio")
        st.balloons()
        ui.notice(
            "success",
            "Đăng ký khuôn mặt & điểm danh thành công!",
            f"Đã lưu ảnh mẫu và ghi nhận điểm danh cho {user['ho_ten']} ({user['ma_nv']}).",
        )
    else:
        ok, msg = record_attendance(user["id"], trang_thai="Dung_gio")
        if ok:
            st.balloons()
            ui.notice("success", "Điểm danh thành công!", f"{msg} — Xin chào {user['ho_ten']}!")
        else:
            ui.notice("warning", "Không thể điểm danh", msg)


def page_attendance(user: dict) -> None:
    _render_topbar(user, "Cá nhân", "Điểm danh")
    ui.page_header("Điểm danh", "Chụp ảnh khuôn mặt để ghi nhận giờ làm việc.", eyebrow="Cá nhân")

    cascade, cascade_err = _ensure_cascade()
    if cascade_err:
        ui.notice("error", "Lỗi mô hình nhận diện", cascade_err)
        return

    has_face = get_employee_face_status(user["id"])
    shift = get_current_shift(user["id"])

    # Thông tin ca hiện tại
    if shift:
        ui.section_label(f"Ca hiện tại: {shift.get('ten_ca', '—')}")

    col_cam, col_guide = st.columns([3, 2], gap="large")
    with col_cam:
        with st.container(key="cam_card"):
            if not has_face:
                ui.notice(
                    "info",
                    "Lần điểm danh đầu tiên",
                    "Ảnh chụp lần này sẽ được tự động đăng ký làm khuôn mặt mẫu và ghi nhận điểm danh lần đầu.",
                )
            cam_label = (
                "📸 Chụp ảnh để ĐĂNG KÝ & ĐIỂM DANH lần đầu"
                if not has_face
                else "📸 Chụp ảnh để điểm danh"
            )
            img_buf = st.camera_input(cam_label)
            if img_buf is not None:
                _handle_capture(user, cascade, img_buf.getvalue())

    with col_guide:
        st.markdown(
            ui.panel(
                "Hướng dẫn chụp ảnh",
                [
                    ("Ánh sáng đủ", "Đứng nơi có ánh sáng tốt. Tránh ngược sáng hoặc đứng trong bóng râm."),
                    ("Nhìn thẳng camera", "Không nghiêng mặt, không che khuôn mặt."),
                    ("Chỉ một người", "Khung hình chỉ nên có khuôn mặt của bạn."),
                ],
                icon_name="camera",
            ),
            unsafe_allow_html=True,
        )


# =============================================================
# TRANG: LỊCH CỦA TÔI (Nhân viên)
# =============================================================
def page_my_schedule(user: dict) -> None:
    _render_topbar(user, "Cá nhân", "Lịch của tôi")
    ui.page_header("Lịch của tôi", f"Lịch làm việc theo tuần của {user['ho_ten']}.", eyebrow="Cá nhân")

    today = datetime.date.today()
    start_of_week = today - datetime.timedelta(days=today.weekday())

    with st.container(key="selection_bar"):
        col_d, _ = st.columns([2, 4])
        with col_d:
            selected_start = st.date_input("Tuần bắt đầu (Thứ 2)", start_of_week, key="nv_week_picker")

    ui.shift_legend()

    my_matrix = get_weekly_schedule_matrix(selected_start, nhan_vien_id=user["id"])
    if my_matrix:
        row = my_matrix[0]
        st.markdown(ui.week_grid(row, selected_start), unsafe_allow_html=True)
    else:
        ui.empty_state("Chưa có lịch phân ca", "Liên hệ quản lý để được xếp ca cho tuần này.", "calendar")


# =============================================================
# TRANG: LỊCH SỬ CỦA TÔI (Nhân viên)
# =============================================================
def page_my_history(user: dict) -> None:
    _render_topbar(user, "Cá nhân", "Lịch sử của tôi")
    ui.page_header("Lịch sử điểm danh", f"Lịch sử check-in của {user['ho_ten']}.", eyebrow="Cá nhân")

    my_history = get_employee_attendance(user["id"])
    if not my_history:
        ui.empty_state("Chưa có lịch sử", "Bạn chưa thực hiện lượt điểm danh nào.", "history")
        return

    df = pd.DataFrame(my_history)
    ui.kpi_row([
        {"label": "Tổng lượt check-in", "value": len(df), "icon": "check", "tone": "brand"},
    ])
    st.markdown("")
    with st.container(key="table_card"):
        st.dataframe(df, use_container_width=True, hide_index=True)


# =============================================================
# MÀN HÌNH ĐĂNG NHẬP
# =============================================================
def page_login() -> None:
    ui.login_marker()
    col_hero, col_form = st.columns([3, 2], gap="large")
    with col_hero:
        st.markdown(ui.login_hero(), unsafe_allow_html=True)
    with col_form:
        with st.container(key="login_card"):
            st.markdown(ui.login_head(), unsafe_allow_html=True)
            with st.form("login_form"):
                ma_nv = st.text_input("Mã nhân viên / quản lý", placeholder="VD: QL01 hoặc NV01")
                mat_khau = st.text_input("Mật khẩu", type="password")
                submitted = st.form_submit_button(
                    ":material/login:  Đăng nhập",
                    use_container_width=True,
                    type="primary",
                )
            if submitted:
                if ma_nv and mat_khau:
                    logged_user = check_login(ma_nv, mat_khau)
                    if logged_user:
                        st.session_state["logged_in"] = True
                        st.session_state["user"] = logged_user
                        # Trang mặc định sau đăng nhập
                        default_page = "overview" if logged_user["vai_tro"] == "Quan_ly" else "attendance"
                        st.session_state.setdefault("page", default_page)
                        st.rerun()
                    else:
                        ui.notice("error", "Đăng nhập thất bại", "Mã nhân viên hoặc mật khẩu không đúng.")
                else:
                    ui.notice("warning", "Thiếu thông tin", "Vui lòng nhập đầy đủ mã NV và mật khẩu.")
            st.markdown(ui.login_hint(), unsafe_allow_html=True)


# =============================================================
# ROUTER CHÍNH
# =============================================================
def _init_session() -> None:
    st.session_state.setdefault("logged_in", False)
    st.session_state.setdefault("user", None)
    st.session_state.setdefault("page", "overview")
    st.session_state.setdefault("last_capture_hash", None)


def main() -> None:
    _init_session()

    if not st.session_state["logged_in"]:
        page_login()
        return

    user = st.session_state["user"]
    _render_sidebar(user)

    page = st.session_state.get("page", "overview")
    is_manager = user["vai_tro"] == "Quan_ly"

    # Route
    if page == "overview" and is_manager:
        page_overview(user)
    elif page == "people" and is_manager:
        page_people(user)
    elif page == "add_staff" and is_manager:
        page_add_staff(user)
    elif page == "schedule" and is_manager:
        page_schedule(user)
    elif page == "monthly" and is_manager:
        page_monthly(user)
    elif page == "history" and is_manager:
        page_history(user)
    elif page == "attendance" and not is_manager:
        page_attendance(user)
    elif page == "my_schedule" and not is_manager:
        page_my_schedule(user)
    elif page == "my_history" and not is_manager:
        page_my_history(user)
    else:
        # Fallback
        if is_manager:
            st.session_state["page"] = "overview"
        else:
            st.session_state["page"] = "attendance"
        st.rerun()


if __name__ == "__main__":
    main()
