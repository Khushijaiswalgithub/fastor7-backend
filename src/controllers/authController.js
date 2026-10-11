import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Employee } from '../models/Employee.js';
import { signToken } from '../middleware/auth.js';
import { HttpError } from '../utils/HttpError.js';

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().trim().toLowerCase().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters').max(100),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

// POST /api/auth/register
export async function register(req, res) {
  const { name, email, password } = req.body;
  if (await Employee.exists({ email })) throw new HttpError(409, 'Email is already registered');

  const employee = await Employee.create({ name, email, password: await bcrypt.hash(password, 10) });
  res.status(201).json({ success: true, data: { token: signToken(employee), employee } });
}

// POST /api/auth/login
export async function login(req, res) {
  const { email, password } = req.body;
  const employee = await Employee.findOne({ email }).select('+password');

  // Same message for unknown email and wrong password, so emails can't be probed.
  if (!employee || !(await bcrypt.compare(password, employee.password))) {
    throw new HttpError(401, 'Invalid email or password');
  }
  res.json({ success: true, data: { token: signToken(employee), employee } });
}

// GET /api/auth/me
export async function me(req, res) {
  res.json({ success: true, data: { employee: req.employee } });
}
