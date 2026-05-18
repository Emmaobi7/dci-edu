import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import {
  createEvent,
  deleteEvent,
  getEvent,
  listMyEvents,
  updateEvent,
} from '../controllers/event.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/me/all', asyncHandler(listMyEvents));
router.post('/', asyncHandler(createEvent));
router.get('/:id', asyncHandler(getEvent));
router.patch('/:id', asyncHandler(updateEvent));
router.delete('/:id', asyncHandler(deleteEvent));

export default router;
