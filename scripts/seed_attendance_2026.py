"""Sinh dữ liệu điểm danh (diem_danh) cho KIDS PARK từ 01/01/2026 đến 27/11/2026.

- 01/01/2026 - 08/11/2026: phân ca xoay vòng theo nhân viên (A/C/T, 2 ngày nghỉ/tuần).
- 09/11/2026 - 27/11/2026: sinh đúng theo lịch phân ca (lich_phan_ca) đã có.
- Chỉ sinh cho nhân viên vai_tro = 'Nhan_vien'.
- Không xóa/sửa bản ghi hiện có; bỏ qua bản ghi trùng (nhân viên, ca, ngày).

Chạy:  python seed_attendance_2026.py
"""

import datetime
import os
import random
import sys

# Đảm bảo import được config từ thư mục gốc
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import mysql.connector

from config import DB_CONFIG

START = datetime.date(2026, 1, 1)
END = datetime.date(2026, 11, 27)
SCHEDULE_START = datetime.date(2026, 11, 9)  # từ ngày này có lịch phân ca thật
SEED = 20261127

SHIFT_CODES = ['A', 'C', 'T']  # Ca Sang / Ca Chieu / Ca Toi


def to_time(value):
    """mysql-connector trả cột TIME dạng timedelta -> đổi về datetime.time."""
    if isinstance(value, datetime.timedelta):
        total = int(value.total_seconds())
        return datetime.time((total // 3600) % 24, (total // 60) % 60, total % 60)
    return value


def fetch_shifts(cursor):
    cursor.execute("SELECT id, ten_ca, gio_bat_dau FROM ca_lam_viec ORDER BY id")
    return [(sid, ten_ca, to_time(gio)) for sid, ten_ca, gio in cursor.fetchall()]


def fetch_employees(cursor):
    cursor.execute(
        "SELECT id, ma_nv FROM nhan_vien WHERE vai_tro = 'Nhan_vien' ORDER BY id"
    )
    return cursor.fetchall()


def fetch_real_schedule(cursor):
    cursor.execute(
        """
        SELECT nhan_vien_id, ca_lam_id, ngay_lam
        FROM lich_phan_ca
        WHERE ngay_lam BETWEEN %s AND %s
        """,
        (SCHEDULE_START, END),
    )
    return cursor.fetchall()


def fetch_existing(cursor):
    cursor.execute("SELECT nhan_vien_id, ca_lam_id, DATE(thoi_gian_checkin) FROM diem_danh")
    return {(row[0], row[1], row[2]) for row in cursor.fetchall()}


def checkin_time(shift_start, rng):
    """Giờ check-in quanh giờ bắt đầu ca; 12% đi trễ 3-35 phút."""
    if rng.random() < 0.12:
        offset = rng.randint(3, 35)
        status = 'Di_tre'
    else:
        offset = rng.randint(-15, 0)
        status = 'Dung_gio'
    return shift_start + datetime.timedelta(minutes=offset), status


def shift_code_for(emp_index, day_index, week_index):
    """Xoay vòng ca A -> C -> T theo tuần; 2 ngày nghỉ cố định mỗi tuần."""
    dow = day_index % 7
    off_a = (emp_index * 2 + week_index) % 7
    off_b = (off_a + 1) % 7
    if dow in (off_a, off_b):
        return None
    return SHIFT_CODES[(week_index + emp_index) % 3]


def build_rows(cursor):
    shifts = fetch_shifts(cursor)
    shift_by_code = {}
    for shift_id, ten_ca, gio_bat_dau in shifts:
        if 'Sang' in ten_ca or 'Sáng' in ten_ca:
            shift_by_code['A'] = (shift_id, gio_bat_dau)
        elif 'Chieu' in ten_ca or 'Chiều' in ten_ca:
            shift_by_code['C'] = (shift_id, gio_bat_dau)
        elif 'Toi' in ten_ca or 'Tối' in ten_ca:
            shift_by_code['T'] = (shift_id, gio_bat_dau)

    employees = fetch_employees(cursor)
    real_schedule = fetch_real_schedule(cursor)
    existing = fetch_existing(cursor)

    rng = random.Random(SEED)
    rows = []
    skipped = 0

    def add(emp_id, shift_id, shift_start, day):
        key = (emp_id, shift_id, day)
        if key in existing:
            nonlocal skipped
            skipped += 1
            return
        checkin, status = checkin_time(
            datetime.datetime.combine(day, shift_start), rng
        )
        rows.append((emp_id, shift_id, checkin, status))

    # Giai đoạn 1: phân ca xoay vòng trước khi có lịch thật.
    days = (SCHEDULE_START - START).days
    for emp_index, (emp_id, _ma_nv) in enumerate(employees):
        for day_index in range(days):
            day = START + datetime.timedelta(days=day_index)
            week_index = day_index // 7
            code = shift_code_for(emp_index, day_index, week_index)
            if code is None:
                continue
            shift_id, gio_bat_dau = shift_by_code[code]
            add(emp_id, shift_id, gio_bat_dau, day)

    # Giai đoạn 2: theo lịch phân ca thật (09/11 - 27/11).
    shift_start_by_id = {shift_id: gio_bat_dau for shift_id, _tn, gio_bat_dau in shifts}
    for emp_id, shift_id, day in real_schedule:
        add(emp_id, shift_id, shift_start_by_id[shift_id], day)

    return rows, skipped


def main():
    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor()
    rows, skipped = build_rows(cursor)
    print(f"Chuan bi: {len(rows)} ban ghi, bo qua {skipped} ban ghi da co.")

    cursor.executemany(
        """
        INSERT INTO diem_danh (nhan_vien_id, ca_lam_id, thoi_gian_checkin, trang_thai)
        VALUES (%s, %s, %s, %s)
        """,
        rows,
    )
    conn.commit()

    cursor.execute("SELECT COUNT(*), MIN(thoi_gian_checkin), MAX(thoi_gian_checkin) FROM diem_danh")
    total, first, last = cursor.fetchone()
    cursor.execute(
        """
        SELECT trang_thai, COUNT(*) FROM diem_danh
        WHERE thoi_gian_checkin >= '2026-01-01' AND thoi_gian_checkin < '2026-11-28'
        GROUP BY trang_thai
        """
    )
    by_status = cursor.fetchall()
    print(f"Tong diem_danh trong CSDL: {total} | {first} -> {last}")
    for status, count in by_status:
        print(f"  {status}: {count}")

    cursor.close()
    conn.close()


if __name__ == '__main__':
    main()
