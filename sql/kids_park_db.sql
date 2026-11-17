-- 1. Xóa CSDL cũ (nếu có) và tạo mới
DROP DATABASE IF EXISTS kids_park_db;

CREATE DATABASE kids_park_db 
CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE kids_park_db;

-- 2. Tạo Bảng Nhân viên (Đã bao gồm Mật khẩu, Vai trò & Vector khuôn mặt)
CREATE TABLE nhan_vien (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ma_nv VARCHAR(20) NOT NULL UNIQUE,
    ho_ten VARCHAR(100) NOT NULL,
    chuc_vu VARCHAR(50) DEFAULT 'Nhan vien',
    khu_vuc VARCHAR(50) DEFAULT 'Khu tro choi',
    face_encoding BLOB NULL,
    mat_khau VARCHAR(255) DEFAULT '123456',
    vai_tro ENUM('Quan_ly', 'Nhan_vien') DEFAULT 'Nhan_vien',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tạo Bảng Ca làm việc
CREATE TABLE ca_lam_viec (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ten_ca VARCHAR(50) NOT NULL,
    gio_bat_dau TIME NOT NULL,
    gio_ket_thuc TIME NOT NULL
);

-- 4. Tạo Bảng Lịch phân ca
CREATE TABLE lich_phan_ca (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nhan_vien_id INT NOT NULL,
    ca_lam_id INT NOT NULL,
    ngay_lam DATE NOT NULL,
    FOREIGN KEY (nhan_vien_id) REFERENCES nhan_vien(id) ON DELETE CASCADE,
    FOREIGN KEY (ca_lam_id) REFERENCES ca_lam_viec(id) ON DELETE CASCADE
);

-- 5. Tạo Bảng Điểm danh
CREATE TABLE diem_danh (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nhan_vien_id INT NOT NULL,
    ca_lam_id INT NULL,
    thoi_gian_checkin DATETIME NOT NULL,
    trang_thai ENUM('Dung_gio', 'Di_tre') DEFAULT 'Dung_gio',
    FOREIGN KEY (nhan_vien_id) REFERENCES nhan_vien(id) ON DELETE CASCADE,
    FOREIGN KEY (ca_lam_id) REFERENCES ca_lam_viec(id) ON DELETE SET NULL
);

-- 6. Chèn dữ liệu Ca làm việc mẫu
INSERT INTO ca_lam_viec (ten_ca, gio_bat_dau, gio_ket_thuc) VALUES 
('Ca Sang', '08:00:00', '17:00:00'),
('Ca Chieu', '13:00:00', '22:00:00'),
('Ca Toi', '22:00:00', '06:00:00');

-- 7. Chèn tài khoản Quản lý & Nhân viên mẫu
INSERT INTO nhan_vien (ma_nv, ho_ten, chuc_vu, khu_vuc, mat_khau, vai_tro) VALUES 
('QL01', 'Quản Lý Trưởng', 'Quản lý', 'Văn phòng', '123456', 'Quan_ly'),
('NV01', 'Nguyễn Văn An', 'Giám sát trò chơi', 'Khu nhà bạt', '123456', 'Nhan_vien'),
('NV02', 'Trần Thị Bích', 'Giám sát trò chơi', 'Khu nhà bóng', '123456', 'Nhan_vien'),
('NV03', 'Lê Hoàng Nam', 'Giám sát trò chơi', 'Khu đu quay', '123456', 'Nhan_vien'),
('NV04', 'Phạm Minh Đức', 'Giám sát trò chơi', 'Khu trò chơi điện tử', '123456', 'Nhan_vien'),
('NV05', 'Vũ Thu Hà', 'Giám sát trò chơi', 'Khu leo núi', '123456', 'Nhan_vien'),
('NV06', 'Đặng Quốc Bảo', 'Soát vé', 'Cổng chính', '123456', 'Nhan_vien'),
('NV07', 'Bùi Thúy Kiều', 'Soát vé', 'Cổng phụ 1', '123456', 'Nhan_vien'),
('NV08', 'Hoàng Gia Huy', 'Soát vé', 'Cổng phụ 2', '123456', 'Nhan_vien'),
('NV09', 'Đỗ Ngọc Mai', 'Thu ngân', 'Quầy vé & Nạp thẻ', '123456', 'Nhan_vien'),
('NV10', 'Phan Thị Lan', 'Thu ngân', 'Quầy F&B Ẩm thực', '123456', 'Nhan_vien'),
('NV11', 'Trịnh Văn Hùng', 'Nhân viên vệ sinh', 'Khu trò chơi', '123456', 'Nhan_vien'),
('NV12', 'Đinh Thị Cúc', 'Nhân viên vệ sinh', 'Khu ẩm thực & Lối đi', '123456', 'Nhan_vien'),
('NV13', 'Ngô Thanh Tùng', 'Nhân viên vệ sinh', 'Khu tiện ích', '123456', 'Nhan_vien'),
('NV14', 'Lương Quốc Tuấn', 'Kỹ thuật viên', 'Bảo trì máy trò chơi', '123456', 'Nhan_vien'),
('NV15', 'Mai Thế Vinh', 'Kỹ thuật viên', 'Kỹ thuật điện & Âm thanh', '123456', 'Nhan_vien');
