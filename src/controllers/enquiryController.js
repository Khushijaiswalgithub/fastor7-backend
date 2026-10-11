import { z } from 'zod';
import { Enquiry } from '../models/Enquiry.js';
import { HttpError } from '../utils/HttpError.js';

export const enquirySchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().trim().toLowerCase().email('Invalid email'),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s-]{7,15}$/, 'Invalid phone number')
    .optional(),
  courseInterest: z.string().trim().min(2, 'Course interest is required').max(200),
  message: z.string().trim().max(1000).optional(),
  source: z.enum(['online', 'counselor']).optional(),
});

function pagination(query) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

async function listEnquiries(filter, query, sort) {
  const { page, limit, skip } = pagination(query);
  const [items, total] = await Promise.all([
    Enquiry.find(filter).sort(sort).skip(skip).limit(limit),
    Enquiry.countDocuments(filter),
  ]);
  return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
}

// POST /api/enquiries/public  (no auth) - the public enquiry form
export async function submitEnquiry(req, res) {
  const enquiry = await Enquiry.create(req.body);
  res.status(201).json({ success: true, message: 'Enquiry submitted successfully', data: { enquiry } });
}

// GET /api/enquiries/public  - unclaimed leads, visible to every counselor
export async function getUnclaimed(req, res) {
  const data = await listEnquiries({ claimedBy: null }, req.query, { createdAt: -1 });
  res.json({ success: true, data });
}

// GET /api/enquiries/private  - leads claimed by the logged-in counselor
export async function getMyClaimed(req, res) {
  const data = await listEnquiries({ claimedBy: req.employee._id }, req.query, { claimedAt: -1 });
  res.json({ success: true, data });
}

// PATCH /api/enquiries/:id/claim  - assign a public enquiry to the logged-in counselor
export async function claimEnquiry(req, res) {
  // Atomic: only matches while still unclaimed, so two counselors can't claim the same lead.
  const enquiry = await Enquiry.findOneAndUpdate(
    { _id: req.params.id, claimedBy: null },
    { claimedBy: req.employee._id, claimedAt: new Date() },
    { new: true }
  );

  if (!enquiry) {
    const existing = await Enquiry.findById(req.params.id).select('claimedBy');
    if (!existing) throw new HttpError(404, 'Enquiry not found');
    if (existing.claimedBy.equals(req.employee._id)) throw new HttpError(409, 'You have already claimed this enquiry');
    throw new HttpError(409, 'Enquiry has already been claimed by another counselor');
  }

  res.json({ success: true, message: 'Enquiry claimed successfully', data: { enquiry } });
}
