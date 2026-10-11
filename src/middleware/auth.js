import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { Employee } from '../models/Employee.js';
import { HttpError } from '../utils/HttpError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export function signToken(employee) {
  return jwt.sign({ sub: employee.id, email: employee.email }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

// Requires "Authorization: Bearer <token>" and sets req.employee.
export const requireAuth = asyncHandler(async (req, _res, next) => {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) throw new HttpError(401, 'Authentication token missing');

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    throw new HttpError(401, 'Invalid or expired token');
  }

  const employee = await Employee.findById(payload.sub);
  if (!employee) throw new HttpError(401, 'Account no longer exists');

  req.employee = employee;
  next();
});
