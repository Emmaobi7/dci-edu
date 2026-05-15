import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import {
  deleteQuiz,
  getQuiz,
  updateQuiz,
} from '../controllers/quiz.controller.js';
import {
  getAttempt,
  getMyAttempt,
  listAttempts,
  saveAnswers,
  startAttempt,
  submitAttempt,
} from '../controllers/quiz-attempt.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/:id', asyncHandler(getQuiz));
router.patch('/:id', asyncHandler(updateQuiz));
router.delete('/:id', asyncHandler(deleteQuiz));

router.post('/:id/attempts', asyncHandler(startAttempt));
router.get('/:id/attempts/me', asyncHandler(getMyAttempt));
router.patch('/:id/attempts/me', asyncHandler(saveAnswers));
router.post('/:id/attempts/me/submit', asyncHandler(submitAttempt));

router.get('/:id/attempts', asyncHandler(listAttempts));
router.get('/attempts/:attemptId', asyncHandler(getAttempt));

export default router;
