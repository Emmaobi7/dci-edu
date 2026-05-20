import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import {
  adminListClassrooms,
  getStats,
  listAuditEvents,
} from '../controllers/admin.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/stats', asyncHandler(getStats));
router.get('/audit', asyncHandler(listAuditEvents));
router.get('/classrooms', asyncHandler(adminListClassrooms));

export default router;
