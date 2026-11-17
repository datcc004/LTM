# 🎡 Hệ Thống Điểm Danh & Quản Lý Nhân Sự - KIDS PARK

Ứng dụng Web hỗ trợ điểm danh nhân viên bằng nhận diện khuôn mặt và quản lý lịch phân ca tuần theo thời gian thực, tương thích trên cả máy tính và điện thoại di động.

## 🚀 Công nghệ sử dụng
* **Ngôn ngữ:** Python 3.13
* **Giao diện Web:** Streamlit
* **Xử lý ảnh & Nhận diện khuôn mặt:** OpenCV (`Haar Cascade Classifier`)
* **Cơ sở dữ liệu:** MySQL 8.0
* **Xuất báo cáo:** Pandas, OpenPyXL (`.xlsx`)

## 📁 Cấu trúc thư mục dự án
```text
KIDS_PARK_Attendance/
├── app_streamlit.py       # Ứng dụng chính (Giao diện Streamlit)
├── ui_theme.py            # Hệ thống thiết kế UI & components
├── database.py            # Tầng truy xuất & xử lý CSDL MySQL
├── config.py              # Cấu hình kết nối MySQL
├── requirements.txt       # Danh sách thư viện phụ thuộc
├── README.md              # Tài liệu hướng dẫn
├── docs/                  # Tài liệu báo cáo dự án (.docx)
├── models/                # Mô hình nhận diện khuôn mặt Haar Cascade (.xml)
├── sql/                   # Kịch bản khởi tạo CSDL (.sql)
├── scripts/               # Các script tiện ích / tạo dữ liệu mẫu (.py)
└── hrms/                  # Hệ thống quản lý nhân sự (Node.js)
```

## ✨ Chức năng chính
* **Quản lý (`Quan_ly`):**
  * Thêm tài khoản nhân viên mới (không yêu cầu chụp ảnh trước).
  * Phân ca làm việc theo ma trận tuần trực quan (`A`, `C`, `T`, `AC`, `AT`, `OFF`).
  * Theo dõi lịch sử check-in toàn hệ thống và trích xuất bảng công tháng ra file Excel (`.xlsx`).
* **Nhân viên (`Nhan_vien`):**
  * Tự động chụp ảnh đăng ký khuôn mặt mẫu kết hợp điểm danh trong lần đầu tiên.
  * Điểm danh trực tiếp qua camera điện thoại hoặc webcam máy tính.
  * Xem lịch làm việc cá nhân theo tuần và tra cứu lịch sử điểm danh.

## ⚙️ Hướng dẫn cài đặt & Chạy ứng dụng
1. Cài đặt các thư viện cần thiết:
   ```bash
   pip install -r requirements.txt
   ```
2. Khởi tạo cơ sở dữ liệu:
   Import file `sql/kids_park_db.sql` vào MySQL và cập nhật thông tin tài khoản kết nối trong file `config.py`.

3. Khởi chạy ứng dụng:
   ```bash
   python -m streamlit run app_streamlit.py
   ```

## 🔐 Tài khoản trải nghiệm mặc định
* **Quản lý:** Mã `QL01` | Mật khẩu: `123456`
* **Nhân viên:** Mã `NV01` ~ `NV15` | Mật khẩu: `123456`
