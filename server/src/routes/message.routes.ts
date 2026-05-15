import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { deleteMessage } from '../controllers/message.controller.js';

const router = Router();
router.use(requireAuth);

router.delete('/:id', asyncHandler(deleteMessage));

export default router;
