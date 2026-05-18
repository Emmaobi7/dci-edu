import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import {
  deleteAssignment,
  deleteAttachment,
  downloadAttachment,
  getAssignment,
  listMine,
  listMyUpcoming,
  updateAssignment,
  uploadAttachments,
} from '../controllers/assignment.controller.js';
import {
  downloadSubmission,
  getMySubmission,
  gradeSubmission,
  listSubmissions,
  submitAssignment,
} from '../controllers/submission.controller.js';
import { attachmentUpload, submissionUpload } from '../utils/uploads.js';

const router = Router();
router.use(requireAuth);

router.get('/me/upcoming', asyncHandler(listMyUpcoming));
router.get('/me/all', asyncHandler(listMine));
router.get('/:id', asyncHandler(getAssignment));
router.patch('/:id', asyncHandler(updateAssignment));
router.delete('/:id', asyncHandler(deleteAssignment));

router.post('/:id/attachments', attachmentUpload.array('files', 10), asyncHandler(uploadAttachments));
router.delete('/attachments/:attachmentId', asyncHandler(deleteAttachment));
router.get('/attachments/:attachmentId/file', asyncHandler(downloadAttachment));

router.post('/:id/submissions', submissionUpload.single('file'), asyncHandler(submitAssignment));
router.get('/:id/submissions', asyncHandler(listSubmissions));
router.get('/:id/submissions/me', asyncHandler(getMySubmission));

router.patch('/submissions/:submissionId/grade', asyncHandler(gradeSubmission));
router.get('/submissions/:submissionId/file', asyncHandler(downloadSubmission));

export default router;
