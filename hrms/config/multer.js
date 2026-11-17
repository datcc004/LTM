'use strict';

/** Upload ảnh đại diện và tài liệu hợp đồng. File được lưu local trong public/uploads. */

const fs = require('node:fs');
const path = require('node:path');
const multer = require('multer');

const env = require('./env');
const { AppError, randomToken } = require('../utils/helpers');

const ALLOWED_IMAGE = /\.(jpe?g|png|webp|gif)$/i;
const ALLOWED_IMAGE_MIME = /^image\/(jpeg|png|webp|gif)$/i;
const ALLOWED_DOC = /\.(pdf|docx?|xlsx?|txt)$/i;
const ALLOWED_DOC_MIME = /^(application\/(pdf|msword|vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet))|text\/plain)$/i;

function uploadDir(subDir) {
  const dir = path.join(env.paths.public, 'uploads', subDir);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function makeUploader({ subDir, field, maxSize, extPattern, mimePattern, label }) {
  const destination = uploadDir(subDir);
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, destination),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${field}-${Date.now()}-${randomToken(6)}${ext}`);
    },
  });

  const uploader = multer({
    storage,
    limits: { fileSize: maxSize, files: 1 },
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (!extPattern.test(ext) || !mimePattern.test(file.mimetype)) {
        return cb(new AppError(`${label} không đúng định dạng cho phép.`, 400));
      }
      return cb(null, true);
    },
  }).single(field);

  return (req, res, next) => uploader(req, res, (error) => {
    if (!error) return next();
    let message = `${label} không hợp lệ.`;
    if (error.code === 'LIMIT_FILE_SIZE') {
      message = `${label} vượt quá dung lượng cho phép (${Math.round(maxSize / 1024 / 1024)} MB).`;
    } else if (error instanceof AppError) {
      message = error.message;
    }
    res.locals.validationErrors = [...(res.locals.validationErrors || []), { field, message }];
    return next();
  });
}

const uploadAvatar = makeUploader({
  subDir: 'avatars',
  field: 'avatar',
  maxSize: env.upload.maxAvatarSize,
  extPattern: ALLOWED_IMAGE,
  mimePattern: ALLOWED_IMAGE_MIME,
  label: 'Ảnh đại diện',
});

const uploadDocument = makeUploader({
  subDir: 'documents',
  field: 'document',
  maxSize: env.upload.maxDocSize,
  extPattern: ALLOWED_DOC,
  mimePattern: ALLOWED_DOC_MIME,
  label: 'Tài liệu hợp đồng',
});

/** Xóa file cũ khi thay thế; chỉ thao tác trong thư mục uploads của ứng dụng. */
function removeUpload(relativePath) {
  if (!relativePath || typeof relativePath !== 'string') return;
  if (!relativePath.startsWith('/uploads/') || relativePath.includes('..')) return;
  const target = path.resolve(env.paths.public, `.${relativePath}`);
  const root = path.resolve(env.paths.public, 'uploads');
  if (!target.startsWith(`${root}${path.sep}`)) return;
  try {
    fs.unlinkSync(target);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      // Không làm gián đoạn request chính vì lỗi dọn dẹp file.
      require('../utils/logger').warn('removeUpload failed', { relativePath, error: error.message });
    }
  }
}

module.exports = { uploadAvatar, uploadDocument, removeUpload };
