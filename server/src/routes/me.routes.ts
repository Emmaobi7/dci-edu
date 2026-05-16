import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { getMyInsights } from '../controllers/insights.controller.js';
import {
  deleteMyAvatar,
  getMyProfile,
  updateMyProfile,
  uploadMyAvatar,
} from '../controllers/profile.controller.js';
import { avatarUpload } from '../utils/uploads.js';

const router = Router();
router.use(requireAuth);

router.get('/insights', asyncHandler(getMyInsights));
router.get('/profile', asyncHandler(getMyProfile));
router.patch('/profile', asyncHandler(updateMyProfile));
router.post('/avatar', avatarUpload.single('file'), asyncHandler(uploadMyAvatar));
router.delete('/avatar', asyncHandler(deleteMyAvatar));

export default router;
