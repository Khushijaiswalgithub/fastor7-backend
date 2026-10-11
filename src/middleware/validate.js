import mongoose from 'mongoose';
import { HttpError } from '../utils/HttpError.js';

// Validates req.body against a zod schema and replaces it with the parsed (trimmed) data.
export const validateBody = (schema) => (req, _res, next) => {
  const result = schema.safeParse(req.body ?? {});
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    return next(new HttpError(400, 'Validation failed', details));
  }
  req.body = result.data;
  next();
};

export const validateObjectId = (param) => (req, _res, next) => {
  if (!mongoose.isValidObjectId(req.params[param])) return next(new HttpError(400, `Invalid ${param}`));
  next();
};
