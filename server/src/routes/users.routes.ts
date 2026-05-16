import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { getUserAvatar } from '../controllers/profile.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/:userId/avatar', asyncHandler(getUserAvatar));

export default router;
