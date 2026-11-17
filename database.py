import mysql.connector
import pickle
import datetime
from config import DB_CONFIG

def get_connection():
    """Tạo kết nối tới MySQL Database"""
    return mysql.connector.connect(**DB_CONFIG)

def check_login(ma_nv, mat_khau):
    """Xác thực tài khoản và mật khẩu đăng nhập"""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    query = "SELECT id, ma_nv, ho_ten, chuc_vu, khu_vuc, vai_tro FROM nhan_vien WHERE ma_nv = %s AND mat_khau = %s"
    cursor.execute(query, (ma_nv, mat_khau))
    user = cursor.fetchone()
    cursor.close()
    conn.close()
    return user

def add_employee(ma_nv, ho_ten, chuc_vu, khu_vuc, face_encoding=None, mat_khau='123456', vai_tro='Nhan_vien'):
    """Thêm nhân viên mới"""
    conn = get_connection()
    cursor = conn.cursor()
    encoding_blob = pickle.dumps(face_encoding) if face_encoding is not None else None
    
    query = """
    INSERT INTO nhan_vien (ma_nv, ho_ten, chuc_vu, khu_vuc, face_encoding, mat_khau, vai_tro)
    VALUES (%s, %s, %s, %s, %s, %s, %s)
    """
    cursor.execute(query, (ma_nv, ho_ten, chuc_vu, khu_vuc, encoding_blob, mat_khau, vai_tro))
    conn.commit()
    cursor.close()
    conn.close()

def get_employees():
    """Danh sách nhân viên cho màn hình quản lý (không kèm dữ liệu khuôn mặt)"""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    query = """
    SELECT
        id,
        ma_nv AS 'Mã NV',
        ho_ten AS 'Họ và Tên',
        chuc_vu AS 'Chức vụ',
        khu_vuc AS 'Khu vực',
        vai_tro AS 'Vai trò',
        (face_encoding IS NOT NULL) AS 'Khuôn mặt',
        created_at AS 'Ngày tạo'
    FROM nhan_vien
    ORDER BY id ASC
    """
    cursor.execute(query)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return rows

def get_employee_face_status(nhan_vien_id):
    """Kiểm tra xem nhân viên đã có dữ liệu khuôn mặt chưa"""
    conn = get_connection()
    cursor = conn.cursor()
    query = "SELECT face_encoding FROM nhan_vien WHERE id = %s"
    cursor.execute(query, (nhan_vien_id,))
    row = cursor.fetchone()
    cursor.close()
    conn.close()
    if row and row[0] is not None:
        return True
    return False

def update_employee_face(nhan_vien_id, face_encoding):
    """Cập nhật dữ liệu khuôn mặt khi nhân viên tự chụp ảnh lần đầu"""
    conn = get_connection()
    cursor = conn.cursor()
    encoding_blob = pickle.dumps(face_encoding) if face_encoding is not None else None
    query = "UPDATE nhan_vien SET face_encoding = %s WHERE id = %s"
    cursor.execute(query, (encoding_blob, nhan_vien_id))
    conn.commit()
    cursor.close()
    conn.close()

def get_all_faces():
    """Lấy danh sách vector khuôn mặt để so khớp"""
    conn = get_connection()
    cursor = conn.cursor()
    query = "SELECT id, ma_nv, ho_ten, face_encoding FROM nhan_vien WHERE face_encoding IS NOT NULL"
    cursor.execute(query)
    rows = cursor.fetchall()
    
    known_encodings = []
    known_info = []
    
    for row in rows:
        nv_id, ma_nv, ho_ten, blob = row
        encoding = pickle.loads(blob)
        known_encodings.append(encoding)
        known_info.append({'id': nv_id, 'ma_nv': ma_nv, 'ho_ten': ho_ten})
        
    cursor.close()
    conn.close()
    return known_encodings, known_info

