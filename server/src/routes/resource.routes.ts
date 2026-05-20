import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import {
  addLink,
  addYoutube,
  createResource,
  deleteAttachment,
  deleteResource,
  downloadAttachment,
  getResource,
  listResources,
  updateResource,
  uploadDocuments,
} from '../controllers/resource.controller.js';
import { resourceDocUpload } from '../utils/uploads.js';

const router = Router();
router.use(requireAuth);

router.get('/', asyncHandler(listResources));
router.post('/', asyncHandler(createResource));
router.get('/attachments/:attachmentId/file', asyncHandler(downloadAttachment));
router.delete('/attachments/:attachmentId', asyncHandler(deleteAttachment));
router.get('/:id', asyncHandler(getResource));
router.patch('/:id', asyncHandler(updateResource));
router.delete('/:id', asyncHandler(deleteResource));
router.post('/:id/documents', resourceDocUpload.array('files', 10), asyncHandler(uploadDocuments));
router.post('/:id/youtube', asyncHandler(addYoutube));
router.post('/:id/links', asyncHandler(addLink));

export default router;
