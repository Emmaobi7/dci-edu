import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { getMyInsights } from '../controllers/insights.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/insights', asyncHandler(getMyInsights));

export default router;