def get_current_shift(nhan_vien_id=None, target_dt=None):
    """Xác định ca làm việc hiện tại của nhân viên dựa theo lịch phân ca hoặc khung giờ thực tế"""
    if target_dt is None:
        target_dt = datetime.datetime.now()
    cur_date = target_dt.date()
    cur_time = target_dt.time()
    
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    cur.execute("SELECT id, ten_ca, gio_bat_dau, gio_ket_thuc FROM ca_lam_viec ORDER BY gio_bat_dau ASC")
    all_shifts = cur.fetchall()
    
    scheduled = []
    if nhan_vien_id:
        cur.execute("""
            SELECT c.id, c.ten_ca, c.gio_bat_dau, c.gio_ket_thuc
            FROM lich_phan_ca p
            JOIN ca_lam_viec c ON p.ca_lam_id = c.id
            WHERE p.nhan_vien_id = %s AND p.ngay_lam = %s
            ORDER BY c.gio_bat_dau ASC
        """, (nhan_vien_id, cur_date))
        scheduled = cur.fetchall()
        
    cur.close()
    conn.close()
    
    if scheduled:
        if len(scheduled) == 1:
            return scheduled[0]
        # Nếu có từ 2 ca trong ngày (ví dụ AC, AT)
        if cur_time < datetime.time(12, 30):
            return scheduled[0]
        else:
            return scheduled[-1]
            
    # Mặc định theo các mốc giờ trong ngày nếu chưa phân ca
    sang = next((s for s in all_shifts if 'Sang' in s['ten_ca'] or 'Sáng' in s['ten_ca']), all_shifts[0] if all_shifts else {'id': 1, 'ten_ca': 'Ca Sang'})
    chieu = next((s for s in all_shifts if 'Chieu' in s['ten_ca'] or 'Chiều' in s['ten_ca']), all_shifts[1] if len(all_shifts) > 1 else sang)
    toi = next((s for s in all_shifts if 'Toi' in s['ten_ca'] or 'Tối' in s['ten_ca']), all_shifts[2] if len(all_shifts) > 2 else sang)
    
    if cur_time < datetime.time(12, 30):
        return sang
    elif cur_time < datetime.time(17, 30):
        return chieu
    else:
        return toi

def check_shift_attendance(nhan_vien_id, ca_lam_id=None, target_date=None):
    """Kiểm tra xem nhân viên đã điểm danh cho ca làm này trong ngày hay chưa"""
    if target_date is None:
        target_date = datetime.date.today()
    if ca_lam_id is None:
        shift = get_current_shift(nhan_vien_id)
        ca_lam_id = shift['id']
        
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    query = """
    SELECT d.id, d.thoi_gian_checkin, d.trang_thai, c.ten_ca
    FROM diem_danh d
    LEFT JOIN ca_lam_viec c ON d.ca_lam_id = c.id
    WHERE d.nhan_vien_id = %s 
      AND DATE(d.thoi_gian_checkin) = %s
      AND d.ca_lam_id = %s
    ORDER BY d.thoi_gian_checkin DESC
    LIMIT 1
    """
    cursor.execute(query, (nhan_vien_id, target_date, ca_lam_id))
    row = cursor.fetchone()
    cursor.close()
    conn.close()
    return row

def check_recent_attendance(nhan_vien_id, cooldown_minutes=30):
    """Kiểm tra lượt điểm danh gần nhất (hỗ trợ tương thích ngược)"""
    return check_shift_attendance(nhan_vien_id)

def record_attendance(nhan_vien_id, trang_thai='Dung_gio', ca_lam_id=None):
    """Ghi nhận log điểm danh (mỗi ca làm việc chỉ có thể chụp 1 lần duy nhất trong ngày)"""
    shift = get_current_shift(nhan_vien_id) if ca_lam_id is None else {'id': ca_lam_id, 'ten_ca': f'Ca {ca_lam_id}'}
    active_ca_id = shift['id']
    active_ca_name = shift.get('ten_ca', 'Ca làm')
    
    # 1. Kiểm tra xem ca làm này hôm nay đã điểm danh chưa
    already_checked = check_shift_attendance(nhan_vien_id, active_ca_id)
    if already_checked:
        t_str = already_checked['thoi_gian_checkin'].strftime("%H:%M:%S")
        ca_name = already_checked.get('ten_ca') or active_ca_name
        return False, f"Bạn đã điểm danh {ca_name} hôm nay lúc {t_str}. Mỗi ca làm chỉ có thể chụp 1 lần!"

    conn = get_connection()
    cursor = conn.cursor()
    query = """
    INSERT INTO diem_danh (nhan_vien_id, ca_lam_id, thoi_gian_checkin, trang_thai)
    VALUES (%s, %s, NOW(), %s)
    """
    cursor.execute(query, (nhan_vien_id, active_ca_id, trang_thai))
    conn.commit()
    cursor.close()
    conn.close()
    return True, f"Điểm danh {active_ca_name} thành công!"

