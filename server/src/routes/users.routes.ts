import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { getUserAvatar } from '../controllers/profile.controller.js';
import {
  adminCreateUser,
  listUsers,
  updateUserRole,
} from '../controllers/users.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/', asyncHandler(listUsers));
router.post('/', asyncHandler(adminCreateUser));
router.patch('/:id/role', asyncHandler(updateUserRole));
router.get('/:userId/avatar', asyncHandler(getUserAvatar));

export default router;
