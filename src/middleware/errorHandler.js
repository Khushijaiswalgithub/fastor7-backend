import { env } from '../config/env.js';

export function notFound(req, res) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  // Malformed JSON body
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Request body must be valid JSON' });
  }
  // Duplicate key (e.g. an email that is already registered)
  if (err.code === 11000) {
    return res.status(409).json({ success: false, message: 'Email is already registered' });
  }

  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    success: false,
    message: status >= 500 && env.isProduction ? 'Internal server error' : err.message,
    ...(err.details && { errors: err.details }),
  });
}