def get_attendance_history():
    """Lấy lịch sử điểm danh toàn hệ thống (Quản lý)"""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    query = """
    SELECT 
        d.id AS 'STT',
        n.ma_nv AS 'Mã NV',
        n.ho_ten AS 'Họ và Tên',
        n.chuc_vu AS 'Chức vụ',
        n.khu_vuc AS 'Khu vực',
        d.thoi_gian_checkin AS 'Thời gian Check-in',
        d.trang_thai AS 'Trạng thái'
    FROM diem_danh d
    JOIN nhan_vien n ON d.nhan_vien_id = n.id
    ORDER BY d.thoi_gian_checkin DESC
    """
    cursor.execute(query)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return rows

def get_monthly_attendance_report(month, year):
    """Tổng hợp bảng công tháng của nhân viên phục vụ trích xuất báo cáo"""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    query = """
    SELECT 
        n.ma_nv AS 'Mã NV',
        n.ho_ten AS 'Họ và Tên',
        n.chuc_vu AS 'Chức vụ',
        n.khu_vuc AS 'Khu vực',
        COUNT(d.id) AS 'Tổng số lượt Check-in',
        SUM(CASE WHEN d.trang_thai = 'Dung_gio' THEN 1 ELSE 0 END) AS 'Đúng giờ',
        SUM(CASE WHEN d.trang_thai = 'Di_tre' THEN 1 ELSE 0 END) AS 'Đi trễ'
    FROM nhan_vien n
    LEFT JOIN diem_danh d ON n.id = d.nhan_vien_id 
        AND MONTH(d.thoi_gian_checkin) = %s 
        AND YEAR(d.thoi_gian_checkin) = %s
    WHERE n.vai_tro = 'Nhan_vien'
    GROUP BY n.id, n.ma_nv, n.ho_ten, n.chuc_vu, n.khu_vuc
    ORDER BY n.ma_nv ASC
    """
    cursor.execute(query, (month, year))
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return rows

def get_employee_attendance(nhan_vien_id):
    """Lấy lịch sử điểm danh cá nhân (Nhân viên)"""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    query = """
    SELECT 
        d.id AS 'STT',
        d.thoi_gian_checkin AS 'Thời gian Check-in',
        d.trang_thai AS 'Trạng thái'
    FROM diem_danh d
    WHERE d.nhan_vien_id = %s
    ORDER BY d.thoi_gian_checkin DESC
    """
    cursor.execute(query, (nhan_vien_id,))
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return rows

def delete_employee(nhan_vien_id):
    """Xóa nhân viên và dữ liệu liên quan (lich_phan_ca, diem_danh). Không cho phép xóa tài khoản quản lý (vai_tro='Quan_ly')."""
    conn = get_connection()
    cursor = conn.cursor()
    # Lấy vai trò của nhân viên trước khi xóa
    cursor.execute("SELECT vai_tro FROM nhan_vien WHERE id = %s", (nhan_vien_id,))
    row = cursor.fetchone()
    if not row:
        cursor.close()
        conn.close()
        return False, "Không tìm thấy nhân viên."
    if row[0] == 'Quan_ly':
        cursor.close()
        conn.close()
        return False, "Không thể xóa tài khoản quản lý."
    try:
        # 1. Xóa lịch phân ca liên quan
        cursor.execute("DELETE FROM lich_phan_ca WHERE nhan_vien_id = %s", (nhan_vien_id,))
        # 2. Xóa lịch sử điểm danh liên quan
        cursor.execute("DELETE FROM diem_danh WHERE nhan_vien_id = %s", (nhan_vien_id,))
        # 3. Xóa nhân viên
        cursor.execute("DELETE FROM nhan_vien WHERE id = %s", (nhan_vien_id,))
        conn.commit()
        cursor.close()
        conn.close()
        return True, f"Đã xóa nhân viên id={nhan_vien_id} và dữ liệu liên quan."
    except Exception as e:
        cursor.close()
        conn.close()
        return False, f"Lỗi khi xóa: {str(e)}"

