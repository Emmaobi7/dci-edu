import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import {
  listNotifications,
  markAllRead,
  markRead,
  unreadCount,
} from '../controllers/notification.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/', asyncHandler(listNotifications));
router.get('/unread-count', asyncHandler(unreadCount));
router.post('/read-all', asyncHandler(markAllRead));
router.post('/:id/read', asyncHandler(markRead));

export default router;
