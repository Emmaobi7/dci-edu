import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import {
  deleteAnnouncement,
  getAnnouncement,
  updateAnnouncement,
} from '../controllers/announcement.controller.js';
import {
  addLink,
  addYoutube,
  deleteAttachment,
  downloadAttachment,
  uploadDocuments,
  uploadImages,
} from '../controllers/announcement-extras.controller.js';
import {
  createComment,
  deleteComment,
  updateComment,
} from '../controllers/comment.controller.js';
import { announcementDocUpload, announcementImageUpload } from '../utils/uploads.js';

const router = Router();
router.use(requireAuth);

router.get('/:id', asyncHandler(getAnnouncement));
router.patch('/:id', asyncHandler(updateAnnouncement));
router.delete('/:id', asyncHandler(deleteAnnouncement));

router.post('/:id/images', announcementImageUpload.array('files', 10), asyncHandler(uploadImages));
router.post('/:id/documents', announcementDocUpload.array('files', 10), asyncHandler(uploadDocuments));
router.post('/:id/youtube', asyncHandler(addYoutube));
router.post('/:id/links', asyncHandler(addLink));
router.delete('/attachments/:attachmentId', asyncHandler(deleteAttachment));
router.get('/attachments/:attachmentId/file', asyncHandler(downloadAttachment));

router.post('/:id/comments', asyncHandler(createComment));
router.patch('/comments/:id', asyncHandler(updateComment));
router.delete('/comments/:id', asyncHandler(deleteComment));

export default router;