def get_weekly_schedule_matrix(start_date, nhan_vien_id=None):
    """Lấy ma trận phân ca từ Thứ 2 đến Chủ nhật dạng mã A, C, T, AC, AT, OFF"""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    
    if nhan_vien_id:
        cursor.execute("SELECT id, ma_nv, ho_ten FROM nhan_vien WHERE id = %s", (nhan_vien_id,))
    else:
        cursor.execute("SELECT id, ma_nv, ho_ten FROM nhan_vien WHERE vai_tro = 'Nhan_vien' ORDER BY id ASC")
    employees = cursor.fetchall()
    
    end_date = start_date + datetime.timedelta(days=6)
    
    if nhan_vien_id:
        query = """
        SELECT p.nhan_vien_id, p.ngay_lam, c.ten_ca
        FROM lich_phan_ca p
        JOIN ca_lam_viec c ON p.ca_lam_id = c.id
        WHERE p.nhan_vien_id = %s AND p.ngay_lam BETWEEN %s AND %s
        """
        cursor.execute(query, (nhan_vien_id, start_date, end_date))
    else:
        query = """
        SELECT p.nhan_vien_id, p.ngay_lam, c.ten_ca
        FROM lich_phan_ca p
        JOIN ca_lam_viec c ON p.ca_lam_id = c.id
        WHERE p.ngay_lam BETWEEN %s AND %s
        """
        cursor.execute(query, (start_date, end_date))
        
    schedules = cursor.fetchall()
    cursor.close()
    conn.close()
    
    sched_map = {}
    for s in schedules:
        key = (s['nhan_vien_id'], s['ngay_lam'])
        if key not in sched_map:
            sched_map[key] = []
        sched_map[key].append(s['ten_ca'])
        
    days_headers = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
    matrix = []
    
    for emp in employees:
        row = {
            'id': emp['id'],
            'Mã NV': emp['ma_nv'],
            'Họ và Tên': emp['ho_ten']
        }
        for i, day_name in enumerate(days_headers):
            current_date = start_date + datetime.timedelta(days=i)
            shifts = sched_map.get((emp['id'], current_date), [])
            
            has_sang = any('Sang' in s or 'Sáng' in s for s in shifts)
            has_chieu = any('Chieu' in s or 'Chiều' in s for s in shifts)
            has_toi = any('Toi' in s or 'Tối' in s for s in shifts)
            
            if has_sang and has_chieu:
                code = 'AC'
            elif has_sang and has_toi:
                code = 'AT'
            elif has_sang:
                code = 'A'
            elif has_chieu:
                code = 'C'
            elif has_toi:
                code = 'T'
            else:
                code = 'OFF'
            row[day_name] = code
            
        matrix.append(row)
    return matrix

def save_weekly_schedule_matrix(matrix_data, start_date):
    """Lưu ma trận phân ca đã chỉnh sửa vào MySQL Database"""
    conn = get_connection()
    cursor = conn.cursor()
    end_date = start_date + datetime.timedelta(days=6)
    
    cursor.execute("SELECT id, ten_ca FROM ca_lam_viec")
    ca_rows = cursor.fetchall()
    
    id_sang = next((r[0] for r in ca_rows if 'Sang' in r[1] or 'Sáng' in r[1]), 1)
    id_chieu = next((r[0] for r in ca_rows if 'Chieu' in r[1] or 'Chiều' in r[1]), 2)
    id_toi = next((r[0] for r in ca_rows if 'Toi' in r[1] or 'Tối' in r[1]), 3)
    
    days_headers = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
    
    for row in matrix_data:
        nv_id = row['id']
        cursor.execute("""
            DELETE FROM lich_phan_ca 
            WHERE nhan_vien_id = %s AND ngay_lam BETWEEN %s AND %s
        """, (nv_id, start_date, end_date))
        
        for i, day_name in enumerate(days_headers):
            current_date = start_date + datetime.timedelta(days=i)
            code = row.get(day_name, 'OFF')
            
            shifts_to_add = []
            if code == 'A':
                shifts_to_add = [id_sang]
            elif code == 'C':
                shifts_to_add = [id_chieu]
            elif code == 'T':
                shifts_to_add = [id_toi]
            elif code == 'AC':
                shifts_to_add = [id_sang, id_chieu]
            elif code == 'AT':
                shifts_to_add = [id_sang, id_toi]
            
            for cid in shifts_to_add:
                cursor.execute("""
                    INSERT INTO lich_phan_ca (nhan_vien_id, ca_lam_id, ngay_lam)
                    VALUES (%s, %s, %s)
                """, (nv_id, cid, current_date))
                
    conn.commit()
    cursor.close()
    conn.close()