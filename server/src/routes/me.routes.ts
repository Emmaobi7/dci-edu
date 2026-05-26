import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { getMyInsights } from '../controllers/insights.controller.js';
import {
  deleteMyAvatar,
  deleteMyStudentDocument,
  getMyProfile,
  submitMyProfile,
  updateMyProfile,
  uploadMyAvatar,
  uploadMyStudentDocument,
} from '../controllers/profile.controller.js';
import { avatarUpload, passportPhotoUpload, studentDocumentUpload } from '../utils/uploads.js';

const router = Router();
router.use(requireAuth);

router.get('/insights', asyncHandler(getMyInsights));
router.get('/profile', asyncHandler(getMyProfile));
router.patch('/profile', asyncHandler(updateMyProfile));
router.post('/profile/submit', asyncHandler(submitMyProfile));
router.post('/avatar', avatarUpload.single('file'), asyncHandler(uploadMyAvatar));
router.delete('/avatar', asyncHandler(deleteMyAvatar));

// Student onboarding documents. Pick multer config based on :kind so we can enforce
// stricter limits/types for the passport photograph vs. PDF-capable doc uploads.
function pickStudentDocUpload(req: Request, res: Response, next: NextFunction): void {
  const kind = (req.params as { kind?: string }).kind;
  const middleware =
    kind === 'passport-photo' ? passportPhotoUpload.single('file') : studentDocumentUpload.single('file');
  middleware(req, res, next);
}

router.post('/documents/:kind', pickStudentDocUpload, asyncHandler(uploadMyStudentDocument));
router.delete('/documents/:kind', asyncHandler(deleteMyStudentDocument));

export default router;
