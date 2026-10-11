import { Router } from 'express';
import {
  claimEnquiry,
  enquirySchema,
  getMyClaimed,
  getUnclaimed,
  submitEnquiry,
} from '../controllers/enquiryController.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody, validateObjectId } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// Public: the enquiry form needs no authentication.
router.post('/public', validateBody(enquirySchema), asyncHandler(submitEnquiry));

// Everything below requires a logged-in employee.
router.get('/public', requireAuth, asyncHandler(getUnclaimed));
router.get('/private', requireAuth, asyncHandler(getMyClaimed));
router.patch('/:id/claim', requireAuth, validateObjectId('id'), asyncHandler(claimEnquiry));

export default router;
