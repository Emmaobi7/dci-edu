import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { getUserAvatar } from '../controllers/profile.controller.js';
import { csvUpload } from '../utils/uploads.js';
import {
  adminCreateUser,
  disableUser,
  enableUser,
  exportUsersCsv,
  importUsersCsv,
  listUsers,
  resetUserPassword,
  updateUserRole,
} from '../controllers/users.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/', asyncHandler(listUsers));
router.post('/', asyncHandler(adminCreateUser));
router.get('/export.csv', asyncHandler(exportUsersCsv));
router.post('/import', csvUpload.single('file'), asyncHandler(importUsersCsv));
router.patch('/:id/role', asyncHandler(updateUserRole));
router.post('/:id/password', asyncHandler(resetUserPassword));
router.post('/:id/disable', asyncHandler(disableUser));
router.post('/:id/enable', asyncHandler(enableUser));
router.get('/:userId/avatar', asyncHandler(getUserAvatar));

export default router;
