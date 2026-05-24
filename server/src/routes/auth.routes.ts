import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import {
  forgotPassword,
  login,
  logout,
  me,
  register,
  resetPassword,
} from '../controllers/auth.controller.js';

const router = Router();

router.post('/register', asyncHandler(register));
router.post('/login', asyncHandler(login));
router.post('/logout', asyncHandler(logout));
router.post('/forgot-password', asyncHandler(forgotPassword));
router.post('/reset-password', asyncHandler(resetPassword));
router.get('/me', requireAuth, asyncHandler(me));

export default router;
