const multer = require('multer');

// JSON 404 for unknown API routes. The static/SPA catch-all runs afterwards
// so normal page requests still receive index.html.
const notFound = (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, message: 'API endpoint not found.' });
  }
  next();
};

// Central error handler: converts framework errors into consistent JSON
// responses instead of leaking stack traces or returning 500 for bad input.
const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  let status = err.status || err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let errors;

  if (err instanceof multer.MulterError) {
    status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'File is too large. The maximum allowed size is 15 MB.'
        : `File upload failed: ${err.message}`;
  } else if (err.name === 'ValidationError') {
    status = 400;
    message = 'Please correct the highlighted fields.';
    errors = Object.values(err.errors).map((item) => ({
      field: item.path,
      message: item.message
    }));
  } else if (err.name === 'CastError') {
    status = 400;
    message = `Invalid value provided for ${err.path}.`;
  } else if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    message =
      field === 'email'
        ? 'An account with this email address already exists.'
        : `A record with this ${field} already exists.`;
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    status = 401;
    message = 'Your session is invalid or has expired. Please log in again.';
  }

  if (status >= 500) {
    console.error('Unhandled Application Error:', err.stack || err);
  }

  const payload = { success: false, message };
  if (errors && errors.length > 0) {
    payload.errors = errors;
  }
  return res.status(status).json(payload);
};

module.exports = { notFound, errorHandler };
