'use strict';

/** Xử lý lỗi tập trung. Không trả stack trace cho client. */

const { AppError, isJsonRequest } = require('../utils/helpers');
const logger = require('../utils/logger');

function notFound(req, res, next) {
  const error = new AppError('Không tìm thấy trang hoặc tài nguyên yêu cầu', 404, {
    code: 'NOT_FOUND',
  });
  if (isJsonRequest(req)) return res.status(404).json({ success: false, message: error.message });
  return res.status(404).render('errors/404', { title: '404 - Không tìm thấy', message: error.message });
}

function friendlyDatabaseError(error) {
  switch (error.code) {
    case 'ER_DUP_ENTRY':
      return new AppError('Dữ liệu đã tồn tại (trùng mã hoặc giá trị duy nhất)', 409, {
        code: 'DUPLICATE_ENTRY',
      });
    case 'ER_NO_REFERENCED_ROW_2':
    case 'ER_ROW_IS_REFERENCED_2':
      return new AppError('Không thể thay đổi vì dữ liệu đang được tham chiếu', 400, {
        code: 'FOREIGN_KEY',
      });
    case 'ER_DATA_TOO_LONG':
      return new AppError('Nội dung nhập vào dài hơn giới hạn cho phép', 400, {
        code: 'DATA_TOO_LONG',
      });
    case 'ER_TRUNCATED_WRONG_VALUE':
    case 'ER_INVALID_DATE':
      return new AppError('Định dạng ngày hoặc số không hợp lệ', 400, {
        code: 'INVALID_VALUE',
      });
    case 'ECONNREFUSED':
    case 'PROTOCOL_CONNECTION_LOST':
      return new AppError('Không thể kết nối cơ sở dữ liệu', 503, {
        code: 'DB_UNAVAILABLE',
        isOperational: false,
      });
    default:
      return null;
  }
}

function errorHandler(error, req, res, next) { // eslint-disable-line no-unused-vars
  let normalized = error;

  if (error instanceof AppError) {
    normalized = error;
  } else if (error?.name === 'ValidationError' && Array.isArray(error.array)) {
    normalized = new AppError('Dữ liệu không hợp lệ', 400, {
      code: 'VALIDATION_ERROR',
      details: error.array(),
    });
  } else if (error?.name === 'MulterError') {
    const messages = {
      LIMIT_FILE_SIZE: 'Tệp tải lên vượt quá dung lượng cho phép',
      LIMIT_FILE_COUNT: 'Số lượng tệp tải lên vượt quá giới hạn',
      LIMIT_UNEXPECTED_FILE: 'Loại tệp không được hỗ trợ',
    };
    normalized = new AppError(messages[error.code] || 'Tải tệp lên thất bại', 400, {
      code: 'UPLOAD_ERROR',
    });
  } else if (error instanceof SyntaxError && 'body' in error) {
    normalized = new AppError('Nội dung yêu cầu không đúng định dạng', 400, {
      code: 'BAD_JSON',
    });
  } else {
    normalized = friendlyDatabaseError(error) || new AppError('Đã xảy ra lỗi hệ thống', 500, {
      code: 'INTERNAL_ERROR',
      isOperational: false,
    });
  }

  if (normalized.statusCode >= 500 || !normalized.isOperational) {
    logger.error('Unhandled error', {
      method: req.method,
      path: req.originalUrl,
      error: error?.message,
      stack: error?.stack,
    });
  }

  if (res.headersSent) return next(error);

  if (isJsonRequest(req)) {
    return res.status(normalized.statusCode).json({
      success: false,
      message: normalized.message,
      code: normalized.code,
      errors: normalized.details || undefined,
    });
  }

  const view = normalized.statusCode === 404 ? 'errors/404'
    : normalized.statusCode === 403 ? 'errors/403'
      : 'errors/500';
  return res.status(normalized.statusCode).render(view, {
    title: `${normalized.statusCode} - ${normalized.message}`,
    message: normalized.message,
    code: normalized.code,
  });
}

module.exports = { notFound, errorHandler };
