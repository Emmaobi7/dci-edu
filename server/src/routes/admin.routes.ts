import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import {
  adminListClassrooms,
  exportAuditCsv,
  exportClassroomsCsv,
  getStats,
  listAuditEvents,
} from '../controllers/admin.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/stats', asyncHandler(getStats));
router.get('/audit', asyncHandler(listAuditEvents));
router.get('/audit/export.csv', asyncHandler(exportAuditCsv));
router.get('/classrooms', asyncHandler(adminListClassrooms));
router.get('/classrooms/export.csv', asyncHandler(exportClassroomsCsv));

export default router;
