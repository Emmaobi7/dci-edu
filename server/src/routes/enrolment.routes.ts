import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { joinByCode, leaveClassroom } from '../controllers/enrolment.controller.js';

const router = Router();
router.use(requireAuth);

router.post('/', asyncHandler(joinByCode));
router.delete('/:classroomId', asyncHandler(leaveClassroom));

export default router;
